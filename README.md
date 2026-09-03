# MINI-ERP-CRM

================================================================================

PREREQUISITES:
- PostgreSQL 14+ installed on your machine[cite: 1].
- Access to the command-line tool `psql`.

--------------------------------------------------------------------------------
1. ENVIRONMENT CONFIGURATION
--------------------------------------------------------------------------------
If the `psql` command is not recognized, add PostgreSQL to your system path:

Windows (PowerShell):
    $env:Path += ";C:\Program Files\PostgreSQL\16\bin"
    (Replace 16 with your installed version)

macOS / Linux:
    export PATH="/usr/local/opt/postgresql@16/bin:$PATH"

Verify installation:
    psql --version

--------------------------------------------------------------------------------
2. START POSTGRESQL SERVICE
--------------------------------------------------------------------------------
Windows (PowerShell as Administrator):
    Get-Service -Name postgresql*
    Start-Service -Name postgresql*

macOS (Homebrew):
    brew services start postgresql@16

Linux (systemd):
    sudo systemctl start postgresql

--------------------------------------------------------------------------------
3. CREATE THE DATABASE
--------------------------------------------------------------------------------
Run this command from your terminal:

    psql -U postgres -c "CREATE DATABASE erp_crm;"

(Enter your PostgreSQL root/master password when prompted)

--------------------------------------------------------------------------------
4. EXECUTE SCHEMA & SEED DATA
--------------------------------------------------------------------------------
Navigate to the directory containing your schema.sql file:

Windows (PowerShell):
    cd mini-erp-crm\database
    psql -U postgres -d erp_crm -f schema.sql

macOS / Linux:
    cd mini-erp-crm/database
    psql -U postgres -d erp_crm -f schema.sql

--------------------------------------------------------------------------------
5. VERIFY DATABASE CREATION
--------------------------------------------------------------------------------
Connect interactively:
    psql -U postgres -d erp_crm

Run these queries inside the interactive psql prompt:

1. List all tables:
    \dt

   Expected tables:
   - users[cite: 1]
   - customers[cite: 1]
   - customer_notes[cite: 1]
   - products[cite: 1]
   - stock_movements[cite: 1]
   - challans[cite: 1]
   - challan_items[cite: 1]

2. Check seeded users:
    SELECT id, name, email, role FROM users;

3. Exit the console:
    \q

--------------------------------------------------------------------------------
6. CONNECTION STRING FOR BACKEND
--------------------------------------------------------------------------------
Set your environment variable for the Node.js/Express backend:

    DATABASE_URL="postgresql://postgres:<YOUR_PASSWORD>@localhost:5432/erp_crm"
================================================================================
