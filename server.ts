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

// Server-side persistent Supabase credentials file
const SUPABASE_CONFIG_FILE = path.join(process.cwd(), 'data', 'supabase_config.json');

function getSavedSupabaseConfig(): { url: string; key: string } {
  try {
    if (fs.existsSync(SUPABASE_CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SUPABASE_CONFIG_FILE, 'utf-8'));
      if (parsed && parsed.url) {
        return { url: parsed.url || '', key: parsed.key || '' };
      }
    }
  } catch (e) {
    console.warn('Error reading supabase config:', e);
  }
  return {
    url: process.env.VITE_SUPABASE_URL || '',
    key: process.env.VITE_SUPABASE_ANON_KEY || '',
  };
}

// ----------------- API ENDPOINTS -----------------

// Supabase shared config across all client devices and browsers
app.get('/api/supabase/config', (_req, res) => {
  const cfg = getSavedSupabaseConfig();
  const isConfigured = Boolean(
    cfg.url &&
    cfg.key &&
    cfg.url.startsWith('https://') &&
    !cfg.url.includes('placeholder')
  );
  res.json({
    url: cfg.url,
    key: cfg.key,
    isConfigured,
  });
});

app.post('/api/supabase/config', (req, res) => {
  try {
    const { url, key } = req.body || {};
    const cleanUrl = (url || '').trim();
    const cleanKey = (key || '').trim();
    fs.writeFileSync(
      SUPABASE_CONFIG_FILE,
      JSON.stringify({ url: cleanUrl, key: cleanKey }, null, 2),
      'utf-8'
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

// Delete a bill from the server vault
app.post('/api/bills/delete', (req, res) => {
  try {
    const { identifier, billId } = req.body;
    if (!identifier || !billId) {
      return res.status(400).json({ error: 'Missing identifier or billId' });
    }

    const norm = normalizeId(identifier);
    const candidates = [identifier];

    // Find any linked identifiers in accounts index
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
          if (match.email) candidates.push(match.email);
          if (match.phone) candidates.push(match.phone);
          if (match.identifier) candidates.push(match.identifier);
        }
      } catch (e) {}
    }

    let deletedCount = 0;
    for (const cand of Array.from(new Set(candidates))) {
      const filePath = getVaultFilePath(cand);
      if (fs.existsSync(filePath)) {
        try {
          const vault = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (Array.isArray(vault.bills)) {
            const initialLen = vault.bills.length;
            vault.bills = vault.bills.filter(
              (b: any) => b.id !== billId && b.invoiceNo !== billId
            );
            if (vault.bills.length !== initialLen) {
              deletedCount++;
              vault.lastActive = Date.now();
              fs.writeFileSync(filePath, JSON.stringify(vault, null, 2), 'utf-8');
            }
          }
        } catch (e) {}
      }
    }

    return res.json({ success: true, deleted: deletedCount > 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete a product from the server vault
app.post('/api/products/delete', (req, res) => {
  try {
    const { identifier, productId } = req.body;
    if (!identifier || !productId) {
      return res.status(400).json({ error: 'Missing identifier or productId' });
    }

    const norm = normalizeId(identifier);
    const candidates = [identifier];

    const indexPath = path.join(DATA_DIR, 'accounts_index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const list = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        const match = list.find(
          (a: any) =>
            normalizeId(a.identifier) === norm ||
            normalizeId(a.phone) === norm ||
            normalizeId(a.email) === norm
        );
        if (match) {
          if (match.email) candidates.push(match.email);
          if (match.phone) candidates.push(match.phone);
          if (match.identifier) candidates.push(match.identifier);
        }
      } catch (e) {}
    }

    for (const cand of Array.from(new Set(candidates))) {
      const filePath = getVaultFilePath(cand);
      if (fs.existsSync(filePath)) {
        try {
          const vault = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (Array.isArray(vault.products)) {
            vault.products = vault.products.filter((p: any) => p.id !== productId);
            vault.lastActive = Date.now();
            fs.writeFileSync(filePath, JSON.stringify(vault, null, 2), 'utf-8');
          }
        } catch (e) {}
      }
    }

    return res.json({ success: true });
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
