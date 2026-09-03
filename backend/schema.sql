CREATE TYPE user_role AS ENUM ('Admin', 'Sales', 'Warehouse', 'Accounts');
CREATE TYPE customer_type AS ENUM ('Retail', 'Wholesale', 'Distributor');
CREATE TYPE customer_status AS ENUM ('Lead', 'Active', 'Inactive');
CREATE TYPE movement_type AS ENUM ('IN', 'OUT');
CREATE TYPE challan_status AS ENUM ('Draft', 'Confirmed', 'Cancelled');

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'Sales',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(150) NOT NULL,
    business_name VARCHAR(150) NOT NULL,
    gst_number VARCHAR(50),
    type customer_type NOT NULL DEFAULT 'Retail',
    address TEXT NOT NULL,
    status customer_status NOT NULL DEFAULT 'Lead',
    follow_up_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Follow-up Notes
CREATE TABLE customer_notes (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products & Inventory
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    current_stock INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock_alert INT NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
    warehouse_location VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Movement Logs
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    type movement_type NOT NULL,
    reason TEXT NOT NULL,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Challan Header
CREATE TABLE challans (
    id SERIAL PRIMARY KEY,
    challan_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT REFERENCES customers(id) ON DELETE RESTRICT,
    total_quantity INT NOT NULL DEFAULT 0,
    status challan_status NOT NULL DEFAULT 'Draft',
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Challan Items (Stores product snapshot)
CREATE TABLE challan_items (
    id SERIAL PRIMARY KEY,
    challan_id INT REFERENCES challans(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE RESTRICT,
    snapshot_product_name VARCHAR(150) NOT NULL,
    snapshot_sku VARCHAR(100) NOT NULL,
    snapshot_unit_price NUMERIC(12, 2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0)
);

-- Initial Mock Data (Password is "password123" for all, using crypto SHA-256 for demo)
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@erp.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Admin'),
('Sales Rep', 'sales@erp.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Sales'),
('Warehouse Ops', 'warehouse@erp.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Warehouse');

INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock_alert, warehouse_location) VALUES
('Industrial Copper Wire 10m', 'SKU-COP-001', 'Electrical', 450.00, 100, 10, 'Bay A-1'),
('Galvanized Steel Bolt 100pk', 'SKU-BLT-002', 'Fasteners', 120.00, 50, 5, 'Bay B-3');