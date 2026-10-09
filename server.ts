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

// ----------------- CANONICAL VAULT & MULTI-DEVICE BROADCAST ENGINE -----------------

/**
 * Finds the canonical account vault across all linked files and indices.
 * Links together email, phone, and username identifiers so all devices access identical data.
 */
function findCanonicalAccountVault(rawIdentifier: string): { vault: any | null; linkedIds: string[] } {
  const norm = normalizeId(rawIdentifier);
  if (!norm) return { vault: null, linkedIds: [] };

  const linkedIds = new Set<string>();
  linkedIds.add(rawIdentifier);
  linkedIds.add(norm);

  // 1. Check accounts_index.json for matches
  const indexPath = path.join(DATA_DIR, 'accounts_index.json');
  let indexList: any[] = [];
  if (fs.existsSync(indexPath)) {
    try {
      indexList = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      if (Array.isArray(indexList)) {
        for (const item of indexList) {
          const itemEmailNorm = normalizeId(item.email || '');
          const itemPhoneNorm = normalizeId(item.phone || '');
          const itemIdentNorm = normalizeId(item.identifier || '');
          if (
            (itemEmailNorm && itemEmailNorm === norm) ||
            (itemPhoneNorm && itemPhoneNorm === norm) ||
            (itemIdentNorm && itemIdentNorm === norm) ||
            (norm.length >= 10 && itemPhoneNorm && itemPhoneNorm.endsWith(norm.slice(-10)))
          ) {
            if (item.email) linkedIds.add(item.email);
            if (item.phone) linkedIds.add(item.phone);
            if (item.identifier) linkedIds.add(item.identifier);
          }
        }
      }
    } catch {}
  }

  // 2. Scan all vault files in DATA_DIR to link identifiers and find newest vault
  let bestVault: any = null;
  let bestTimestamp = -1;
  let bestBillsCount = -1;

  try {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'accounts_index.json') continue;
      try {
        const filePath = path.join(DATA_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!data) continue;

        const fileEmailNorm = normalizeId(data.email || '');
        const filePhoneNorm = normalizeId(data.phone || '');
        const fileIdentNorm = normalizeId(data.identifier || '');
        const baseNameNorm = normalizeId(file.replace('.json', ''));

        const isMatch = Array.from(linkedIds).some((id) => {
          const idNorm = normalizeId(id);
          return (
            (idNorm && idNorm === fileEmailNorm) ||
            (idNorm && idNorm === filePhoneNorm) ||
            (idNorm && idNorm === fileIdentNorm) ||
            (idNorm && idNorm === baseNameNorm) ||
            (idNorm.length >= 10 && filePhoneNorm && filePhoneNorm.endsWith(idNorm.slice(-10)))
          );
        });

        if (isMatch) {
          if (data.email) linkedIds.add(data.email);
          if (data.phone) linkedIds.add(data.phone);
          if (data.identifier) linkedIds.add(data.identifier);

          const curTime = Number(data.lastActive) || 0;
          const curBills = Array.isArray(data.bills) ? data.bills.length : 0;

          // Pick the vault that is most recent or has the most bills
          if (
            !bestVault ||
            curBills > bestBillsCount ||
            (curBills === bestBillsCount && curTime > bestTimestamp)
          ) {
            bestVault = data;
            bestTimestamp = curTime;
            bestBillsCount = curBills;
          }
        }
      } catch {}
    }
  } catch {}

  const finalLinked = Array.from(linkedIds).filter(Boolean);
  return { vault: bestVault, linkedIds: finalLinked };
}

/**
 * Broadcasts vault data to all linked files and updates accounts index so both devices stay identical.
 */
function broadcastVault(vault: any, additionalIds: string[] = []): void {
  if (!vault) return;
  const ids = new Set<string>(additionalIds);
  if (vault.identifier) ids.add(vault.identifier);
  if (vault.email) ids.add(vault.email);
  if (vault.phone) ids.add(vault.phone);

  const { linkedIds } = findCanonicalAccountVault(vault.email || vault.phone || vault.identifier);
  for (const lid of linkedIds) {
    if (lid) ids.add(lid);
  }

  vault.lastActive = vault.lastActive || Date.now();
  const serialized = JSON.stringify(vault, null, 2);

  for (const id of Array.from(ids)) {
    if (!id) continue;
    const p = getVaultFilePath(id);
    try {
      fs.writeFileSync(p, serialized, 'utf-8');
    } catch (e) {
      console.warn('Error writing vault file for', id, e);
    }
  }

  // Update accounts_index.json
  try {
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
      identifier: vault.email || vault.phone || vault.identifier,
      name: vault.name || 'Store Owner',
      phone: vault.phone || '',
      email: vault.email || '',
      storeName: vault.settings?.storeName || 'My Store',
      role: vault.role || 'Owner',
      billsCount: Array.isArray(vault.bills) ? vault.bills.length : 0,
      lastActive: vault.lastActive,
    };

    const normEmail = normalizeId(item.email);
    const normPhone = normalizeId(item.phone);
    const existingIdx = list.findIndex(
      (a: any) =>
        (normEmail && normalizeId(a.email) === normEmail) ||
        (normPhone && normalizeId(a.phone) === normPhone) ||
        (normalizeId(a.identifier) === normalizeId(item.identifier))
    );

    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...item };
    } else {
      list.unshift(item);
    }
    fs.writeFileSync(indexPath, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error updating accounts_index.json:', e);
  }
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

// Primary authoritative account for seamless auto-restore across any browser or mobile
app.get('/api/accounts/primary', (_req, res) => {
  try {
    const { vault } = findCanonicalAccountVault('uddinfahad89@gmail.com');
    if (vault) {
      return res.json({ success: true, vault });
    }
    // Fallback: check first account in accounts_index.json
    const indexPath = path.join(DATA_DIR, 'accounts_index.json');
    if (fs.existsSync(indexPath)) {
      const list = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      if (Array.isArray(list) && list.length > 0 && list[0].identifier) {
        const fallback = findCanonicalAccountVault(list[0].identifier);
        if (fallback.vault) {
          return res.json({ success: true, vault: fallback.vault });
        }
      }
    }
    return res.status(404).json({ success: false, message: 'No primary account found' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// List all registered accounts stored on server disk (for multi-device account selection)
app.get('/api/accounts', (_req, res) => {
  try {
    const indexPath = path.join(DATA_DIR, 'accounts_index.json');
    let list: any[] = [];
    if (fs.existsSync(indexPath)) {
      try {
        list = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      } catch {
        list = [];
      }
    }
    return res.json({ success: true, accounts: Array.isArray(list) ? list : [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Server-side authentication: verify credentials directly against server vaults
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, phone, identifier, password } = req.body || {};
    const input = (email || phone || identifier || '').trim();
    const cleanPass = (password || '').trim();

    if (!input) {
      return res.status(400).json({
        success: false,
        error: 'ইমেল বা ফোন নম্বর প্রয়োজন।',
      });
    }

    if (!cleanPass) {
      return res.status(400).json({
        success: false,
        error: 'পাসওয়ার্ড প্রয়োজন।',
      });
    }

    const { vault, linkedIds } = findCanonicalAccountVault(input);
    if (!vault) {
      return res.status(404).json({
        success: false,
        error: 'এই ইমেল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। দয়া করে সাইন আপ করুন।',
      });
    }

    // Verify password if saved (allow standard 123456 fallback if user account is configured)
    if (vault.password && vault.password !== cleanPass) {
      return res.status(401).json({
        success: false,
        error: 'পাসওয়ার্ড সঠিক নয়! সঠিক পাসওয়ার্ড লিখুন।',
      });
    }

    // If vault lacked password but matched, save password to vault
    if (!vault.password && cleanPass) {
      vault.password = cleanPass;
    }

    // Synchronize canonical vault to all linked files
    broadcastVault(vault, linkedIds);

    return res.json({
      success: true,
      vault,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Check if an email is already registered on the server (used to prevent duplicate signups)
app.get('/api/auth/check-email/:email', (req, res) => {
  try {
    const rawEmail = req.params.email;
    const { vault } = findCanonicalAccountVault(rawEmail);
    return res.json({ exists: Boolean(vault) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Sync and save complete account vault to server disk and broadcast to all linked devices
app.post('/api/vault/sync', (req, res) => {
  try {
    const incomingVault = req.body;
    if (!incomingVault || (!incomingVault.identifier && !incomingVault.phone && !incomingVault.email)) {
      return res.status(400).json({ error: 'Missing identifier, phone or email' });
    }

    const lookupKey = incomingVault.email || incomingVault.phone || incomingVault.identifier;
    const { vault: existingCanonical, linkedIds } = findCanonicalAccountVault(lookupKey);

    const mergedVault: any = {
      ...(existingCanonical || {}),
      ...incomingVault,
      lastActive: Date.now(),
    };

    // 1. Smart Merge Bills: Never lose bills when a blank/empty device syncs
    const existingBills = Array.isArray(existingCanonical?.bills) ? existingCanonical.bills : [];
    const incomingBills = Array.isArray(incomingVault.bills) ? incomingVault.bills : [];
    const billsMap = new Map<string, any>();
    for (const b of existingBills) {
      if (b && (b.id || b.invoiceNo)) {
        billsMap.set(b.id || b.invoiceNo, b);
      }
    }
    for (const b of incomingBills) {
      if (b && (b.id || b.invoiceNo)) {
        const key = b.id || b.invoiceNo;
        const prev = billsMap.get(key);
        if (!prev || (b.timestamp || 0) >= (prev.timestamp || 0)) {
          billsMap.set(key, { ...prev, ...b });
        }
      }
    }
    mergedVault.bills = Array.from(billsMap.values()).sort(
      (a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0)
    );

    // 2. Smart Merge Products: Never lose products when a blank/empty device syncs
    const existingProducts = Array.isArray(existingCanonical?.products) ? existingCanonical.products : [];
    const incomingProducts = Array.isArray(incomingVault.products) ? incomingVault.products : [];
    const productsMap = new Map<string, any>();
    for (const p of existingProducts) {
      if (p && (p.id || p.name)) {
        productsMap.set(p.id || p.name, p);
      }
    }
    for (const p of incomingProducts) {
      if (p && (p.id || p.name)) {
        const key = p.id || p.name;
        const prev = productsMap.get(key);
        if (!prev || (p.updatedAt || 0) >= (prev.updatedAt || 0)) {
          productsMap.set(key, { ...prev, ...p });
        }
      }
    }
    mergedVault.products = Array.from(productsMap.values());

    // 3. Smart Merge Customer Dues
    const existingDues = Array.isArray(existingCanonical?.customerDues) ? existingCanonical.customerDues : [];
    const incomingDues = Array.isArray(incomingVault.customerDues) ? incomingVault.customerDues : [];
    const duesMap = new Map<string, any>();
    for (const d of existingDues) {
      if (d && (d.id || d.name)) duesMap.set(d.id || d.name, d);
    }
    for (const d of incomingDues) {
      if (d && (d.id || d.name)) {
        const key = d.id || d.name;
        const prev = duesMap.get(key);
        if (!prev || (d.lastUpdated || 0) >= (prev.lastUpdated || 0)) {
          duesMap.set(key, { ...prev, ...d });
        }
      }
    }
    mergedVault.customerDues = Array.from(duesMap.values());

    // 4. Smart Merge Cash Entries
    const existingCash = Array.isArray(existingCanonical?.cashEntries) ? existingCanonical.cashEntries : [];
    const incomingCash = Array.isArray(incomingVault.cashEntries) ? incomingVault.cashEntries : [];
    const cashMap = new Map<string, any>();
    for (const c of existingCash) {
      if (c && c.id) cashMap.set(c.id, c);
    }
    for (const c of incomingCash) {
      if (c && c.id) cashMap.set(c.id, c);
    }
    mergedVault.cashEntries = Array.from(cashMap.values()).sort(
      (a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0)
    );

    // 5. Smart Merge Purchase Trips
    const existingTrips = Array.isArray(existingCanonical?.purchaseTrips) ? existingCanonical.purchaseTrips : [];
    const incomingTrips = Array.isArray(incomingVault.purchaseTrips) ? incomingVault.purchaseTrips : [];
    const tripsMap = new Map<string, any>();
    for (const t of existingTrips) {
      if (t && t.id) tripsMap.set(t.id, t);
    }
    for (const t of incomingTrips) {
      if (t && t.id) tripsMap.set(t.id, t);
    }
    mergedVault.purchaseTrips = Array.from(tripsMap.values());

    // Broadcast merged vault across all linked identifiers
    broadcastVault(mergedVault, linkedIds);

    return res.json({
      success: true,
      billsSaved: mergedVault.bills?.length || 0,
      productsSaved: mergedVault.products?.length || 0,
      vault: mergedVault,
    });
  } catch (err: any) {
    console.error('Server vault sync failed:', err);
    return res.status(500).json({ error: err.message || 'Server sync failure' });
  }
});

// Lightweight version check for multi-device live polling
app.get('/api/vault/:identifier/version', (req, res) => {
  try {
    const rawId = req.params.identifier;
    const { vault } = findCanonicalAccountVault(rawId);
    if (vault) {
      return res.json({
        success: true,
        lastActive: vault.lastActive || 0,
        billsCount: Array.isArray(vault.bills) ? vault.bills.length : 0,
      });
    }
    return res.status(404).json({ success: false });
  } catch {
    return res.status(500).json({ success: false });
  }
});

// Retrieve authoritative canonical account vault from server disk
app.get('/api/vault/:identifier', (req, res) => {
  try {
    const rawId = req.params.identifier;
    const { vault, linkedIds } = findCanonicalAccountVault(rawId);

    if (vault) {
      // Re-broadcast canonical vault to all linked files so both devices stay synchronized
      broadcastVault(vault, linkedIds);
      return res.json({ success: true, vault });
    }

    return res.status(404).json({ success: false, message: 'Account not found on server' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Append or update a single bill directly in the server vault and broadcast to all linked devices
app.post('/api/bills/save', (req, res) => {
  try {
    const { identifier, bill } = req.body;
    if (!identifier || !bill) {
      return res.status(400).json({ error: 'Missing identifier or bill data' });
    }

    const { vault: existingVault, linkedIds } = findCanonicalAccountVault(identifier);
    const vault = existingVault || {
      identifier,
      email: identifier.includes('@') ? identifier : '',
      phone: !identifier.includes('@') ? identifier : '',
      bills: [],
      cashEntries: [],
      customerDues: [],
      purchaseTrips: [],
      lastActive: Date.now(),
    };

    if (!Array.isArray(vault.bills)) {
      vault.bills = [];
    }

    const existingIdx = vault.bills.findIndex((b: any) => b.id === bill.id);
    if (existingIdx >= 0) {
      vault.bills[existingIdx] = { ...vault.bills[existingIdx], ...bill };
    } else {
      vault.bills.unshift(bill);
    }

    vault.lastActive = Date.now();
    broadcastVault(vault, linkedIds);

    return res.json({ success: true, totalBills: vault.bills.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete a bill from the server vault across all linked devices
app.post('/api/bills/delete', (req, res) => {
  try {
    const { identifier, billId } = req.body;
    if (!identifier || !billId) {
      return res.status(400).json({ error: 'Missing identifier or billId' });
    }

    const { vault, linkedIds } = findCanonicalAccountVault(identifier);
    if (vault && Array.isArray(vault.bills)) {
      vault.bills = vault.bills.filter((b: any) => b.id !== billId && b.invoiceNo !== billId);
      vault.lastActive = Date.now();
      broadcastVault(vault, linkedIds);
      return res.json({ success: true, deleted: true });
    }

    return res.json({ success: true, deleted: false });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Append or update a single product directly in the server vault and broadcast to all linked devices
app.post('/api/products/save', (req, res) => {
  try {
    const { identifier, product } = req.body;
    if (!identifier || !product) {
      return res.status(400).json({ error: 'Missing identifier or product data' });
    }

    const { vault: existingVault, linkedIds } = findCanonicalAccountVault(identifier);
    const vault = existingVault || {
      identifier,
      email: identifier.includes('@') ? identifier : '',
      phone: !identifier.includes('@') ? identifier : '',
      bills: [],
      cashEntries: [],
      customerDues: [],
      purchaseTrips: [],
      products: [],
      lastActive: Date.now(),
    };

    if (!Array.isArray(vault.products)) {
      vault.products = [];
    }

    const existingIdx = vault.products.findIndex(
      (p: any) => p.id === product.id || (product.name && p.name === product.name)
    );
    if (existingIdx >= 0) {
      vault.products[existingIdx] = { ...vault.products[existingIdx], ...product };
    } else {
      vault.products.unshift(product);
    }

    vault.lastActive = Date.now();
    broadcastVault(vault, linkedIds);

    return res.json({ success: true, totalProducts: vault.products.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete a product from the server vault across all linked devices
app.post('/api/products/delete', (req, res) => {
  try {
    const { identifier, productId } = req.body;
    if (!identifier || !productId) {
      return res.status(400).json({ error: 'Missing identifier or productId' });
    }

    const { vault, linkedIds } = findCanonicalAccountVault(identifier);
    if (vault && Array.isArray(vault.products)) {
      vault.products = vault.products.filter((p: any) => p.id !== productId);
      vault.lastActive = Date.now();
      broadcastVault(vault, linkedIds);
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
