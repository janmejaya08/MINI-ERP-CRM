import express, { Request, Response, NextFunction } from 'express';
import { pool } from './db';
import { hashPassword, generateToken, verifyToken } from './utils';

const app = express();
app.use(express.json());

// Enable CORS using raw native HTTP headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Authentication Middleware
export interface AuthRequest extends Request {
  user?: { id: number; role: string; name: string };
}

const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  req.user = decoded;
  next();
};

const authorize = (roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Access denied' });
  }
  next();
};

// --- AUTH APIS ---
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const hashed = hashPassword(password);
  const result = await pool.query('SELECT id, name, email, role FROM users WHERE email = $1 AND password = $2', [email, hashed]);
  if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const user = result.rows[0];
  const token = generateToken({ id: user.id, name: user.name, role: user.role });
  return res.json({ token, user });
});

// --- CRM MODULE APIS ---
app.get('/api/customers', authenticate, async (req: Request, res: Response) => {
  const search = req.query.search ? `%${req.query.search}%` : null;
  let query = 'SELECT * FROM customers';
  let params: any[] = [];

  if (search) {
    query += ' WHERE name ILIKE $1 OR business_name ILIKE $1 OR mobile ILIKE $1';
    params.push(search);
  }
  query += ' ORDER BY id DESC';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

app.post('/api/customers', authenticate, async (req: Request, res: Response) => {
  const { name, mobile, email, business_name, gst_number, type, address, status, follow_up_date } = req.body;
  if (!name || !mobile || !business_name) return res.status(400).json({ error: 'Missing required customer fields' });

  const result = await pool.query(
    `INSERT INTO customers (name, mobile, email, business_name, gst_number, type, address, status, follow_up_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [name, mobile, email, business_name, gst_number, type || 'Retail', address, status || 'Lead', follow_up_date]
  );
  res.status(201).json(result.rows[0]);
});

app.get('/api/customers/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
  if (customerResult.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

  const notesResult = await pool.query(
    `SELECT n.id, n.note, n.created_at, u.name as author 
     FROM customer_notes n 
     JOIN users u ON n.created_by = u.id 
     WHERE customer_id = $1 ORDER BY n.created_at DESC`,
    [id]
  );

  res.json({ ...customerResult.rows[0], notes: notesResult.rows });
});

app.post('/api/customers/:id/notes', authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'Note text required' });

  const result = await pool.query(
    'INSERT INTO customer_notes (customer_id, note, created_by) VALUES ($1, $2, $3) RETURNING *',
    [id, note, req.user?.id]
  );
  res.status(201).json(result.rows[0]);
});

// --- INVENTORY MODULE APIS ---
app.get('/api/products', authenticate, async (_req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
  res.json(result.rows);
});

app.post('/api/products', authenticate, authorize(['Admin', 'Warehouse']), async (req: Request, res: Response) => {
  const { name, sku, category, unit_price, current_stock, min_stock_alert, warehouse_location } = req.body;
  const result = await pool.query(
    `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock_alert, warehouse_location)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, sku, category, unit_price, current_stock || 0, min_stock_alert || 5, warehouse_location]
  );
  res.status(201).json(result.rows[0]);
});

// --- SALES CHALLAN MODULE (ACID Transaction with Stock Checks) ---
app.post('/api/challans', authenticate, authorize(['Admin', 'Sales']), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { customer_id, items, status } = req.body; // status: 'Draft' or 'Confirmed'
    if (!customer_id || !items || !items.length) {
      return res.status(400).json({ error: 'Customer ID and items are required' });
    }

    await client.query('BEGIN');

    let totalQty = 0;
    const challanNumber = `CH-${Date.now()}`;

    // Create Challan Header
    const challanResult = await client.query(
      `INSERT INTO challans (challan_number, customer_id, total_quantity, status, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [challanNumber, customer_id, 0, status, req.user?.id]
    );
    const challanId = challanResult.rows[0].id;

    for (const item of items) {
      // Validate Product & Check Stock
      const prodResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
      if (prodResult.rows.length === 0) {
        throw new Error(`Product not found: ID ${item.product_id}`);
      }
      const product = prodResult.rows[0];

      if (status === 'Confirmed') {
        if (product.current_stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.current_stock}, Requested: ${item.quantity}`);
        }
        // Deduct Stock
        await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [item.quantity, product.id]);
        
        // Log Movement
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
           VALUES ($1, $2, 'OUT', $3, $4)`,
          [product.id, item.quantity, `Challan Confirmation: ${challanNumber}`, req.user?.id]
        );
      }

      // Store Product Snapshot
      await client.query(
        `INSERT INTO challan_items (challan_id, product_id, snapshot_product_name, snapshot_sku, snapshot_unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [challanId, product.id, product.name, product.sku, product.unit_price, item.quantity]
      );

      totalQty += Number(item.quantity);
    }

    // Update Challan Total Quantity
    await client.query('UPDATE challans SET total_quantity = $1 WHERE id = $2', [totalQty, challanId]);
    await client.query('COMMIT');

    res.status(201).json({ message: 'Challan created successfully', challanNumber, status });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/challans', authenticate, async (_req: Request, res: Response) => {
  const result = await pool.query(`
    SELECT c.*, cust.name as customer_name, u.name as created_by_name 
    FROM challans c
    JOIN customers cust ON c.customer_id = cust.id
    JOIN users u ON c.created_by = u.id
    ORDER BY c.id DESC
  `);
  res.json(result.rows);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));