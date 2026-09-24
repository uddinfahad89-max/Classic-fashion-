import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import {
  BillInvoice,
  CashEntry,
  CustomerDue,
  DueType,
  ThermalPrinterSettings,
  UserProfile,
  PurchaseTrip,
} from '../types';

export const SUPABASE_SQL_SETUP_SCRIPT = `-- ==============================================================================
-- MULTI-USER CLOUD POS & BILLING DATABASE SETUP SCRIPT FOR SUPABASE
-- Run this complete script inside your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. Enable UUID Extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles & Shop Settings Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  store_name TEXT,
  store_phone TEXT,
  store_address TEXT,
  signatory_name TEXT,
  upi_id TEXT,
  paper_width TEXT DEFAULT '58mm',
  currency_symbol TEXT DEFAULT 'Rs.',
  currency_name TEXT DEFAULT 'Rupees',
  hide_currency_symbol BOOLEAN DEFAULT false,
  footer_note TEXT DEFAULT 'Thank you! Visit again.',
  auto_print_on_checkout BOOLEAN DEFAULT true,
  default_invoice_format TEXT DEFAULT 'tax_invoice',
  next_invoice_number INTEGER DEFAULT 1,
  invoice_prefix TEXT DEFAULT '',
  settings_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Invoices / Bills Table (Multi-User Isolated by user_id)
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2) DEFAULT 0,
  tax NUMERIC(12, 2) DEFAULT 0,
  discount NUMERIC(12, 2) DEFAULT 0,
  grand_total NUMERIC(12, 2) DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'completed',
  timestamp BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Daily Cashbook / Daybook Table
CREATE TABLE IF NOT EXISTS public.cash_entries (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  timestamp BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Customer Dues / Khatabook Table
CREATE TABLE IF NOT EXISTS public.customer_dues (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  total_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_type TEXT DEFAULT 'customer',
  transactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Purchase Trip Manager Table
CREATE TABLE IF NOT EXISTS public.purchase_trips (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  market_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  initial_cash NUMERIC(12, 2) DEFAULT 0,
  remaining_cash NUMERIC(12, 2) DEFAULT 0,
  total_spent NUMERIC(12, 2) DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - ENSURES 100% USER DATA ISOLATION
-- User A can NEVER see or modify User B's shop data, bills, or dues!
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_trips ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Invoices Policies
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
CREATE POLICY "invoices_select_policy" ON public.invoices FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
CREATE POLICY "invoices_insert_policy" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
CREATE POLICY "invoices_update_policy" ON public.invoices FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;
CREATE POLICY "invoices_delete_policy" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

-- Cash Entries Policies
DROP POLICY IF EXISTS "cash_entries_select_policy" ON public.cash_entries;
CREATE POLICY "cash_entries_select_policy" ON public.cash_entries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cash_entries_insert_policy" ON public.cash_entries;
CREATE POLICY "cash_entries_insert_policy" ON public.cash_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cash_entries_update_policy" ON public.cash_entries;
CREATE POLICY "cash_entries_update_policy" ON public.cash_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cash_entries_delete_policy" ON public.cash_entries;
CREATE POLICY "cash_entries_delete_policy" ON public.cash_entries FOR DELETE USING (auth.uid() = user_id);

-- Customer Dues Policies
DROP POLICY IF EXISTS "customer_dues_select_policy" ON public.customer_dues;
CREATE POLICY "customer_dues_select_policy" ON public.customer_dues FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "customer_dues_insert_policy" ON public.customer_dues;
CREATE POLICY "customer_dues_insert_policy" ON public.customer_dues FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "customer_dues_update_policy" ON public.customer_dues;
CREATE POLICY "customer_dues_update_policy" ON public.customer_dues FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "customer_dues_delete_policy" ON public.customer_dues;
CREATE POLICY "customer_dues_delete_policy" ON public.customer_dues FOR DELETE USING (auth.uid() = user_id);

-- Purchase Trips Policies
DROP POLICY IF EXISTS "purchase_trips_select_policy" ON public.purchase_trips;
CREATE POLICY "purchase_trips_select_policy" ON public.purchase_trips FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "purchase_trips_insert_policy" ON public.purchase_trips;
CREATE POLICY "purchase_trips_insert_policy" ON public.purchase_trips FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "purchase_trips_update_policy" ON public.purchase_trips;
CREATE POLICY "purchase_trips_update_policy" ON public.purchase_trips FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "purchase_trips_delete_policy" ON public.purchase_trips;
CREATE POLICY "purchase_trips_delete_policy" ON public.purchase_trips FOR DELETE USING (auth.uid() = user_id);

-- 7. Trigger to automatically handle new auth user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, store_name, signatory_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
`;

export interface RestoredUserData {
  settings: ThermalPrinterSettings;
  bills: BillInvoice[];
  cashEntries: CashEntry[];
  customerDues: CustomerDue[];
  purchaseTrips: PurchaseTrip[];
  userProfile: UserProfile;
}

class SupabaseService {
  isConfigured(): boolean {
    return isSupabaseConfigured();
  }

  // Get active user ID if authenticated
  async getActiveUserId(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.user?.id || null;
    } catch {
      return null;
    }
  }

  // User Sign Up
  async signUp(
    email: string,
    password: string,
    shopData: {
      storeName: string;
      phone: string;
      storeAddress?: string;
      name?: string;
    }
  ): Promise<{ success: boolean; error?: string; user?: any; session?: any }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = shopData.phone.trim();
      const cleanStoreName = shopData.storeName.trim();
      const cleanName = shopData.name?.trim() || cleanStoreName || 'Store Owner';

      // 1. Supabase Auth Sign Up
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            phone: cleanPhone,
            store_name: cleanStoreName,
            name: cleanName,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const user = data.user;
      if (!user) {
        return { success: false, error: 'Registration failed. No user returned.' };
      }

      // 2. Insert initial profile row in profiles table
      try {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: cleanEmail,
            phone: cleanPhone,
            store_name: cleanStoreName,
            store_phone: cleanPhone,
            store_address: shopData.storeAddress?.trim() || '',
            signatory_name: cleanName,
            upi_id: '',
            paper_width: '58mm',
            currency_symbol: 'Rs.',
            currency_name: 'Rupees',
            footer_note: 'Thank you! Visit again.',
            auto_print_on_checkout: true,
            default_invoice_format: 'tax_invoice',
            next_invoice_number: 1,
            invoice_prefix: '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (profileErr) {
        console.warn('Profile upsert notice:', profileErr);
      }

      return { success: true, user, session: data.session };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed' };
    }
  }

  // User Login & Automatic Cloud Data Restore
  async signIn(
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    error?: string;
    restored?: RestoredUserData;
    user?: any;
  }> {
    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Login failed. No user found.' };
      }

      // Restore all data for this specific user
      const restored = await this.restoreUserData(data.user.id, data.user.email || cleanEmail);

      return {
        success: true,
        user: data.user,
        restored,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  }

  // Sign out user
  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out notice:', e);
    }
  }

  // Restore that specific user's shop profile, daily transactions, dues, and cashbook
  async restoreUserData(userId: string, userEmail: string = ''): Promise<RestoredUserData> {
    const defaultSettings: ThermalPrinterSettings = {
      storeName: '',
      storePhone: '',
      storeAddress: '',
      signatoryName: '',
      upiId: '',
      paperWidth: '58mm',
      currencySymbol: 'Rs.',
      currencyName: 'Rupees',
      hideCurrencySymbol: false,
      footerNote: 'Thank you! Visit again.',
      autoPrintOnCheckout: true,
      defaultInvoiceFormat: 'tax_invoice',
      isDataSaverEnabled: false,
      invoicePrefix: '',
      nextInvoiceNumber: 1,
      isLabelMode: false,
    };

    let settings = { ...defaultSettings };
    let bills: BillInvoice[] = [];
    let cashEntries: CashEntry[] = [];
    let customerDues: CustomerDue[] = [];
    let purchaseTrips: PurchaseTrip[] = [];

    const userProfile: UserProfile = {
      email: userEmail,
      name: 'Store Owner',
      phone: '',
      role: 'Owner',
      pin: '1234',
      isAppLockEnabled: false,
      isLoggedIn: true,
      loginTime: Date.now(),
      loginMethod: 'email_pin',
      otpVerified: true,
    };

    try {
      // 1. Fetch Profile
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileRow) {
        settings = {
          ...settings,
          storeName: profileRow.store_name || '',
          storePhone: profileRow.store_phone || profileRow.phone || '',
          storeAddress: profileRow.store_address || '',
          signatoryName: profileRow.signatory_name || '',
          upiId: profileRow.upi_id || '',
          paperWidth: profileRow.paper_width || '58mm',
          currencySymbol: profileRow.currency_symbol || 'Rs.',
          currencyName: profileRow.currency_name || 'Rupees',
          hideCurrencySymbol: Boolean(profileRow.hide_currency_symbol),
          footerNote: profileRow.footer_note || 'Thank you! Visit again.',
          autoPrintOnCheckout: profileRow.auto_print_on_checkout !== false,
          defaultInvoiceFormat: profileRow.default_invoice_format || 'tax_invoice',
          nextInvoiceNumber: profileRow.next_invoice_number || 1,
          invoicePrefix: profileRow.invoice_prefix || '',
          ...(profileRow.settings_json || {}),
        };

        userProfile.name = profileRow.signatory_name || profileRow.store_name || 'Store Owner';
        userProfile.phone = profileRow.phone || profileRow.store_phone || '';
        userProfile.email = profileRow.email || userEmail;
      }

      // 2. Fetch Invoices (Strictly isolated by user_id)
      const { data: invoiceRows } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (Array.isArray(invoiceRows)) {
        bills = invoiceRows.map((row) => ({
          id: row.id,
          invoiceNo: row.invoice_no,
          date: row.date,
          time: row.time,
          customerName: row.customer_name || '',
          customerPhone: row.customer_phone || '',
          items: Array.isArray(row.items) ? row.items : [],
          subtotal: Number(row.subtotal) || 0,
          discount: Number(row.discount) || 0,
          grandTotal: Number(row.grand_total) || 0,
          paymentMethod: row.payment_method || 'cash',
          paidAmount: Number(row.grand_total) || 0,
          changeAmount: 0,
          timestamp: Number(row.timestamp) || Date.now(),
        }));
      }

      // 3. Fetch Cashbook Entries (Strictly isolated by user_id)
      const { data: cashRows } = await supabase
        .from('cash_entries')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (Array.isArray(cashRows)) {
        cashEntries = cashRows.map((row) => ({
          id: row.id,
          type: (row.type === 'Expense' || row.type === 'cash_out' ? 'Expense' : 'Income'),
          amount: Number(row.amount) || 0,
          note: row.description || row.note || '',
          dateFormatted: row.date || new Date().toLocaleDateString(),
          timestamp: Number(row.timestamp) || Date.now(),
        }));
      }

      // 4. Fetch Customer Dues (Strictly isolated by user_id)
      const { data: duesRows } = await supabase
        .from('customer_dues')
        .select('*')
        .eq('user_id', userId);

      if (Array.isArray(duesRows)) {
        customerDues = duesRows.map((row) => ({
          id: row.id,
          name: row.customer_name || '',
          phone: row.customer_phone || '',
          dueAmount: Number(row.total_due) || 0,
          type: (row.due_type || 'receivable') as DueType,
          transactions: Array.isArray(row.transactions) ? row.transactions : [],
          lastUpdated: Date.now(),
        }));
      }

      // 5. Fetch Purchase Trips (Strictly isolated by user_id)
      const { data: tripRows } = await supabase
        .from('purchase_trips')
        .select('*')
        .eq('user_id', userId);

      if (Array.isArray(tripRows)) {
        purchaseTrips = tripRows.map((row) => ({
          id: row.id,
          title: row.title,
          marketLocation: row.market_name || '',
          dateFormatted: row.start_date || new Date().toLocaleDateString(),
          status: (row.status || 'active') as 'active' | 'completed',
          initialCash: Number(row.initial_cash) || 0,
          remainingCash: Number(row.remaining_cash) || 0,
          totalSpent: Number(row.total_spent) || 0,
          timestamp: Date.now(),
          expenses: Array.isArray(row.items) ? row.items : [],
        }));
      }
    } catch (fetchErr) {
      console.error('Supabase cloud restore error:', fetchErr);
    }

    return {
      settings,
      bills,
      cashEntries,
      customerDues,
      purchaseTrips,
      userProfile,
    };
  }

  // Sync a single invoice to Supabase cloud
  async syncInvoice(invoice: BillInvoice, userId: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const { error } = await supabase.from('invoices').upsert(
        {
          id: invoice.id,
          user_id: userId,
          invoice_no: invoice.invoiceNo,
          date: invoice.date,
          time: invoice.time || '',
          customer_name: invoice.customerName || '',
          customer_phone: invoice.customerPhone || '',
          items: invoice.items,
          subtotal: invoice.subtotal,
          tax: 0,
          discount: invoice.discount,
          grand_total: invoice.grandTotal,
          payment_method: invoice.paymentMethod,
          status: invoice.paymentStatus || 'PAID',
          timestamp: invoice.timestamp || Date.now(),
        },
        { onConflict: 'id' }
      );
      if (error) {
        console.warn('Sync invoice error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Sync invoice exception:', e);
      return false;
    }
  }

  // Delete invoice from Supabase cloud
  async deleteInvoice(invoiceId: string, userId: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId)
        .eq('user_id', userId);
      return !error;
    } catch {
      return false;
    }
  }

  // Sync a cashbook entry to Supabase cloud
  async syncCashEntry(entry: CashEntry, userId: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const { error } = await supabase.from('cash_entries').upsert(
        {
          id: entry.id,
          user_id: userId,
          type: entry.type,
          amount: entry.amount,
          category: entry.type,
          description: entry.note || '',
          date: entry.dateFormatted || new Date().toISOString(),
          time: '',
          timestamp: entry.timestamp || Date.now(),
        },
        { onConflict: 'id' }
      );
      return !error;
    } catch {
      return false;
    }
  }

  // Delete cash entry from Supabase cloud
  async deleteCashEntry(entryId: string, userId: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const { error } = await supabase
        .from('cash_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId);
      return !error;
    } catch {
      return false;
    }
  }

  // Sync a customer due to Supabase cloud
  async syncCustomerDue(due: CustomerDue, userId: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const { error } = await supabase.from('customer_dues').upsert(
        {
          id: due.id,
          user_id: userId,
          customer_name: due.name,
          customer_phone: due.phone,
          total_due: due.dueAmount,
          due_type: due.type || 'receivable',
          transactions: due.transactions || [],
          notes: '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      return !error;
    } catch {
      return false;
    }
  }

  // Delete customer due from Supabase cloud
  async deleteCustomerDue(dueId: string, userId: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const { error } = await supabase
        .from('customer_dues')
        .delete()
        .eq('id', dueId)
        .eq('user_id', userId);
      return !error;
    } catch {
      return false;
    }
  }

  // Sync shop profile & settings to Supabase cloud
  async syncProfile(
    settings: ThermalPrinterSettings,
    userProfile: UserProfile,
    userId: string
  ): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: userId,
          email: userProfile.email || '',
          phone: userProfile.phone || settings.storePhone || '',
          store_name: settings.storeName || '',
          store_phone: settings.storePhone || userProfile.phone || '',
          store_address: settings.storeAddress || '',
          signatory_name: settings.signatoryName || userProfile.name || '',
          upi_id: settings.upiId || '',
          paper_width: settings.paperWidth || '58mm',
          currency_symbol: settings.currencySymbol || 'Rs.',
          currency_name: settings.currencyName || 'Rupees',
          hide_currency_symbol: Boolean(settings.hideCurrencySymbol),
          footer_note: settings.footerNote || 'Thank you! Visit again.',
          auto_print_on_checkout: settings.autoPrintOnCheckout !== false,
          default_invoice_format: settings.defaultInvoiceFormat || 'tax_invoice',
          next_invoice_number: settings.nextInvoiceNumber || 1,
          invoice_prefix: settings.invoicePrefix || '',
          settings_json: settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      return !error;
    } catch {
      return false;
    }
  }
}

export const supabaseService = new SupabaseService();
