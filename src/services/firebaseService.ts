import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import { db, auth } from '../firebase';
import {
  BillInvoice,
  CashEntry,
  CustomerDue,
  ProductStockItem,
  ThermalPrinterSettings,
  PurchaseTrip,
  UserProfile,
  StoreVendorAccount,
  SoftDeletedItem,
  StaffMember
} from '../types';

export const MASTER_ADMIN_EMAIL = 'uddinfahad89@gmail.com';

export interface BarcodeItem {
  id: string;
  barcode: string;
  productName: string;
  productId?: string;
  price: number;
  purchasePrice?: number;
  sku?: string;
  category?: string;
  unit?: string;
  designConfig?: any;
  printedCount?: number;
  userId?: string;
  userEmail?: string;
  email?: string;
  shopId?: string;
  storeId?: string;
  isDeleted?: boolean;
  deletedAt?: number | string;
  deletedBy?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface FirebaseUserAccount {
  email: string;
  password?: string;
  name: string;
  phone?: string;
  storeName?: string;
  role?: 'Owner' | 'Manager' | 'Cashier' | 'Super Admin' | 'super_admin';
  pin?: string;
  isSuperAdmin?: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  storeId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FirebaseRestoredData {
  bills: BillInvoice[];
  products: ProductStockItem[];
  cashEntries: CashEntry[];
  customerDues: CustomerDue[];
  purchaseTrips: PurchaseTrip[];
  settings?: ThermalPrinterSettings;
  barcodes: BarcodeItem[];
  userProfile?: UserProfile;
}

class FirebaseService {
  isConfigured(): boolean {
    return Boolean(db);
  }

  // Get active authenticated user ID from Firebase Auth
  getActiveUserId(): string | null {
    try {
      return auth.currentUser?.uid || null;
    } catch {
      return null;
    }
  }

  // Universal user identifier for multi-device cross-app sync:
  // Normalizes to lowercase user email so same email on any device/mobile accesses the exact same Firestore data
  getEffectiveUserId(userId?: string): string {
    if (userId && typeof userId === 'string' && userId.includes('@')) {
      return userId.trim().toLowerCase();
    }
    try {
      const stored = localStorage.getItem('thermal_pos_user_profile_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.email && typeof parsed.email === 'string' && parsed.email.includes('@')) {
          return parsed.email.trim().toLowerCase();
        }
      }
    } catch {}
    if (userId && typeof userId === 'string' && userId.trim()) {
      return userId.trim().toLowerCase();
    }
    const authEmail = auth.currentUser?.email;
    if (authEmail) return authEmail.trim().toLowerCase();
    const authUid = this.getActiveUserId();
    if (authUid) return authUid;
    return 'uddinfahad89@gmail.com';
  }

  // Check if given user or active user is Super Admin (Master Account)
  isSuperAdmin(userId?: string): boolean {
    const target = (userId || this.getEffectiveUserId()).trim().toLowerCase();
    if (target === MASTER_ADMIN_EMAIL.toLowerCase()) return true;
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('thermal_pos_user_profile_v1') : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.isSuperAdmin || parsed?.role === 'Super Admin' || parsed?.role === 'super_admin') {
          return true;
        }
      }
    } catch {}
    return false;
  }

  // Test Firestore connection
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const pingDocRef = doc(db, '_connection_test', 'ping');
      await setDoc(
        pingDocRef,
        {
          lastPing: new Date().toISOString(),
          client: 'classic-fashion-pos'
        },
        { merge: true }
      );
      return {
        success: true,
        message: 'Firebase Firestore connected successfully to classic-fashion-pos!'
      };
    } catch (err: any) {
      console.warn('Firebase connection test warning:', err);
      if (err?.code === 'permission-denied') {
        return {
          success: true,
          message: 'Firebase connected (Firestore is reachable; security rules active).'
        };
      }
      return {
        success: false,
        message: err?.message || 'Failed to connect to Firebase Firestore.'
      };
    }
  }

  // ==========================================
  // MULTI-DEVICE AUTHENTICATION & ACCOUNT REPOSITORY
  // ==========================================

  // Register a new user account in Firestore
  async registerUserAccount(data: {
    email: string;
    password?: string;
    name?: string;
    phone?: string;
    storeName?: string;
    role?: 'Owner' | 'Manager' | 'Cashier';
    pin?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanEmail = (data.email || '').trim().toLowerCase();
      if (!cleanEmail) return { success: false, error: 'Email is required' };

      const userDocRef = doc(db, 'users', cleanEmail);
      const now = new Date().toISOString();

      const accountPayload: FirebaseUserAccount = {
        email: cleanEmail,
        password: data.password?.trim() || '',
        name: (data.name || '').trim() || cleanEmail.split('@')[0],
        phone: (data.phone || '').trim(),
        storeName: (data.storeName || '').trim() || 'My Store',
        role: data.role || 'Owner',
        pin: data.pin || '1234',
        createdAt: now,
        updatedAt: now
      };

      await setDoc(userDocRef, accountPayload, { merge: true });

      // Also attempt to create Firebase Auth user if configured (ignore if already exists)
      if (data.password && data.password.length >= 6) {
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, data.password.trim());
        } catch (authErr: any) {
          // If auth user already exists, try signing in
          if (authErr?.code === 'auth/email-already-in-use') {
            try {
              await signInWithEmailAndPassword(auth, cleanEmail, data.password.trim());
            } catch {}
          }
        }
      }

      return { success: true };
    } catch (e: any) {
      console.error('Firebase registerUserAccount error:', e);
      return { success: false, error: e?.message || 'Failed to register user in Firebase' };
    }
  }

  // Authenticate user across mobile devices using email & password, then restore all POS data
  async authenticateAndRestore(
    email: string,
    password?: string
  ): Promise<{
    success: boolean;
    restored?: FirebaseRestoredData;
    error?: string;
  }> {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      if (!cleanEmail) {
        return { success: false, error: 'Email is required' };
      }

      // 1. Check if user document exists in 'users' collection
      const userDocRef = doc(db, 'users', cleanEmail);
      const userDocSnap = await getDoc(userDocRef);

      let matchedAccount: FirebaseUserAccount | null = null;

      if (userDocSnap.exists()) {
        const uData = userDocSnap.data() as FirebaseUserAccount;
        if (cleanPass && uData.password && uData.password !== cleanPass) {
          // Wrong password
          return {
            success: false,
            error: 'পাসওয়ার্ড সঠিক নয়! সঠিক পাসওয়ার্ড লিখুন।'
          };
        }
        matchedAccount = uData;
      } else {
        // If user doc doesn't exist yet, check if profile or POS data exists for this email
        const profileDocRef = doc(db, 'profiles', cleanEmail);
        const profileDocSnap = await getDoc(profileDocRef);

        if (profileDocSnap.exists()) {
          // Legacy or previously saved account under this email: auto-create the user doc
          const profData = profileDocSnap.data() || {};
          matchedAccount = {
            email: cleanEmail,
            password: cleanPass,
            name: profData.signatoryName || cleanEmail.split('@')[0],
            phone: profData.phone || '',
            storeName: profData.storeName || 'My Store',
            role: 'Owner',
            pin: '1234',
            updatedAt: new Date().toISOString()
          };
          await setDoc(userDocRef, matchedAccount, { merge: true });
        } else {
          // Also check if any invoices exist for this email
          const invQuery = query(collection(db, 'invoices'), where('userId', '==', cleanEmail));
          const invSnap = await getDocs(invQuery);
          if (!invSnap.empty) {
            matchedAccount = {
              email: cleanEmail,
              password: cleanPass,
              name: cleanEmail.split('@')[0],
              role: 'Owner',
              pin: '1234',
              updatedAt: new Date().toISOString()
            };
            await setDoc(userDocRef, matchedAccount, { merge: true });
          } else {
            // No record found at all in Firebase
            return {
              success: false,
              error: 'এই ইমেল দিয়ে ফায়ারবেসে কোনো অ্যাকাউন্ট বা ডাটা পাওয়া যায়নি।'
            };
          }
        }
      }

      // Check if store user has been blocked by Super Admin
      const isSuper = this.isSuperAdmin(cleanEmail) || matchedAccount?.role === 'Super Admin' || Boolean(matchedAccount?.isSuperAdmin);
      if (matchedAccount?.isBlocked && !isSuper) {
        return {
          success: false,
          error: `🚫 আপনার স্টোর অ্যাকাউন্টটি সুপার এডমিন কর্তৃক ব্লক করা হয়েছে। কারণ: ${matchedAccount.blockedReason || 'অ্যাক্সেস সাময়িকভাবে স্থগিত করা হয়েছে।'}`
        };
      }

      // Also try Firebase Auth sign-in in background
      if (cleanPass) {
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        } catch {}
      }

      // 2. Fetch and restore all POS data from Firestore for this email
      const restored = await this.restorePOSData(cleanEmail);
      if (!restored || !restored.success) {
        return {
          success: false,
          error: 'ফায়ারবেস থেকে ডাটা লোড করতে ব্যর্থ হয়েছে।'
        };
      }

      const userProfile: UserProfile = {
        name: matchedAccount?.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: matchedAccount?.phone || '',
        role: isSuper ? 'Super Admin' : (matchedAccount?.role || 'Owner'),
        isSuperAdmin: isSuper,
        isBlocked: Boolean(matchedAccount?.isBlocked),
        blockedReason: matchedAccount?.blockedReason || '',
        isLoggedIn: true,
        pin: matchedAccount?.pin || '1234',
        shopId: matchedAccount?.storeId || cleanEmail,
        storeId: matchedAccount?.storeId || cleanEmail,
        storeName: matchedAccount?.storeName || 'My Store'
      };

      return {
        success: true,
        restored: {
          ...restored,
          userProfile
        }
      };
    } catch (e: any) {
      console.error('Firebase authenticateAndRestore error:', e);
      return { success: false, error: e?.message || 'Authentication error' };
    }
  }

  // Update user password in Firestore for multi-device sync
  async updateUserPassword(email: string, newPassword: string): Promise<boolean> {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPass = newPassword.trim();
      if (!cleanEmail || !cleanPass) return false;

      const userDocRef = doc(db, 'users', cleanEmail);
      await setDoc(
        userDocRef,
        {
          email: cleanEmail,
          password: cleanPass,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      // Also sync Firebase Auth if currently logged in or user exists
      try {
        if (auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanEmail) {
          await updatePassword(auth.currentUser, cleanPass);
        }
      } catch (authErr) {
        console.warn('Firebase Auth updatePassword notice:', authErr);
      }

      return true;
    } catch (e) {
      console.error('Firebase updateUserPassword error:', e);
      return false;
    }
  }

  // Check if an email exists in Firestore (users, profiles, or invoices)
  async checkUserExists(email: string): Promise<boolean> {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail) return false;

      // 1. Check users collection
      const userDocSnap = await getDoc(doc(db, 'users', cleanEmail));
      if (userDocSnap.exists()) return true;

      // 2. Check profiles collection
      const profDocSnap = await getDoc(doc(db, 'profiles', cleanEmail));
      if (profDocSnap.exists()) return true;

      // 3. Check if any invoices exist
      const invQuery = query(collection(db, 'invoices'), where('userId', '==', cleanEmail));
      const invSnap = await getDocs(invQuery);
      return !invSnap.empty;
    } catch (e) {
      console.warn('Firebase checkUserExists notice:', e);
      return false;
    }
  }

  // Send password reset email
  async sendPasswordResetLink(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      await sendPasswordResetEmail(auth, cleanEmail);
      return { success: true };
    } catch (e: any) {
      console.warn('Firebase sendPasswordResetLink error:', e);
      let errMsg = e?.message || 'Failed to send reset email';
      if (e?.code === 'auth/user-not-found') {
        errMsg = 'auth/user-not-found';
      }
      return { success: false, error: errMsg };
    }
  }

  // ==========================================
  // STAFF MEMBERS COLLECTION (POS ACCESS & PERMISSIONS)
  // ==========================================
  async syncStaffMember(staff: StaffMember, storeId?: string): Promise<boolean> {
    try {
      const activeStore = storeId || staff.storeId || this.getEffectiveUserId();
      const staffDocId = staff.id;

      // 1. Store in stores/{storeId}/staff/{staffId}
      const storeStaffRef = doc(db, 'stores', activeStore, 'staff', staffDocId);
      const payload = {
        ...staff,
        storeId: activeStore,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(storeStaffRef, payload, { merge: true });

      // 2. Also keep in top-level staff_members collection for multi-vendor lookup
      const globalStaffRef = doc(db, 'staff_members', staffDocId);
      await setDoc(globalStaffRef, payload, { merge: true });

      return true;
    } catch (e) {
      console.error('Firebase syncStaffMember error:', e);
      return false;
    }
  }

  async fetchStaffMembers(storeId?: string): Promise<StaffMember[]> {
    try {
      const activeStore = storeId || this.getEffectiveUserId();
      const staffCol = collection(db, 'stores', activeStore, 'staff');
      const snap = await getDocs(staffCol);
      const list: StaffMember[] = [];
      snap.forEach((d) => {
        if (d.exists()) {
          list.push(d.data() as StaffMember);
        }
      });
      return list;
    } catch (e) {
      console.warn('Firebase fetchStaffMembers notice:', e);
      return [];
    }
  }

  // ==========================================
  // BARCODES TABLE / COLLECTION
  // ==========================================
  async syncBarcode(item: BarcodeItem, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const docId = item.id || `barcode_${item.barcode}_${Date.now()}`;
      const barcodeRef = doc(db, 'barcodes', docId);

      const payload = {
        id: docId,
        barcode: String(item.barcode || '').trim(),
        productName: item.productName || '',
        productId: item.productId || '',
        price: Number(item.price) || 0,
        purchasePrice: Number(item.purchasePrice) || 0,
        sku: item.sku || '',
        category: item.category || '',
        unit: item.unit || 'pcs',
        designConfig: item.designConfig || {},
        printedCount: Number(item.printedCount) || 0,
        userId: uid,
        userEmail: uid,
        email: uid,
        shopId: shopId || uid,
        updatedAt: new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString()
      };

      await setDoc(barcodeRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncBarcode error:', e);
      return false;
    }
  }

  async fetchBarcodes(userId?: string): Promise<BarcodeItem[]> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const barcodesRef = collection(db, 'barcodes');
      
      const map = new Map<string, BarcodeItem>();

      // Query by userId
      try {
        const q1 = query(barcodesRef, where('userId', '==', uid));
        const snap1 = await getDocs(q1);
        snap1.forEach((d) => map.set(d.id, d.data() as BarcodeItem));
      } catch {}

      // Query by userEmail
      try {
        const q2 = query(barcodesRef, where('userEmail', '==', uid));
        const snap2 = await getDocs(q2);
        snap2.forEach((d) => map.set(d.id, d.data() as BarcodeItem));
      } catch {}

      return Array.from(map.values());
    } catch (e) {
      console.error('Firebase fetchBarcodes error:', e);
      return [];
    }
  }

  async deleteBarcode(id: string): Promise<boolean> {
    try {
      const barcodeRef = doc(db, 'barcodes', id);
      await deleteDoc(barcodeRef);
      return true;
    } catch (e) {
      console.error('Firebase deleteBarcode error:', e);
      return false;
    }
  }

  // ==========================================
  // INVOICES COLLECTION (MULTI-VENDOR & SOFT-DELETE)
  // ==========================================
  async syncInvoice(invoice: BillInvoice, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const invoiceRef = doc(db, 'invoices', invoice.id);

      const payload = {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        date: invoice.date,
        time: invoice.time || '',
        customerName: invoice.customerName || '',
        customerPhone: invoice.customerPhone || '',
        items: invoice.items || [],
        subtotal: invoice.subtotal || 0,
        tax: (invoice as any).tax || 0,
        discount: invoice.discount || 0,
        discountType: invoice.discountType || 'fixed',
        discountValue: invoice.discountValue || 0,
        grandTotal: invoice.grandTotal || 0,
        paymentMethod: invoice.paymentMethod || 'Cash',
        paymentStatus: invoice.paymentStatus || 'PAID',
        paidAmount: invoice.paidAmount || 0,
        changeAmount: invoice.changeAmount || 0,
        balance: invoice.balance ?? 0,
        isEstimate: Boolean(invoice.isEstimate),
        isTailoring: Boolean(invoice.isTailoring),
        deliveryDate: invoice.deliveryDate || '',
        trialDate: invoice.trialDate || '',
        tailoringStatus: invoice.tailoringStatus || '',
        timestamp: invoice.timestamp || Date.now(),
        userId: uid,
        userEmail: uid,
        email: uid,
        shopId: shopId || uid,
        storeId: shopId || uid,
        isDeleted: Boolean(invoice.isDeleted),
        deletedAt: invoice.deletedAt || null,
        deletedBy: invoice.deletedBy || null,
        syncedAt: new Date().toISOString()
      };

      await setDoc(invoiceRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncInvoice error:', e);
      return false;
    }
  }

  // Soft Delete Invoice - Never hard delete from Firestore
  async softDeleteInvoice(id: string, invoiceNo?: string, deletedBy?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId();
      const invoiceRef = doc(db, 'invoices', id);
      const now = new Date().toISOString();
      const by = deletedBy || uid;

      await setDoc(
        invoiceRef,
        {
          isDeleted: true,
          deletedAt: now,
          deletedBy: by,
          updatedAt: now
        },
        { merge: true }
      );

      // Also mark docs matching invoiceNo if differing
      if (invoiceNo && invoiceNo !== id) {
        try {
          const invoicesRef = collection(db, 'invoices');
          const q2 = query(invoicesRef, where('invoiceNo', '==', invoiceNo));
          const snap2 = await getDocs(q2);
          for (const d of snap2.docs) {
            await setDoc(
              d.ref,
              { isDeleted: true, deletedAt: now, deletedBy: by, updatedAt: now },
              { merge: true }
            );
          }
        } catch {}
      }

      return true;
    } catch (e) {
      console.error('Firebase softDeleteInvoice error:', e);
      return false;
    }
  }

  // Backward compatibility alias
  async deleteInvoice(id: string, invoiceNo?: string): Promise<boolean> {
    return this.softDeleteInvoice(id, invoiceNo);
  }

  // Single-Click Instant Recovery for Invoices
  async restoreInvoice(id: string): Promise<boolean> {
    try {
      const invoiceRef = doc(db, 'invoices', id);
      await setDoc(
        invoiceRef,
        {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          restoredAt: new Date().toISOString()
        },
        { merge: true }
      );

      // Remove from local tombstone if present
      try {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('thermal_pos_deleted_bill_ids_v1');
          if (raw) {
            const arr = JSON.parse(raw);
            const filtered = arr.filter((x: string) => x !== id);
            localStorage.setItem('thermal_pos_deleted_bill_ids_v1', JSON.stringify(filtered));
          }
        }
      } catch {}

      return true;
    } catch (e) {
      console.error('Firebase restoreInvoice error:', e);
      return false;
    }
  }

  // Multi-vendor isolated fetch: only own store's bills (unless super admin requests all)
  async fetchInvoices(userId?: string, includeDeleted = false): Promise<BillInvoice[]> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const invoicesRef = collection(db, 'invoices');
      const map = new Map<string, BillInvoice>();

      // Query by userId
      try {
        const q1 = query(invoicesRef, where('userId', '==', uid));
        const snap1 = await getDocs(q1);
        snap1.forEach((d) => map.set(d.id, d.data() as BillInvoice));
      } catch {}

      // Query by userEmail
      try {
        const q2 = query(invoicesRef, where('userEmail', '==', uid));
        const snap2 = await getDocs(q2);
        snap2.forEach((d) => map.set(d.id, d.data() as BillInvoice));
      } catch {}

      // Filter out deleted bills from local tombstones and soft-delete flag
      let deletedSet: Set<string>;
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('thermal_pos_deleted_bill_ids_v1') : null;
        deletedSet = raw ? new Set(JSON.parse(raw)) : new Set();
      } catch {
        deletedSet = new Set();
      }

      return Array.from(map.values())
        .filter((b) => {
          if (includeDeleted) return true;
          if (b.isDeleted === true) return false;
          if (deletedSet.has(b.id)) return false;
          return true;
        })
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } catch (e) {
      console.error('Firebase fetchInvoices error:', e);
      return [];
    }
  }

  // ==========================================
  // PRODUCTS COLLECTION (MULTI-VENDOR & SOFT-DELETE)
  // ==========================================
  async syncProduct(product: ProductStockItem, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const prodRef = doc(db, 'products', product.id);

      const payload = {
        id: product.id,
        name: product.name,
        price: product.price || 0,
        purchasePrice: product.purchasePrice || 0,
        stock: product.stock ?? 0,
        unit: product.unit || 'pcs',
        category: product.category || '',
        barcode: product.barcode || '',
        updatedAt: product.updatedAt || Date.now(),
        userId: uid,
        userEmail: uid,
        email: uid,
        shopId: shopId || uid,
        storeId: shopId || uid,
        isDeleted: Boolean(product.isDeleted),
        deletedAt: product.deletedAt || null,
        deletedBy: product.deletedBy || null,
        syncedAt: new Date().toISOString()
      };

      await setDoc(prodRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncProduct error:', e);
      return false;
    }
  }

  // Soft Delete Product - Never hard delete from Firestore
  async softDeleteProduct(productId: string, deletedBy?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId();
      const prodRef = doc(db, 'products', productId);
      const now = new Date().toISOString();
      const by = deletedBy || uid;

      await setDoc(
        prodRef,
        {
          isDeleted: true,
          deletedAt: now,
          deletedBy: by,
          updatedAt: Date.now()
        },
        { merge: true }
      );

      return true;
    } catch (e) {
      console.error('Firebase softDeleteProduct error:', e);
      return false;
    }
  }

  // Backward compatibility alias
  async deleteProduct(productId: string): Promise<boolean> {
    return this.softDeleteProduct(productId);
  }

  // Single-Click Instant Recovery for Products
  async restoreProduct(productId: string): Promise<boolean> {
    try {
      const prodRef = doc(db, 'products', productId);
      await setDoc(
        prodRef,
        {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedAt: Date.now()
        },
        { merge: true }
      );

      // Remove from local tombstone if present
      try {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('thermal_pos_deleted_prod_ids_v1');
          if (raw) {
            const arr = JSON.parse(raw);
            const filtered = arr.filter((x: string) => x !== productId);
            localStorage.setItem('thermal_pos_deleted_prod_ids_v1', JSON.stringify(filtered));
          }
        }
      } catch {}

      return true;
    } catch (e) {
      console.error('Firebase restoreProduct error:', e);
      return false;
    }
  }

  async fetchProducts(userId?: string, includeDeleted = false): Promise<ProductStockItem[]> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const prodRef = collection(db, 'products');
      const map = new Map<string, ProductStockItem>();

      // Query by userId
      try {
        const q1 = query(prodRef, where('userId', '==', uid));
        const snap1 = await getDocs(q1);
        snap1.forEach((d) => map.set(d.id, d.data() as ProductStockItem));
      } catch {}

      // Query by userEmail
      try {
        const q2 = query(prodRef, where('userEmail', '==', uid));
        const snap2 = await getDocs(q2);
        snap2.forEach((d) => map.set(d.id, d.data() as ProductStockItem));
      } catch {}

      // Fallback: If 0 products and this is MASTER_ADMIN_EMAIL, check legacy anonymous products
      if (map.size === 0 && uid === MASTER_ADMIN_EMAIL) {
        try {
          const qAnon = query(prodRef, where('userId', '==', 'anonymous'));
          const snapAnon = await getDocs(qAnon);
          snapAnon.forEach((d) => {
            const prod = d.data() as ProductStockItem;
            map.set(d.id, prod);
            this.syncProduct(prod, uid);
          });
        } catch {}
      }

      // Filter out deleted products from local tombstones and soft-delete flag
      let deletedProdSet: Set<string>;
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('thermal_pos_deleted_prod_ids_v1') : null;
        deletedProdSet = raw ? new Set(JSON.parse(raw)) : new Set();
      } catch {
        deletedProdSet = new Set();
      }

      return Array.from(map.values()).filter((p) => {
        if (includeDeleted) return true;
        if (p.isDeleted === true) return false;
        if (deletedProdSet.has(p.id)) return false;
        return true;
      });
    } catch (e) {
      console.error('Firebase fetchProducts error:', e);
      return [];
    }
  }

  // ==========================================
  // PROFILES / SHOP SETTINGS COLLECTION
  // ==========================================
  async syncProfile(
    settings: ThermalPrinterSettings,
    userId?: string,
    shopId?: string,
    userPhone?: string,
    email?: string
  ): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const profileRef = doc(db, 'profiles', uid);

      const payload = {
        id: uid,
        shopId: shopId || uid,
        email: email || uid,
        userEmail: email || uid,
        userId: uid,
        phone: userPhone || settings.storePhone || '',
        storeName: settings.storeName || '',
        storePhone: settings.storePhone || '',
        storeAddress: settings.storeAddress || '',
        paperWidth: settings.paperWidth || '58mm',
        currencySymbol: settings.currencySymbol || '৳',
        footerNote: settings.footerNote || '',
        signatoryName: settings.signatoryName || '',
        invoicePrefix: settings.invoicePrefix || 'INV-',
        nextInvoiceNumber: settings.nextInvoiceNumber || 1,
        autoPrintOnCheckout: Boolean(settings.autoPrintOnCheckout),
        isTotalOnlySlip: Boolean(settings.isTotalOnlySlip),
        settings: settings,
        syncedAt: new Date().toISOString()
      };

      await setDoc(profileRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncProfile error:', e);
      return false;
    }
  }

  async fetchProfile(userId?: string): Promise<ThermalPrinterSettings | null> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const profileRef = doc(db, 'profiles', uid);
      const snapshot = await getDoc(profileRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        return (data?.settings as ThermalPrinterSettings) || null;
      }
      return null;
    } catch (e) {
      console.error('Firebase fetchProfile error:', e);
      return null;
    }
  }

  // ==========================================
  // CASH ENTRIES COLLECTION
  // ==========================================
  // ==========================================
  // CASH ENTRIES COLLECTION (SOFT-DELETE)
  // ==========================================
  async syncCashEntry(entry: CashEntry, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const cashRef = doc(db, 'cash_entries', entry.id);

      const payload = {
        ...entry,
        userId: uid,
        userEmail: uid,
        email: uid,
        shopId: shopId || uid,
        storeId: shopId || uid,
        isDeleted: Boolean(entry.isDeleted),
        deletedAt: entry.deletedAt || null,
        deletedBy: entry.deletedBy || null,
        syncedAt: new Date().toISOString()
      };

      await setDoc(cashRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncCashEntry error:', e);
      return false;
    }
  }

  async softDeleteCashEntry(id: string, deletedBy?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId();
      const cashRef = doc(db, 'cash_entries', id);
      const now = new Date().toISOString();
      await setDoc(
        cashRef,
        {
          isDeleted: true,
          deletedAt: now,
          deletedBy: deletedBy || uid,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.error('Firebase softDeleteCashEntry error:', e);
      return false;
    }
  }

  async deleteCashEntry(id: string): Promise<boolean> {
    return this.softDeleteCashEntry(id);
  }

  async restoreCashEntry(id: string): Promise<boolean> {
    try {
      const cashRef = doc(db, 'cash_entries', id);
      await setDoc(
        cashRef,
        {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.error('Firebase restoreCashEntry error:', e);
      return false;
    }
  }

  async fetchCashEntries(userId?: string, includeDeleted = false): Promise<CashEntry[]> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const cashRef = collection(db, 'cash_entries');
      const map = new Map<string, CashEntry>();

      try {
        const q1 = query(cashRef, where('userId', '==', uid));
        const snap1 = await getDocs(q1);
        snap1.forEach((d) => map.set(d.id, d.data() as CashEntry));
      } catch {}

      try {
        const q2 = query(cashRef, where('userEmail', '==', uid));
        const snap2 = await getDocs(q2);
        snap2.forEach((d) => map.set(d.id, d.data() as CashEntry));
      } catch {}

      return Array.from(map.values())
        .filter((c) => includeDeleted || !c.isDeleted)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } catch (e) {
      console.error('Firebase fetchCashEntries error:', e);
      return [];
    }
  }

  // ==========================================
  // CUSTOMER DUES COLLECTION (SOFT-DELETE)
  // ==========================================
  async syncCustomerDue(due: CustomerDue, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const dueRef = doc(db, 'customer_dues', due.id);

      const payload = {
        ...due,
        userId: uid,
        userEmail: uid,
        email: uid,
        shopId: shopId || uid,
        storeId: shopId || uid,
        isDeleted: Boolean(due.isDeleted),
        deletedAt: due.deletedAt || null,
        deletedBy: due.deletedBy || null,
        syncedAt: new Date().toISOString()
      };

      await setDoc(dueRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncCustomerDue error:', e);
      return false;
    }
  }

  async softDeleteCustomerDue(id: string, deletedBy?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId();
      const dueRef = doc(db, 'customer_dues', id);
      const now = new Date().toISOString();
      await setDoc(
        dueRef,
        {
          isDeleted: true,
          deletedAt: now,
          deletedBy: deletedBy || uid,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.error('Firebase softDeleteCustomerDue error:', e);
      return false;
    }
  }

  async deleteCustomerDue(id: string): Promise<boolean> {
    return this.softDeleteCustomerDue(id);
  }

  async restoreCustomerDue(id: string): Promise<boolean> {
    try {
      const dueRef = doc(db, 'customer_dues', id);
      await setDoc(
        dueRef,
        {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.error('Firebase restoreCustomerDue error:', e);
      return false;
    }
  }

  async fetchCustomerDues(userId?: string, includeDeleted = false): Promise<CustomerDue[]> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const dueRef = collection(db, 'customer_dues');
      const map = new Map<string, CustomerDue>();

      try {
        const q1 = query(dueRef, where('userId', '==', uid));
        const snap1 = await getDocs(q1);
        snap1.forEach((d) => map.set(d.id, d.data() as CustomerDue));
      } catch {}

      try {
        const q2 = query(dueRef, where('userEmail', '==', uid));
        const snap2 = await getDocs(q2);
        snap2.forEach((d) => map.set(d.id, d.data() as CustomerDue));
      } catch {}

      return Array.from(map.values()).filter((d) => includeDeleted || !d.isDeleted);
    } catch (e) {
      console.error('Firebase fetchCustomerDues error:', e);
      return [];
    }
  }

  // ==========================================
  // PURCHASE TRIPS COLLECTION (SOFT-DELETE)
  // ==========================================
  async syncPurchaseTrip(trip: PurchaseTrip, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const tripRef = doc(db, 'purchase_trips', trip.id);

      const payload = {
        ...trip,
        userId: uid,
        userEmail: uid,
        email: uid,
        shopId: shopId || uid,
        storeId: shopId || uid,
        isDeleted: Boolean(trip.isDeleted),
        deletedAt: trip.deletedAt || null,
        deletedBy: trip.deletedBy || null,
        syncedAt: new Date().toISOString()
      };

      await setDoc(tripRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncPurchaseTrip error:', e);
      return false;
    }
  }

  async softDeletePurchaseTrip(id: string, deletedBy?: string): Promise<boolean> {
    try {
      const uid = this.getEffectiveUserId();
      const tripRef = doc(db, 'purchase_trips', id);
      const now = new Date().toISOString();
      await setDoc(
        tripRef,
        {
          isDeleted: true,
          deletedAt: now,
          deletedBy: deletedBy || uid,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.error('Firebase softDeletePurchaseTrip error:', e);
      return false;
    }
  }

  async deletePurchaseTrip(id: string): Promise<boolean> {
    return this.softDeletePurchaseTrip(id);
  }

  async restorePurchaseTrip(id: string): Promise<boolean> {
    try {
      const tripRef = doc(db, 'purchase_trips', id);
      await setDoc(
        tripRef,
        {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.error('Firebase restorePurchaseTrip error:', e);
      return false;
    }
  }

  async fetchPurchaseTrips(userId?: string, includeDeleted = false): Promise<PurchaseTrip[]> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const tripRef = collection(db, 'purchase_trips');
      const map = new Map<string, PurchaseTrip>();

      try {
        const q1 = query(tripRef, where('userId', '==', uid));
        const snap1 = await getDocs(q1);
        snap1.forEach((d) => map.set(d.id, d.data() as PurchaseTrip));
      } catch {}

      try {
        const q2 = query(tripRef, where('userEmail', '==', uid));
        const snap2 = await getDocs(q2);
        snap2.forEach((d) => map.set(d.id, d.data() as PurchaseTrip));
      } catch {}

      return Array.from(map.values()).filter((t) => includeDeleted || !t.isDeleted);
    } catch (e) {
      console.error('Firebase fetchPurchaseTrips error:', e);
      return [];
    }
  }

  // ==========================================
  // BULK SYNC ALL POS DATA TO FIREBASE FIRESTORE
  // ==========================================
  async syncAllPOSData(
    data: {
      bills?: BillInvoice[];
      products?: ProductStockItem[];
      cashEntries?: CashEntry[];
      customerDues?: CustomerDue[];
      purchaseTrips?: PurchaseTrip[];
      settings?: ThermalPrinterSettings;
      barcodes?: BarcodeItem[];
      userProfile?: UserProfile;
    },
    userId?: string
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const uid = this.getEffectiveUserId(userId);
      let count = 0;

      // 1. Sync Settings/Profile
      if (data.settings) {
        await this.syncProfile(
          data.settings,
          uid,
          undefined,
          data.userProfile?.phone,
          data.userProfile?.email || uid
        );
        count++;
      }

      // 2. Sync Invoices in parallel batches
      if (data.bills && data.bills.length > 0) {
        await Promise.all(data.bills.map((b) => this.syncInvoice(b, uid)));
        count += data.bills.length;
      }

      // 3. Sync Products in parallel batches
      if (data.products && data.products.length > 0) {
        await Promise.all(
          data.products.map(async (p) => {
            await this.syncProduct(p, uid);
            if (p.barcode) {
              await this.syncBarcode(
                {
                  id: `bc_${p.id}`,
                  barcode: p.barcode,
                  productName: p.name,
                  productId: p.id,
                  price: p.price,
                  purchasePrice: p.purchasePrice,
                  category: p.category,
                  unit: p.unit
                },
                uid
              );
            }
          })
        );
        count += data.products.length;
      }

      // 4. Sync Cash Entries
      if (data.cashEntries && data.cashEntries.length > 0) {
        await Promise.all(data.cashEntries.map((c) => this.syncCashEntry(c, uid)));
        count += data.cashEntries.length;
      }

      // 5. Sync Customer Dues
      if (data.customerDues && data.customerDues.length > 0) {
        await Promise.all(data.customerDues.map((d) => this.syncCustomerDue(d, uid)));
        count += data.customerDues.length;
      }

      // 6. Sync Purchase Trips
      if (data.purchaseTrips && data.purchaseTrips.length > 0) {
        await Promise.all(data.purchaseTrips.map((t) => this.syncPurchaseTrip(t, uid)));
        count += data.purchaseTrips.length;
      }

      // 7. Sync Barcodes
      if (data.barcodes && data.barcodes.length > 0) {
        await Promise.all(data.barcodes.map((bc) => this.syncBarcode(bc, uid)));
        count += data.barcodes.length;
      }

      return { success: true, count };
    } catch (err: any) {
      console.error('Firebase syncAllPOSData error:', err);
      return { success: false, count: 0, error: err?.message || 'Bulk sync error' };
    }
  }

  // Restore POS data from Firebase Firestore
  async restorePOSData(userId?: string): Promise<{
    success: boolean;
    bills: BillInvoice[];
    products: ProductStockItem[];
    cashEntries: CashEntry[];
    customerDues: CustomerDue[];
    purchaseTrips: PurchaseTrip[];
    settings?: ThermalPrinterSettings;
    barcodes: BarcodeItem[];
  } | null> {
    try {
      const uid = this.getEffectiveUserId(userId);
      const [bills, products, cashEntries, customerDues, purchaseTrips, settings, barcodes] =
        await Promise.all([
          this.fetchInvoices(uid),
          this.fetchProducts(uid),
          this.fetchCashEntries(uid),
          this.fetchCustomerDues(uid),
          this.fetchPurchaseTrips(uid),
          this.fetchProfile(uid),
          this.fetchBarcodes(uid)
        ]);

      return {
        success: true,
        bills,
        products,
        cashEntries,
        customerDues,
        purchaseTrips,
        settings: settings || undefined,
        barcodes
      };
    } catch (e) {
      console.error('Firebase restorePOSData error:', e);
      return null;
    }
  }

  // ==========================================
  // SUPER ADMIN & DATA RECOVERY ENGINE
  // ==========================================

  // Single-Click Generic Restore Method
  async restoreSoftDeletedRecord(entityType: string, id: string): Promise<boolean> {
    try {
      if (entityType === 'invoice') {
        return await this.restoreInvoice(id);
      } else if (entityType === 'product') {
        return await this.restoreProduct(id);
      } else if (entityType === 'customer_due') {
        return await this.restoreCustomerDue(id);
      } else if (entityType === 'cash_entry') {
        return await this.restoreCashEntry(id);
      } else if (entityType === 'purchase_trip') {
        return await this.restorePurchaseTrip(id);
      }
      return false;
    } catch (e) {
      console.error('Firebase restoreSoftDeletedRecord error:', e);
      return false;
    }
  }

  // Fetch all registered stores & vendors across Firestore with live analytics
  async fetchAllStores(): Promise<StoreVendorAccount[]> {
    try {
      const storesMap = new Map<string, StoreVendorAccount>();

      // 1. Fetch from 'users' collection
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach((d) => {
          const data = d.data() as FirebaseUserAccount;
          const uid = (data.email || d.id).toLowerCase();
          const isMaster = this.isSuperAdmin(uid);
          storesMap.set(uid, {
            uid,
            email: data.email || uid,
            name: data.name || uid.split('@')[0],
            phone: data.phone || '',
            storeName: data.storeName || (isMaster ? 'Classic Fashion (Master)' : 'Store ' + uid.split('@')[0]),
            role: isMaster ? 'Super Admin' : (data.role || 'Owner'),
            isSuperAdmin: isMaster,
            isBlocked: Boolean(data.isBlocked),
            blockedReason: data.blockedReason || '',
            createdAt: data.createdAt || Date.now(),
            lastActive: data.updatedAt || Date.now(),
            totalInvoices: 0,
            totalRevenue: 0,
            totalProducts: 0
          });
        });
      } catch (err) {
        console.warn('fetchAllStores users error:', err);
      }

      // Always ensure master admin account is listed
      if (!storesMap.has(MASTER_ADMIN_EMAIL.toLowerCase())) {
        storesMap.set(MASTER_ADMIN_EMAIL.toLowerCase(), {
          uid: MASTER_ADMIN_EMAIL.toLowerCase(),
          email: MASTER_ADMIN_EMAIL.toLowerCase(),
          name: 'Fahad uddin',
          phone: '',
          storeName: 'Classic Fashion (Master)',
          role: 'Super Admin',
          isSuperAdmin: true,
          isBlocked: false,
          totalInvoices: 0,
          totalRevenue: 0,
          totalProducts: 0
        });
      }

      // 2. Aggregate metrics from invoices across Firestore
      try {
        const invSnap = await getDocs(collection(db, 'invoices'));
        invSnap.forEach((d) => {
          const inv = d.data() as any;
          if (inv.isDeleted) return;
          const ownerUid = (inv.userId || inv.userEmail || inv.email || '').toLowerCase();
          if (ownerUid) {
            let entry = storesMap.get(ownerUid);
            if (!entry) {
              entry = {
                uid: ownerUid,
                email: ownerUid,
                name: ownerUid.split('@')[0],
                storeName: 'Vendor Store',
                role: 'Owner',
                isBlocked: false,
                totalInvoices: 0,
                totalRevenue: 0,
                totalProducts: 0
              };
              storesMap.set(ownerUid, entry);
            }
            entry.totalInvoices = (entry.totalInvoices || 0) + 1;
            entry.totalRevenue = (entry.totalRevenue || 0) + (Number(inv.grandTotal) || 0);
          }
        });
      } catch {}

      // 3. Aggregate product counts
      try {
        const prodSnap = await getDocs(collection(db, 'products'));
        prodSnap.forEach((d) => {
          const p = d.data() as any;
          if (p.isDeleted) return;
          const ownerUid = (p.userId || p.userEmail || p.email || '').toLowerCase();
          if (ownerUid && storesMap.has(ownerUid)) {
            const entry = storesMap.get(ownerUid)!;
            entry.totalProducts = (entry.totalProducts || 0) + 1;
          }
        });
      } catch {}

      return Array.from(storesMap.values()).sort((a, b) => {
        if (a.isSuperAdmin && !b.isSuperAdmin) return -1;
        if (!a.isSuperAdmin && b.isSuperAdmin) return 1;
        return (b.totalRevenue || 0) - (a.totalRevenue || 0);
      });
    } catch (e) {
      console.error('Firebase fetchAllStores error:', e);
      return [];
    }
  }

  // Fetch all transactions across all stores for Super Admin overview
  async fetchAllTransactionsAcrossStores(storeIdFilter?: string): Promise<BillInvoice[]> {
    try {
      const invRef = collection(db, 'invoices');
      const snap = await getDocs(invRef);
      const list: BillInvoice[] = [];

      snap.forEach((d) => {
        const inv = d.data() as any;
        if (inv.isDeleted) return;
        if (storeIdFilter && storeIdFilter !== '__ALL__') {
          const u = (inv.userId || inv.userEmail || inv.email || inv.shopId || '').toLowerCase();
          if (u !== storeIdFilter.toLowerCase()) return;
        }
        list.push(inv as BillInvoice);
      });

      return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } catch (e) {
      console.error('Firebase fetchAllTransactionsAcrossStores error:', e);
      return [];
    }
  }

  // Fetch all soft-deleted records across all stores for Admin Recovery Panel
  async fetchAllSoftDeletedRecords(storeIdFilter?: string): Promise<SoftDeletedItem[]> {
    try {
      const results: SoftDeletedItem[] = [];

      // 1. Soft-deleted Invoices
      try {
        const invSnap = await getDocs(collection(db, 'invoices'));
        invSnap.forEach((d) => {
          const inv = d.data() as any;
          if (!inv.isDeleted) return;
          const storeId = (inv.userId || inv.userEmail || inv.email || inv.shopId || 'unknown').toLowerCase();
          if (storeIdFilter && storeIdFilter !== '__ALL__' && storeId !== storeIdFilter.toLowerCase()) return;
          results.push({
            id: inv.id,
            entityType: 'invoice',
            title: `ইনভয়েস #${inv.invoiceNo} - ${inv.customerName || 'কাস্টমার'} (৳${inv.grandTotal})`,
            storeId,
            storeName: inv.customerPhone ? `মোবাইল: ${inv.customerPhone}` : undefined,
            userEmail: inv.userId || inv.userEmail,
            deletedAt: typeof inv.deletedAt === 'string' ? new Date(inv.deletedAt).getTime() : (Number(inv.deletedAt) || Date.now()),
            deletedBy: inv.deletedBy || 'ব্যবহারকারী',
            data: inv
          });
        });
      } catch {}

      // 2. Soft-deleted Products
      try {
        const prodSnap = await getDocs(collection(db, 'products'));
        prodSnap.forEach((d) => {
          const p = d.data() as any;
          if (!p.isDeleted) return;
          const storeId = (p.userId || p.userEmail || p.email || p.shopId || 'unknown').toLowerCase();
          if (storeIdFilter && storeIdFilter !== '__ALL__' && storeId !== storeIdFilter.toLowerCase()) return;
          results.push({
            id: p.id,
            entityType: 'product',
            title: `পণ্য: ${p.name} (মূল্য: ৳${p.price}, স্টক: ${p.stock} ${p.unit || 'pcs'})`,
            storeId,
            userEmail: p.userId || p.userEmail,
            deletedAt: typeof p.deletedAt === 'string' ? new Date(p.deletedAt).getTime() : (Number(p.deletedAt) || Date.now()),
            deletedBy: p.deletedBy || 'ব্যবহারকারী',
            data: p
          });
        });
      } catch {}

      // 3. Soft-deleted Customer Dues
      try {
        const dueSnap = await getDocs(collection(db, 'customer_dues'));
        dueSnap.forEach((d) => {
          const due = d.data() as any;
          if (!due.isDeleted) return;
          const storeId = (due.userId || due.userEmail || due.shopId || 'unknown').toLowerCase();
          if (storeIdFilter && storeIdFilter !== '__ALL__' && storeId !== storeIdFilter.toLowerCase()) return;
          results.push({
            id: due.id,
            entityType: 'customer_due',
            title: `বাকি খাতা: ${due.name} (বাকি: ৳${due.dueAmount})`,
            storeId,
            userEmail: due.userId,
            deletedAt: typeof due.deletedAt === 'string' ? new Date(due.deletedAt).getTime() : (Number(due.deletedAt) || Date.now()),
            deletedBy: due.deletedBy || 'ব্যবহারকারী',
            data: due
          });
        });
      } catch {}

      // 4. Soft-deleted Cashbook entries
      try {
        const cashSnap = await getDocs(collection(db, 'cash_entries'));
        cashSnap.forEach((d) => {
          const cash = d.data() as any;
          if (!cash.isDeleted) return;
          const storeId = (cash.userId || cash.userEmail || cash.shopId || 'unknown').toLowerCase();
          if (storeIdFilter && storeIdFilter !== '__ALL__' && storeId !== storeIdFilter.toLowerCase()) return;
          results.push({
            id: cash.id,
            entityType: 'cash_entry',
            title: `ক্যাশ এন্ট্রি (${cash.type}): ৳${cash.amount} - ${cash.note || 'নোট নেই'}`,
            storeId,
            userEmail: cash.userId,
            deletedAt: typeof cash.deletedAt === 'string' ? new Date(cash.deletedAt).getTime() : (Number(cash.deletedAt) || Date.now()),
            deletedBy: cash.deletedBy || 'ব্যবহারকারী',
            data: cash
          });
        });
      } catch {}

      // Sort newest deleted first
      return results.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    } catch (e) {
      console.error('Firebase fetchAllSoftDeletedRecords error:', e);
      return [];
    }
  }

  // Super Admin: Block or Unblock Store User Anytime
  async toggleBlockStoreUser(
    uidOrEmail: string,
    isBlocked: boolean,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanEmail = (uidOrEmail || '').trim().toLowerCase();
      if (!cleanEmail) return { success: false, error: 'User identifier is required' };

      // Never block master admin
      if (this.isSuperAdmin(cleanEmail) && isBlocked) {
        return { success: false, error: 'মাস্টার সুপার এডমিন অ্যাকাউন্ট ব্লক করা সম্ভব নয়।' };
      }

      const userDocRef = doc(db, 'users', cleanEmail);
      const updatePayload = {
        isBlocked,
        blockedReason: isBlocked ? (reason || 'সুপার এডমিন কর্তৃক স্টোর সাময়িকভাবে স্থগিত করা হয়েছে') : '',
        updatedAt: new Date().toISOString()
      };

      await setDoc(userDocRef, updatePayload, { merge: true });

      // Also sync to server backend API
      try {
        if (typeof fetch !== 'undefined') {
          fetch('/api/admin/block-store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identifier: cleanEmail,
              isBlocked,
              reason: updatePayload.blockedReason
            })
          }).catch(() => {});
        }
      } catch {}

      return { success: true };
    } catch (e: any) {
      console.error('Firebase toggleBlockStoreUser error:', e);
      return { success: false, error: e?.message || 'Failed to update store status' };
    }
  }
}

export const firebaseService = new FirebaseService();
