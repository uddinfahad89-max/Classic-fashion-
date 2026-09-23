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
    const emailPath = getVaultFilePath('uddinfahad89@gmail.com');
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
        nextInvoiceNumber: 1,
      },
      bills: [],
      cashEntries: [],
      customerDues: [],
      purchaseTrips: [],
      lastActive: Date.now(),
    };

    if (!fs.existsSync(fahadPath)) {
      fs.writeFileSync(fahadPath, JSON.stringify(fahadSeed, null, 2), 'utf-8');
      fs.writeFileSync(emailPath, JSON.stringify(fahadSeed, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Seed initialization error:', err);
  }
}

// Clean any old legacy demo data across all vault files on startup
function cleanAllVaultFiles() {
  try {
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'accounts_index.json') {
          const filePath = path.join(DATA_DIR, file);
          try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            content.bills = [];
            content.cashEntries = [];
            content.customerDues = [];
            content.purchaseTrips = [];
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
          } catch (e) {
            console.error('Error cleaning vault file:', file, e);
          }
        }
      }
      const indexPath = path.join(DATA_DIR, 'accounts_index.json');
      if (fs.existsSync(indexPath)) {
        try {
          const list = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
          for (const item of list) {
            item.billsCount = 0;
          }
          fs.writeFileSync(indexPath, JSON.stringify(list, null, 2), 'utf-8');
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('cleanAllVaultFiles error:', err);
  }
}

cleanAllVaultFiles();
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
          const candidates = [match.email, match.phone, match.identifier].filter(Boolean);
          for (const cand of candidates) {
            const p = getVaultFilePath(cand);
            if (fs.existsSync(p)) {
              const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
              return res.json({ success: true, vault: data });
            }
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
