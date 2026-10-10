import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import {
  BillInvoice,
  CashEntry,
  CustomerDue,
  DueType,
  ThermalPrinterSettings,
  UserProfile,
  PurchaseTrip,
  ProductStockItem,
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
  shop_id TEXT,
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
  inventory_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Invoices / Bills Table (Multi-User Isolated by user_id & shop_id)
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id TEXT,
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
  shop_id TEXT,
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
  shop_id TEXT,
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
  shop_id TEXT,
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

-- 7. Product Inventory Table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id TEXT,
  name TEXT NOT NULL,
  price NUMERIC(12, 2) DEFAULT 0,
  purchase_price NUMERIC(12, 2) DEFAULT 0,
  stock NUMERIC(12, 2) DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  category TEXT DEFAULT '',
  barcode TEXT DEFAULT '',
  updated_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Migrations for existing tables: Add shop_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'shop_id') THEN
    ALTER TABLE public.profiles ADD COLUMN shop_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'inventory_json') THEN
    ALTER TABLE public.profiles ADD COLUMN inventory_json JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'shop_id') THEN
    ALTER TABLE public.invoices ADD COLUMN shop_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cash_entries' AND column_name = 'shop_id') THEN
    ALTER TABLE public.cash_entries ADD COLUMN shop_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customer_dues' AND column_name = 'shop_id') THEN
    ALTER TABLE public.customer_dues ADD COLUMN shop_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_trips' AND column_name = 'shop_id') THEN
    ALTER TABLE public.purchase_trips ADD COLUMN shop_id TEXT;
  END IF;
END $$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - ENSURES USER ACCOUNT LINKING & ISOLATION
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Profiles Policies: allow read & upsert for account linking
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

-- Invoices Policies: queryable by master owner user_id or shop_id
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
CREATE POLICY "invoices_select_policy" ON public.invoices FOR SELECT USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
CREATE POLICY "invoices_insert_policy" ON public.invoices FOR INSERT WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
CREATE POLICY "invoices_update_policy" ON public.invoices FOR UPDATE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
) WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;
CREATE POLICY "invoices_delete_policy" ON public.invoices FOR DELETE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

-- Cash Entries Policies
DROP POLICY IF EXISTS "cash_entries_select_policy" ON public.cash_entries;
CREATE POLICY "cash_entries_select_policy" ON public.cash_entries FOR SELECT USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "cash_entries_insert_policy" ON public.cash_entries;
CREATE POLICY "cash_entries_insert_policy" ON public.cash_entries FOR INSERT WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "cash_entries_update_policy" ON public.cash_entries;
CREATE POLICY "cash_entries_update_policy" ON public.cash_entries FOR UPDATE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
) WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "cash_entries_delete_policy" ON public.cash_entries;
CREATE POLICY "cash_entries_delete_policy" ON public.cash_entries FOR DELETE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

-- Customer Dues Policies
DROP POLICY IF EXISTS "customer_dues_select_policy" ON public.customer_dues;
CREATE POLICY "customer_dues_select_policy" ON public.customer_dues FOR SELECT USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "customer_dues_insert_policy" ON public.customer_dues;
CREATE POLICY "customer_dues_insert_policy" ON public.customer_dues FOR INSERT WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "customer_dues_update_policy" ON public.customer_dues;
CREATE POLICY "customer_dues_update_policy" ON public.customer_dues FOR UPDATE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
) WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "customer_dues_delete_policy" ON public.customer_dues;
CREATE POLICY "customer_dues_delete_policy" ON public.customer_dues FOR DELETE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

-- Purchase Trips Policies
DROP POLICY IF EXISTS "purchase_trips_select_policy" ON public.purchase_trips;
CREATE POLICY "purchase_trips_select_policy" ON public.purchase_trips FOR SELECT USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "purchase_trips_insert_policy" ON public.purchase_trips;
CREATE POLICY "purchase_trips_insert_policy" ON public.purchase_trips FOR INSERT WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "purchase_trips_update_policy" ON public.purchase_trips;
CREATE POLICY "purchase_trips_update_policy" ON public.purchase_trips FOR UPDATE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
) WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "purchase_trips_delete_policy" ON public.purchase_trips;
CREATE POLICY "purchase_trips_delete_policy" ON public.purchase_trips FOR DELETE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

-- Products Policies
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
CREATE POLICY "products_select_policy" ON public.products FOR SELECT USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
CREATE POLICY "products_insert_policy" ON public.products FOR INSERT WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "products_update_policy" ON public.products;
CREATE POLICY "products_update_policy" ON public.products FOR UPDATE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
) WITH CHECK (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "products_delete_policy" ON public.products;
CREATE POLICY "products_delete_policy" ON public.products FOR DELETE USING (
  auth.uid() = user_id OR (shop_id IS NOT NULL AND shop_id = auth.uid()::text) OR auth.role() = 'anon'
);

-- 8. Trigger to automatically handle new auth user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, shop_id, email, phone, store_name, signatory_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'shop_id', NEW.id::text),
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
  products: ProductStockItem[];
  userProfile: UserProfile;
}

class SupabaseService {
  isConfigured(): boolean {
    return isSupabaseConfigured();
  }

  // Helper to extract clean digits for phone lookup (last 10 digits for matching Bangladesh/India numbers)
  extractCorePhone(phone: string): string {
    const digits = (phone || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    return digits.length > 10 ? digits.slice(-10) : digits;
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

  // Find master owner profile across Supabase profiles by phone, email, username or shop_id
  async findMasterProfile(identifier: string): Promise<any | null> {
    if (!identifier || !this.isConfigured()) return null;
    const raw = identifier.trim();
    const cleanEmail = raw.toLowerCase();
    const corePhone = this.extractCorePhone(raw);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

    try {
      // 1. Direct UUID match on id
      if (isUuid) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', raw)
          .maybeSingle();
        if (data) return data;
      }

      // 2. Email match (exact or case-insensitive)
      if (cleanEmail.includes('@')) {
        const { data: emailRows } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', cleanEmail)
          .limit(5);
        if (Array.isArray(emailRows) && emailRows.length > 0) {
          const best =
            emailRows.find(
              (p) =>
                (p.store_name && p.store_name !== 'My Store') ||
                p.phone ||
                (p.signatory_name && !p.signatory_name.startsWith('User '))
            ) || emailRows[0];
          return best;
        }
      }

      // 3. Phone matching (exact or last 10 digits match on phone or store_phone)
      if (corePhone.length >= 6) {
        const { data: phoneRows } = await supabase
          .from('profiles')
          .select('*')
          .or(`phone.ilike.%${corePhone}%,store_phone.ilike.%${corePhone}%,email.ilike.%${corePhone}%`)
          .limit(5);

        if (Array.isArray(phoneRows) && phoneRows.length > 0) {
          // Prefer profile with real name or existing store
          const best =
            phoneRows.find(
              (p) => p.signatory_name && !p.signatory_name.startsWith('User ')
            ) || phoneRows[0];
          return best;
        }
      }

      // 4. Shop ID or signatory name / username match
      const { data: nameRows } = await supabase
        .from('profiles')
        .select('*')
        .or(`signatory_name.ilike.${raw},store_name.ilike.${raw},shop_id.eq.${raw}`)
        .limit(5);

      if (Array.isArray(nameRows) && nameRows.length > 0) {
        return nameRows[0];
      }

      return null;
    } catch (err) {
      console.warn('findMasterProfile notice:', err);
      return null;
    }
  }

  // User Sign Up with Account Linking prevention of duplicate shadow profiles
  async signUp(
    email: string,
    password: string,
    shopData: {
      storeName: string;
      phone: string;
      storeAddress?: string;
      name?: string;
    }
  ): Promise<{ success: boolean; error?: string; user?: any; session?: any; masterShopId?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = shopData.phone.trim();
      const cleanStoreName = shopData.storeName.trim();

      // Check if this phone or email already has an existing master profile
      const existingProfile = await this.findMasterProfile(cleanPhone || cleanEmail);

      // Prevent shadow name like "User 1959": prefer existing signatory_name, user input, or store name
      let cleanName = shopData.name?.trim();
      if (!cleanName || cleanName.startsWith('User ')) {
        if (existingProfile?.signatory_name && !existingProfile.signatory_name.startsWith('User ')) {
          cleanName = existingProfile.signatory_name;
        } else if (cleanStoreName && cleanStoreName !== 'My Store') {
          cleanName = cleanStoreName;
        } else if (cleanEmail && !cleanEmail.endsWith('@posstore.com')) {
          cleanName = cleanEmail.split('@')[0];
        } else {
          cleanName = cleanName || 'Store Owner';
        }
      }

      // 1. Supabase Auth Sign Up
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            phone: cleanPhone,
            store_name: cleanStoreName || existingProfile?.store_name || '',
            name: cleanName,
            shop_id: existingProfile?.shop_id || existingProfile?.id || '',
          },
        },
      });

      if (error) {
        if (
          error.message?.toLowerCase().includes('already registered') ||
          error.message?.toLowerCase().includes('already in use')
        ) {
          return {
            success: false,
            error: 'এই ইমেল দিয়ে ইতোমধ্যে অ্যাকাউন্ট খোলা আছে! দয়া করে লগইন করুন।',
          };
        }
        return { success: false, error: error.message };
      }

      const user = data.user;
      if (!user) {
        return { success: false, error: 'Registration failed. No user returned.' };
      }

      // Supabase returns an empty identities array if the user already exists (when email confirmation is on)
      if (Array.isArray(user.identities) && user.identities.length === 0) {
        return {
          success: false,
          error: 'এই ইমেল দিয়ে ইতোমধ্যে অ্যাকাউন্ট খোলা আছে! দয়া করে লগইন করুন।',
        };
      }

      const masterShopId = existingProfile?.shop_id || existingProfile?.id || user.id;

      // 2. Insert or update profile row in profiles table with linked shop_id
      try {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            shop_id: masterShopId,
            email: cleanEmail,
            phone: cleanPhone,
            store_name: cleanStoreName || existingProfile?.store_name || '',
            store_phone: cleanPhone || existingProfile?.store_phone || '',
            store_address: shopData.storeAddress?.trim() || existingProfile?.store_address || '',
            signatory_name: cleanName,
            upi_id: existingProfile?.upi_id || '',
            paper_width: existingProfile?.paper_width || '58mm',
            currency_symbol: existingProfile?.currency_symbol || 'Rs.',
            currency_name: existingProfile?.currency_name || 'Rupees',
            footer_note: existingProfile?.footer_note || 'Thank you! Visit again.',
            auto_print_on_checkout: existingProfile?.auto_print_on_checkout !== false,
            default_invoice_format: existingProfile?.default_invoice_format || 'tax_invoice',
            next_invoice_number: existingProfile?.next_invoice_number || 1,
            invoice_prefix: existingProfile?.invoice_prefix || '',
            settings_json: existingProfile?.settings_json || {},
            inventory_json: existingProfile?.inventory_json || [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (profileErr) {
        console.warn('Profile upsert notice:', profileErr);
      }

      return { success: true, user, session: data.session, masterShopId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed' };
    }
  }

  // User Login & Automatic Cloud Data Restore across linked shop accounts
  async signIn(
    emailOrIdentifier: string,
    password: string
  ): Promise<{
    success: boolean;
    error?: string;
    restored?: RestoredUserData;
    user?: any;
  }> {
    try {
      const raw = emailOrIdentifier.trim();
      let targetEmail = raw.toLowerCase();

      // If user typed phone or username instead of email, resolve to registered email
      if (!targetEmail.includes('@')) {
        const master = await this.findMasterProfile(raw);
        if (master?.email) {
          targetEmail = master.email;
        } else {
          const core = this.extractCorePhone(raw);
          targetEmail = `${core || raw.replace(/[^\d]/g, '')}@posstore.com`;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Login failed. No user found.' };
      }

      // Restore all data for this master owner / shop
      const restored = await this.restoreUserData(data.user.id, data.user.email || targetEmail, raw);

      return {
        success: true,
        user: data.user,
        restored,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  }

  // Restore cloud data by Phone or OTP verification without password
  async restoreUserDataByPhoneOrEmail(identifier: string): Promise<{
    success: boolean;
    restored?: RestoredUserData;
    masterProfile?: any;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Supabase is not configured' };
    }
    try {
      const masterProfile = await this.findMasterProfile(identifier);
      if (!masterProfile) {
        return { success: false, error: 'No matching cloud account found' };
      }

      const restored = await this.restoreUserData(
        masterProfile.id,
        masterProfile.email || '',
        masterProfile.phone || identifier
      );

      return {
        success: true,
        restored,
        masterProfile,
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'Cloud data restore failed' };
    }
  }

  // Reset password via email link
  async resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Supabase is not configured' };
    }
    try {
      const cleanEmail = email.trim().toLowerCase();
      const redirectUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : '';
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Password reset request failed' };
    }
  }

  // Update password after recovery link click
  async updateUserPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Supabase is not configured' };
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password' };
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

  // Restore that specific user's shop profile, inventory, daily transactions, dues, and daybook
  // Querying using master owner ID or shop_id
  async restoreUserData(
    targetIdOrIdentifier: string,
    userEmail: string = '',
    userPhone: string = ''
  ): Promise<RestoredUserData> {
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
    let products: ProductStockItem[] = [];

    const userProfile: UserProfile = {
      email: userEmail,
      name: 'Store Owner',
      phone: userPhone,
      role: 'Owner',
      pin: '1234',
      isAppLockEnabled: false,
      isLoggedIn: true,
      loginTime: Date.now(),
      loginMethod: 'email_pin',
      otpVerified: true,
    };

    try {
      // 1. Resolve master profile and master shop_id
      const masterProfile = await this.findMasterProfile(
        targetIdOrIdentifier || userPhone || userEmail
      );

      const masterUserId = masterProfile?.id || targetIdOrIdentifier;
      const masterShopId = masterProfile?.shop_id || masterProfile?.id || targetIdOrIdentifier;

      if (masterProfile) {
        settings = {
          ...settings,
          storeName: masterProfile.store_name || '',
          storePhone: masterProfile.store_phone || masterProfile.phone || userPhone || '',
          storeAddress: masterProfile.store_address || '',
          signatoryName: masterProfile.signatory_name || '',
          upiId: masterProfile.upi_id || '',
          paperWidth: masterProfile.paper_width || '58mm',
          currencySymbol: masterProfile.currency_symbol || 'Rs.',
          currencyName: masterProfile.currency_name || 'Rupees',
          hideCurrencySymbol: Boolean(masterProfile.hide_currency_symbol),
          footerNote: masterProfile.footer_note || 'Thank you! Visit again.',
          autoPrintOnCheckout: masterProfile.auto_print_on_checkout !== false,
          defaultInvoiceFormat: masterProfile.default_invoice_format || 'tax_invoice',
          nextInvoiceNumber: masterProfile.next_invoice_number || 1,
          invoicePrefix: masterProfile.invoice_prefix || '',
          ...(masterProfile.settings_json || {}),
        };

        // Prevent creating duplicate shadow profile name like "User 1959" vs real email name
        let resolvedName = masterProfile.signatory_name || masterProfile.store_name || '';
        if (!resolvedName || resolvedName.startsWith('User ')) {
          const emailPart = (masterProfile.email || userEmail).split('@')[0];
          if (emailPart && !emailPart.endsWith('posstore.com')) {
            resolvedName = emailPart;
          } else if (!resolvedName) {
            resolvedName = 'Store Owner';
          }
        }

        userProfile.name = resolvedName;
        userProfile.phone = masterProfile.phone || masterProfile.store_phone || userPhone;
        userProfile.email = masterProfile.email || userEmail;
        userProfile.shopId = masterShopId;
        userProfile.ownerId = masterUserId;
      } else {
        // Fallback: Read from Supabase Auth user_metadata directly
        try {
          const { data: authUserData } = await supabase.auth.getUser();
          const meta = authUserData?.user?.user_metadata;
          if (meta) {
            if (meta.store_name) {
              settings.storeName = meta.store_name;
            }
            if (meta.name) {
              userProfile.name = meta.name;
            }
            if (meta.phone) {
              userProfile.phone = meta.phone;
            }
          }
        } catch {}
      }

      // 2. Fetch Invoices and/or Transactions using authenticated user's ID (auth.uid())
      // Query 'invoices' table using user_id = masterUserId
      try {
        let invRes = await supabase
          .from('invoices')
          .select('*')
          .eq('user_id', masterUserId);

        const invoiceRows = invRes.data;
        if (!invRes.error && Array.isArray(invoiceRows) && invoiceRows.length > 0) {
          bills = invoiceRows.map((row, idx) => {
            const rawTs = Number(row.timestamp) || (row.created_at ? new Date(row.created_at).getTime() : Date.now());
            const dt = new Date(rawTs);
            const total = Number(row.grand_total ?? row.subtotal ?? row.amount ?? 0);
            return {
              id: String(row.id || `inv-${idx}`),
              invoiceNo: String(row.invoice_no || row.id?.slice(-4) || idx + 1),
              date: row.date || dt.toLocaleDateString(),
              time: row.time || dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              customerName: row.customer_name || 'Cash Sale',
              customerPhone: row.customer_phone || '',
              items: Array.isArray(row.items) && row.items.length > 0
                ? row.items
                : [
                    {
                      name: row.title || 'Invoice Item',
                      price: total,
                      qty: 1,
                      total: total,
                    },
                  ],
              subtotal: Number(row.subtotal ?? total) || 0,
              discount: Number(row.discount) || 0,
              grandTotal: total,
              paymentMethod: row.payment_method || 'cash',
              paidAmount: Number(row.paid_amount ?? total) || 0,
              changeAmount: Number(row.change_amount) || 0,
              timestamp: rawTs,
            };
          });
        }
      } catch (invEx) {
        console.warn('Invoices table query notice:', invEx);
      }

      // Query 'transactions' table using authenticated user_id (auth.uid())
      try {
        const { data: txRows, error: txErr } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', masterUserId)
          .order('created_at', { ascending: false });

        if (!txErr && Array.isArray(txRows) && txRows.length > 0) {
          const existingIds = new Set(bills.map((b) => b.id));
          for (let i = 0; i < txRows.length; i++) {
            const row = txRows[i];
            if (!existingIds.has(row.id)) {
              const dt = row.created_at ? new Date(row.created_at) : new Date();
              const amt = Number(row.amount) || 0;
              bills.push({
                id: row.id,
                invoiceNo: String(row.invoice_no || row.id?.slice(-4) || i + 1),
                date: dt.toLocaleDateString(),
                time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                customerName: row.customer_name || 'Cash Sale',
                customerPhone: row.customer_phone || '',
                items: Array.isArray(row.items) && row.items.length > 0
                  ? row.items
                  : [
                      {
                        name: row.title || (row.type === 'EXPENSE' ? 'Expense' : 'Sale Item'),
                        price: amt,
                        qty: 1,
                        total: amt,
                      },
                    ],
                subtotal: amt,
                discount: 0,
                grandTotal: amt,
                paymentMethod: row.type === 'EXPENSE' ? 'due' : 'cash',
                paidAmount: amt,
                changeAmount: 0,
                timestamp: dt.getTime(),
              });
              existingIds.add(row.id);
            }
          }
        }
      } catch (txEx) {
        console.warn('Transactions table query notice:', txEx);
      }

      // Sort all combined invoices by timestamp descending
      bills.sort((a, b) => b.timestamp - a.timestamp);

      // If masterShopId is different from masterUserId, query and merge shop invoices
      if (masterShopId && masterShopId !== masterUserId) {
        try {
          const { data: shopInvoices } = await supabase
            .from('invoices')
            .select('*')
            .eq('shop_id', masterShopId)
            .order('timestamp', { ascending: false });

          if (Array.isArray(shopInvoices)) {
            const existingIds = new Set(bills.map((b) => b.id));
            for (const row of shopInvoices) {
              if (!existingIds.has(row.id)) {
                bills.push({
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
                });
                existingIds.add(row.id);
              }
            }
          }
        } catch (e) {
          // ignore column shop_id not found in older schemas
        }
      }

      // 3. Fetch Cashbook Entries using master owner ID
      const { data: cashRows } = await supabase
        .from('cash_entries')
        .select('*')
        .eq('user_id', masterUserId)
        .order('timestamp', { ascending: false });

      if (Array.isArray(cashRows)) {
        cashEntries = cashRows.map((row) => ({
          id: row.id,
          type: row.type === 'Expense' || row.type === 'cash_out' ? 'Expense' : 'Income',
          amount: Number(row.amount) || 0,
          note: row.description || row.note || '',
          dateFormatted: row.date || new Date().toLocaleDateString(),
          timestamp: Number(row.timestamp) || Date.now(),
        }));
      }

      // 4. Fetch Customer Dues using master owner ID
      const { data: duesRows } = await supabase
        .from('customer_dues')
        .select('*')
        .eq('user_id', masterUserId);

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

      // 5. Fetch Purchase Trips using master owner ID
      const { data: tripRows } = await supabase
        .from('purchase_trips')
        .select('*')
        .eq('user_id', masterUserId);

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

      // 6. Fetch Inventory / Products stock items
      try {
        const { data: prodRows } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', masterUserId);

        if (Array.isArray(prodRows) && prodRows.length > 0) {
          products = prodRows.map((p) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price) || 0,
            purchasePrice: Number(p.purchase_price) || 0,
            stock: Number(p.stock) || 0,
            unit: p.unit || 'pcs',
            category: p.category || '',
            barcode: p.barcode || '',
            updatedAt: Number(p.updated_at) || Date.now(),
          }));
        }
      } catch {
        // ignore products table not yet created in older schemas
      }

      // Fallback or merge with products stored in profiles inventory_json or settings_json
      if (masterProfile) {
        const jsonProds: ProductStockItem[] =
          masterProfile.inventory_json ||
          masterProfile.settings_json?.products ||
          [];
        if (Array.isArray(jsonProds) && jsonProds.length > 0) {
          const existingIds = new Set(products.map((p) => p.id));
          for (const jp of jsonProds) {
            if (jp && jp.id && !existingIds.has(jp.id)) {
              products.push(jp);
              existingIds.add(jp.id);
            }
          }
        }
      }
      // Real Supabase data only — never overwrite with fake mock data
    } catch (fetchErr) {
      console.error('Supabase cloud restore error:', fetchErr);
    }

    return {
      settings,
      bills,
      cashEntries,
      customerDues,
      purchaseTrips,
      products,
      userProfile,
    };
  }

  // Sync a single invoice to Supabase cloud (supports both invoices and transactions tables)
  async syncInvoice(invoice: BillInvoice, userId: string, shopId?: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    let anySuccess = false;

    // 1. Attempt sync to invoices table
    try {
      const payload: any = {
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
      };
      if (shopId) {
        payload.shop_id = shopId;
      }
      const { error } = await supabase.from('invoices').upsert(payload, { onConflict: 'id' });
      if (!error) anySuccess = true;
    } catch {}

    // 2. Also sync to transactions table using authenticated user's ID (auth.uid())
    try {
      const isUuid = (s: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
      const txPayload: any = {
        user_id: userId,
        title:
          invoice.items?.[0]?.name
            ? `${invoice.items[0].name}${invoice.items.length > 1 ? ` (+${invoice.items.length - 1})` : ''}`
            : `Bill #${invoice.invoiceNo}`,
        amount: invoice.grandTotal || 0,
        type: invoice.paymentMethod === 'due' ? 'EXPENSE' : 'INCOME',
        customer_name: invoice.customerName || 'Cash Sale',
        created_at: new Date(invoice.timestamp || Date.now()).toISOString(),
      };
      if (isUuid(invoice.id)) {
        txPayload.id = invoice.id;
      }
      const { error: txErr } = await supabase.from('transactions').upsert(txPayload);
      if (!txErr) anySuccess = true;
    } catch (txEx) {
      console.warn('transactions table sync notice:', txEx);
    }

    return anySuccess;
  }

  // Delete invoice from Supabase cloud (removes from both invoices and transactions tables)
  async deleteInvoice(invoiceId: string, userId?: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await supabase
        .from('invoices')
        .delete()
        .or(`id.eq.${invoiceId},invoice_no.eq.${invoiceId}`);
      if (userId) {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', invoiceId)
          .eq('user_id', userId);
      }
      return true;
    } catch {
      return false;
    }
  }

  // Sync a cashbook entry to Supabase cloud
  async syncCashEntry(entry: CashEntry, userId: string, shopId?: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const payload: any = {
        id: entry.id,
        user_id: userId,
        type: entry.type,
        amount: entry.amount,
        category: entry.type,
        description: entry.note || '',
        date: entry.dateFormatted || new Date().toISOString(),
        time: '',
        timestamp: entry.timestamp || Date.now(),
      };
      if (shopId) {
        payload.shop_id = shopId;
      }
      const { error } = await supabase.from('cash_entries').upsert(payload, { onConflict: 'id' });
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
  async syncCustomerDue(due: CustomerDue, userId: string, shopId?: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const payload: any = {
        id: due.id,
        user_id: userId,
        customer_name: due.name,
        customer_phone: due.phone,
        total_due: due.dueAmount,
        due_type: due.type || 'receivable',
        transactions: due.transactions || [],
        notes: '',
        updated_at: new Date().toISOString(),
      };
      if (shopId) {
        payload.shop_id = shopId;
      }
      const { error } = await supabase.from('customer_dues').upsert(payload, { onConflict: 'id' });
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

  // Sync a product / inventory item to Supabase cloud
  async syncProduct(product: ProductStockItem, userId: string, shopId?: string): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const payload: any = {
        id: product.id,
        user_id: userId,
        name: product.name,
        price: product.price,
        purchase_price: product.purchasePrice || 0,
        stock: product.stock,
        unit: product.unit || 'pcs',
        category: product.category || '',
        barcode: product.barcode || '',
        updated_at: product.updatedAt || Date.now(),
      };
      if (shopId) {
        payload.shop_id = shopId;
      }
      await supabase.from('products').upsert(payload, { onConflict: 'id' });
      return true;
    } catch {
      return false;
    }
  }

  // Delete product from Supabase cloud
  async deleteProduct(productId: string, _userId?: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      return !error;
    } catch {
      return false;
    }
  }

  // Sync shop profile & settings to Supabase cloud
  async syncProfile(
    settings: ThermalPrinterSettings,
    userProfile: UserProfile,
    userId: string,
    productsList?: ProductStockItem[],
    shopId?: string
  ): Promise<boolean> {
    if (!userId || !this.isConfigured()) return false;
    try {
      const effectiveShopId = shopId || userProfile.shopId || userId;
      const payload: any = {
        id: userId,
        shop_id: effectiveShopId,
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
        settings_json: {
          ...settings,
          ...(productsList && productsList.length > 0 ? { products: productsList } : {}),
        },
        inventory_json: productsList || [],
        updated_at: new Date().toISOString(),
      };

      // 1. Update Supabase Auth user metadata so store name persists in cloud even without profiles table
      try {
        await supabase.auth.updateUser({
          data: {
            store_name: settings.storeName || '',
            name: settings.signatoryName || userProfile.name || '',
            phone: settings.storePhone || userProfile.phone || '',
          },
        });
      } catch (authErr) {
        console.warn('Supabase auth metadata update notice:', authErr);
      }

      // 2. Also upsert to profiles table if it exists
      try {
        const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
        if (!error) return true;
      } catch {}

      return true;
    } catch {
      return false;
    }
  }
}

export const supabaseService = new SupabaseService();
