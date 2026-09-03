import React, { useState, useEffect } from 'react';
import './index.css';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [view, setView] = useState<'customers' | 'products' | 'challans'>('customers');

  // Login form state
  const [email, setEmail] = useState('admin@erp.com');
  const [password, setPassword] = useState('password123');
  const [authError, setAuthError] = useState('');

  // Domain data
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);

  // Challan Create Form State
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [challanItems, setChallanItems] = useState<any[]>([]);
  const [challanError, setChallanError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  const loadData = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    if (view === 'customers') {
      const res = await fetch(`${API_BASE}/customers`, { headers });
      setCustomers(await res.json());
    } else if (view === 'products') {
      const res = await fetch(`${API_BASE}/products`, { headers });
      setProducts(await res.json());
    } else if (view === 'challans') {
      const res = await fetch(`${API_BASE}/challans`, { headers });
      setChallans(await res.json());
      // Load dependencies for creating a challan
      const cRes = await fetch(`${API_BASE}/customers`, { headers });
      setCustomers(await cRes.json());
      const pRes = await fetch(`${API_BASE}/products`, { headers });
      setProducts(await pRes.json());
    }
  };

  useEffect(() => {
    loadData();
  }, [view, token]);

  const addChallanItem = () => {
    if (!selectedProduct || quantity <= 0) return;
    const prod = products.find(p => p.id === parseInt(selectedProduct));
    if (!prod) return;
    setChallanItems([...challanItems, { product_id: prod.id, name: prod.name, quantity }]);
    setSelectedProduct('');
    setQuantity(1);
  };

  const submitChallan = async (status: 'Draft' | 'Confirmed') => {
    setChallanError('');
    try {
      const res = await fetch(`${API_BASE}/challans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_id: selectedCustomer,
          status,
          items: challanItems.map(i => ({ product_id: i.product_id, quantity: i.quantity }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setChallanItems([]);
      setSelectedCustomer('');
      loadData();
    } catch (err: any) {
      setChallanError(err.message);
    }
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <form onSubmit={handleLogin} className="card" style={{ width: 340 }}>
          <h2>ERP / CRM Login</h2>
          {authError && <p style={{ color: 'red', margin: '10px 0' }}>{authError}</p>}
          <div style={{ margin: '10px 0' }}>
            <label>Email</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{ margin: '10px 0' }}>
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn" style={{ width: '100%' }}>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <h2>Mini ERP + CRM</h2>
        <div style={{ margin: '10px 0', fontSize: '0.8rem', color: '#94a3b8' }}>
          Role: <strong>{user?.role}</strong>
        </div>
        <button className={view === 'customers' ? 'active' : ''} onClick={() => setView('customers')}>Customers (CRM)</button>
        <button className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}>Products & Stock</button>
        <button className={view === 'challans' ? 'active' : ''} onClick={() => setView('challans')}>Sales Challans</button>
        <button onClick={handleLogout} className="btn-danger" style={{ marginTop: 'auto', textAlign: 'center' }}>Logout</button>
      </div>

      {/* Main Working View */}
      <div className="main-content">
        {/* CUSTOMERS VIEW */}
        {view === 'customers' && (
          <div>
            <div className="header">
              <h2>Customer Relationship Management</h2>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Business</th><th>Mobile</th><th>Type</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td>{c.id}</td><td>{c.name}</td><td>{c.business_name}</td><td>{c.mobile}</td><td>{c.type}</td><td>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PRODUCTS VIEW */}
        {view === 'products' && (
          <div>
            <div className="header">
              <h2>Inventory & Products</h2>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th><th>Name</th><th>Category</th><th>Stock</th><th>Alert Min</th><th>Price</th><th>Location</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>{p.sku}</td><td>{p.name}</td><td>{p.category}</td>
                    <td style={{ color: p.current_stock <= p.min_stock_alert ? 'red' : 'inherit', fontWeight: 'bold' }}>
                      {p.current_stock}
                    </td>
                    <td>{p.min_stock_alert}</td><td>${p.unit_price}</td><td>{p.warehouse_location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CHALLAN VIEW */}
        {view === 'challans' && (
          <div>
            <div className="header">
              <h2>Sales Challans</h2>
            </div>

            {/* Form for Creating Challan */}
            <div className="card">
              <h3>Create Sales Challan</h3>
              {challanError && <p style={{ color: 'red', margin: '8px 0' }}>{challanError}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <select className="input" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.business_name})</option>)}
                </select>
                <select className="input" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Available: {p.current_stock})</option>)}
                </select>
                <input
                  type="number" min="1" className="input" style={{ width: 80 }}
                  value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                />
                <button type="button" className="btn" onClick={addChallanItem}>Add Item</button>
              </div>

              {challanItems.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <h4>Items to Include:</h4>
                  <ul>
                    {challanItems.map((item, idx) => (
                      <li key={idx}>{item.name} — Qty: {item.quantity}</li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                    <button className="btn" onClick={() => submitChallan('Draft')}>Save as Draft</button>
                    <button className="btn" style={{ background: '#16a34a' }} onClick={() => submitChallan('Confirmed')}>
                      Confirm & Deduct Stock
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Challans List */}
            <table className="table">
              <thead>
                <tr>
                  <th>Challan No</th><th>Customer</th><th>Total Qty</th><th>Status</th><th>Created By</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {challans.map(ch => (
                  <tr key={ch.id}>
                    <td>{ch.challan_number}</td><td>{ch.customer_name}</td><td>{ch.total_quantity}</td>
                    <td>
                      <span className={ch.status === 'Confirmed' ? 'badge-confirmed' : 'badge-draft'}>
                        {ch.status}
                      </span>
                    </td>
                    <td>{ch.created_by_name}</td>
                    <td>{new Date(ch.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}