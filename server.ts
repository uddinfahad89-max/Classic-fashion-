import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side persistent storage directory for user accounts and invoices
const DATA_DIR = path.join(process.cwd(), 'data', 'vaults');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeId(id: string): string {
  if (!id) return '';
  return id.trim().toLowerCase().replace(/[\s+()_-]/g, '');
}

function getVaultFilePath(identifier: string): string {
  const norm = normalizeId(identifier);
  return path.join(DATA_DIR, `${norm}.json`);
}

// Initial seed for Fahad Uddin's account if not already on disk
function ensureFahadSeed() {
  try {
    const fahadPath = getVaultFilePath('9707502246');
    if (!fs.existsSync(fahadPath)) {
      const now = Date.now();
      const fahadSeed = {
        identifier: '9707502246',
        email: 'uddinfahad89@gmail.com',
        phone: '9707502246',
        name: 'Fahad Uddin',
        role: 'Owner',
        pin: '1234',
        isAppLockEnabled: false,
        settings: {
          storeName: 'Classic fashion',
          storePhone: '9707502246',
          storeAddress: 'Main Market, Goalpara, Assam',
          signatoryName: 'Fahad Uddin',
          upiId: '9707502246@upi',
          paperWidth: '58mm',
          currencySymbol: '₹',
          currencyName: 'INR',
          footerNote: 'ধন্যবাদ! আবার আসবেন (Thank you! Visit again)',
          autoPrintOnCheckout: false,
          defaultInvoiceFormat: 'tax_invoice',
          nextInvoiceNumber: 1049,
        },
        bills: [
          {
            id: 'inv-sale-306',
            invoiceNo: '306',
            date: '22-08-2026',
            time: '02:58 PM',
            timestamp: new Date('2026-08-22T14:58:00').getTime(),
            customerName: 'RUMANA BEGAM',
            customerPhone: '9876543210',
            items: [
              { id: 'it-306-1', name: 'Ganji set', price: 200.0, qty: 2, total: 400.0 },
              { id: 'it-306-2', name: 'Seka ganji', price: 20.0, qty: 4, total: 80.0 },
              { id: 'it-306-3', name: 'Stal orna', price: 200.0, qty: 1, total: 200.0 },
              { id: 'it-306-4', name: 'Cotton orna', price: 125.0, qty: 2, total: 250.0 },
              { id: 'it-306-5', name: 'Nitee', price: 200.0, qty: 1, total: 200.0 },
              { id: 'it-306-6', name: 'Frk', price: 180.0, qty: 1, total: 180.0 },
              { id: 'it-306-7', name: 'Seka', price: 90.0, qty: 1, total: 90.0 },
            ],
            subtotal: 1400.0,
            discount: 140.0,
            discountType: 'fixed',
            discountValue: 140.0,
            grandTotal: 1260.0,
            paymentMethod: 'cash',
            paymentStatus: 'PAID',
            paidAmount: 1260.0,
            changeAmount: 0.0,
          },
          {
            id: 'inv-sale-1048',
            invoiceNo: 'INV-1048',
            date: '19-09-2026',
            time: '11:20 AM',
            timestamp: now - 1000 * 60 * 180,
            customerName: 'Tanvir Ahmed',
            customerPhone: '9845012345',
            items: [{ id: 'it-1', name: 'Cotton Kurti & Pajama Set', price: 1450, qty: 1, total: 1450 }],
            subtotal: 1450,
            discount: 0,
            grandTotal: 1450,
            paymentMethod: 'cash',
            paymentStatus: 'PAID',
            paidAmount: 1450,
            changeAmount: 0,
          },
          {
            id: 'inv-sale-1047',
            invoiceNo: 'INV-1047',
            date: '19-09-2026',
            time: '10:05 AM',
            timestamp: now - 1000 * 60 * 250,
            customerName: 'Priya Sharma',
            customerPhone: '9123456789',
            items: [{ id: 'it-2', name: 'Georgette Embroidered Dupatta', price: 450, qty: 1, total: 450 }],
            subtotal: 450,
            discount: 0,
            grandTotal: 450,
            paymentMethod: 'upi',
            paymentStatus: 'PAID',
            paidAmount: 450,
            changeAmount: 0,
          },
          {
            id: 'inv-sale-1046',
            invoiceNo: 'INV-1046',
            date: '18-09-2026',
            time: '06:40 PM',
            timestamp: now - 1000 * 60 * 60 * 20,
            customerName: 'Walk-in Customer',
            items: [{ id: 'it-3', name: 'Silk Neck Scarf', price: 320, qty: 1, total: 320 }],
            subtotal: 320,
            discount: 0,
            grandTotal: 320,
            paymentMethod: 'cash',
            paymentStatus: 'PAID',
            paidAmount: 320,
            changeAmount: 0,
          },
        ],
        cashEntries: [
          {
            id: 'cash-1',
            type: 'Income',
            amount: 4500,
            note: 'Counter sale - 3x Cotton Kurtis & Dupatta',
            timestamp: now - 1000 * 60 * 60 * 2,
            dateFormatted: '02:30 PM',
          },
          {
            id: 'cash-2',
            type: 'Expense',
            amount: 850,
            note: 'Alteration tailoring thread & packaging covers',
            timestamp: now - 1000 * 60 * 60 * 5,
            dateFormatted: '11:15 AM',
          },
          {
            id: 'cash-3',
            type: 'Expense',
            amount: 12000,
            note: 'Wholesale cloth roll purchase from Surat vendor',
            timestamp: now - 1000 * 60 * 60 * 24,
            dateFormatted: 'Yesterday',
          },
        ],
        customerDues: [
          {
            id: 'due-1',
            name: 'Ramesh Patel',
            phone: '98765 43210',
            type: 'receivable',
            dueAmount: 1500,
            lastUpdated: now - 1000 * 60 * 60 * 24 * 2,
            transactions: [
              {
                id: 'tx-1',
                type: 'added',
                dueType: 'receivable',
                amount: 1500,
                note: 'বাকিতে কেনাকাটা (Festival dress purchase)',
                timestamp: now - 1000 * 60 * 60 * 24 * 2,
                dateFormatted: new Date(now - 1000 * 60 * 60 * 24 * 2).toLocaleDateString(),
              },
            ],
          },
          {
            id: 'due-2',
            name: 'Ananya Sen',
            phone: '98452 33445',
            type: 'receivable',
            dueAmount: 850,
            lastUpdated: now - 1000 * 60 * 60 * 24 * 5,
            transactions: [
              {
                id: 'tx-2',
                type: 'added',
                dueType: 'receivable',
                amount: 850,
                note: 'বাকি কেনাকাটা (Designer Dupatta balance)',
                timestamp: now - 1000 * 60 * 60 * 24 * 5,
                dateFormatted: new Date(now - 1000 * 60 * 60 * 24 * 5).toLocaleDateString(),
              },
            ],
          },
        ],
        purchaseTrips: [],
        lastActive: Date.now(),
      };

      fs.writeFileSync(fahadPath, JSON.stringify(fahadSeed, null, 2), 'utf-8');
      // Also link email
      fs.writeFileSync(getVaultFilePath('uddinfahad89@gmail.com'), JSON.stringify(fahadSeed, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Seed initialization error:', err);
  }
}

ensureFahadSeed();

// ----------------- API ENDPOINTS -----------------

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Sync and save complete account vault to server disk
app.post('/api/vault/sync', (req, res) => {
  try {
    const vault = req.body;
    if (!vault || (!vault.identifier && !vault.phone && !vault.email)) {
      return res.status(400).json({ error: 'Missing identifier, phone or email' });
    }

    const identifiers = [vault.identifier, vault.phone, vault.email].filter(Boolean);

    // Write file for each identifier
    for (const id of identifiers) {
      const filePath = getVaultFilePath(id);
      fs.writeFileSync(filePath, JSON.stringify(vault, null, 2), 'utf-8');
    }

    // Maintain server accounts registry index
    const indexPath = path.join(DATA_DIR, 'accounts_index.json');
    let list: any[] = [];
    if (fs.existsSync(indexPath)) {
      try {
        list = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      } catch {
        list = [];
      }
    }

    const item = {
      identifier: vault.phone || vault.email || vault.identifier,
      name: vault.name || 'Store Owner',
      phone: vault.phone || '',
      email: vault.email || '',
      storeName: vault.settings?.storeName || 'My Store',
      role: vault.role || 'Owner',
      billsCount: Array.isArray(vault.bills) ? vault.bills.length : 0,
      lastActive: Date.now(),
    };

    const normId = normalizeId(item.identifier);
    const existingIdx = list.findIndex(
      (a: any) =>
        normalizeId(a.identifier) === normId ||
        (a.phone && normalizeId(a.phone) === normalizeId(vault.phone)) ||
        (a.email && normalizeId(a.email) === normalizeId(vault.email))
    );

    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...item };
    } else {
      list.unshift(item);
    }
    fs.writeFileSync(indexPath, JSON.stringify(list, null, 2), 'utf-8');

    return res.json({ success: true, billsSaved: vault.bills?.length || 0 });
  } catch (err: any) {
    console.error('Server vault sync failed:', err);
    return res.status(500).json({ error: err.message || 'Server sync failure' });
  }
});

// Retrieve account vault from server disk
app.get('/api/vault/:identifier', (req, res) => {
  try {
    const rawId = req.params.identifier;
    const norm = normalizeId(rawId);

    // 1. Direct file lookup
    const directPath = getVaultFilePath(rawId);
    if (fs.existsSync(directPath)) {
      const data = JSON.parse(fs.readFileSync(directPath, 'utf-8'));
      return res.json({ success: true, vault: data });
    }

    // 2. Search accounts registry index
    const indexPath = path.join(DATA_DIR, 'accounts_index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const list = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        const match = list.find(
          (a: any) =>
            normalizeId(a.identifier) === norm ||
            normalizeId(a.phone) === norm ||
            normalizeId(a.email) === norm ||
            (norm.length >= 10 && normalizeId(a.phone).endsWith(norm.slice(-10)))
        );
        if (match) {
          const matchedPath =
            getVaultFilePath(match.phone) ||
            getVaultFilePath(match.email) ||
            getVaultFilePath(match.identifier);
          if (fs.existsSync(matchedPath)) {
            const data = JSON.parse(fs.readFileSync(matchedPath, 'utf-8'));
            return res.json({ success: true, vault: data });
          }
        }
      } catch (e) {
        console.warn('Index search failure:', e);
      }
    }

    // 3. Special case for Fahad account
    if (
      norm.includes('9707502246') ||
      norm.includes('uddinfahad') ||
      norm.includes('fahad')
    ) {
      ensureFahadSeed();
      const fahadPath = getVaultFilePath('9707502246');
      if (fs.existsSync(fahadPath)) {
        const data = JSON.parse(fs.readFileSync(fahadPath, 'utf-8'));
        return res.json({ success: true, vault: data });
      }
    }

    return res.status(404).json({ success: false, message: 'Account not found on server' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Append a single bill directly to the server vault
app.post('/api/bills/save', (req, res) => {
  try {
    const { identifier, bill } = req.body;
    if (!identifier || !bill) {
      return res.status(400).json({ error: 'Missing identifier or bill data' });
    }

    const filePath = getVaultFilePath(identifier);
    let vault: any = null;
    if (fs.existsSync(filePath)) {
      vault = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else {
      vault = {
        identifier,
        bills: [],
        cashEntries: [],
        customerDues: [],
        purchaseTrips: [],
        lastActive: Date.now(),
      };
    }

    if (!Array.isArray(vault.bills)) {
      vault.bills = [];
    }

    // Add or update bill
    const existingIdx = vault.bills.findIndex((b: any) => b.id === bill.id);
    if (existingIdx >= 0) {
      vault.bills[existingIdx] = { ...vault.bills[existingIdx], ...bill };
    } else {
      vault.bills.unshift(bill);
    }

    vault.lastActive = Date.now();
    fs.writeFileSync(filePath, JSON.stringify(vault, null, 2), 'utf-8');

    return res.json({ success: true, totalBills: vault.bills.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------- VITE MIDDLEWARE & STATIC SERVING -----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Thermal POS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
