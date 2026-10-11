import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  BillInvoice,
  CashEntry,
  CustomerDue,
  ProductStockItem,
  ThermalPrinterSettings,
  PurchaseTrip
} from '../types';

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
  shopId?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

class FirebaseService {
  isConfigured(): boolean {
    return Boolean(db);
  }

  // Get active authenticated user ID
  getActiveUserId(): string | null {
    try {
      return auth.currentUser?.uid || null;
    } catch {
      return null;
    }
  }

  // Test Firestore connection
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Attempt a lightweight server read on a status collection
      const pingDocRef = doc(db, '_connection_test', 'ping');
      await setDoc(pingDocRef, {
        lastPing: new Date().toISOString(),
        client: 'classic-fashion-pos'
      }, { merge: true });
      return { success: true, message: 'Firebase Firestore connected successfully to classic-fashion-pos!' };
    } catch (err: any) {
      console.warn('Firebase connection test warning:', err);
      // In case rules deny writing to _connection_test, let's report gracefully
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
  // BARCODES TABLE / COLLECTION
  // ==========================================
  async syncBarcode(item: BarcodeItem, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = userId || this.getActiveUserId() || 'anonymous';
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
        shopId: shopId || uid,
        updatedAt: new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString(),
      };

      await setDoc(barcodeRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncBarcode error:', e);
      return false;
    }
  }

  async fetchBarcodes(userId?: string, shopId?: string): Promise<BarcodeItem[]> {
    try {
      const uid = userId || this.getActiveUserId();
      const barcodesRef = collection(db, 'barcodes');
      let q = query(barcodesRef);

      if (uid) {
        q = query(barcodesRef, where('userId', '==', uid));
      }

      const snapshot = await getDocs(q);
      const results: BarcodeItem[] = [];
      snapshot.forEach((d) => {
        results.push(d.data() as BarcodeItem);
      });
      return results;
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
  // INVOICES COLLECTION
  // ==========================================
  async syncInvoice(invoice: BillInvoice, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = userId || this.getActiveUserId() || 'anonymous';
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
        grandTotal: invoice.grandTotal || 0,
        paymentMethod: invoice.paymentMethod || 'Cash',
        status: (invoice as any).paymentStatus || (invoice as any).status || 'completed',
        timestamp: invoice.timestamp || Date.now(),
        userId: uid,
        shopId: shopId || uid,
        syncedAt: new Date().toISOString()
      };

      await setDoc(invoiceRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncInvoice error:', e);
      return false;
    }
  }

  // ==========================================
  // PRODUCTS COLLECTION
  // ==========================================
  async syncProduct(product: ProductStockItem, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = userId || this.getActiveUserId() || 'anonymous';
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
        shopId: shopId || uid,
        syncedAt: new Date().toISOString()
      };

      await setDoc(prodRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncProduct error:', e);
      return false;
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
      const uid = userId || this.getActiveUserId() || 'anonymous';
      const profileRef = doc(db, 'profiles', uid);

      const payload = {
        id: uid,
        shopId: shopId || uid,
        email: email || auth.currentUser?.email || '',
        phone: userPhone || settings.storePhone || '',
        storeName: settings.storeName || '',
        storePhone: settings.storePhone || '',
        storeAddress: settings.storeAddress || '',
        paperWidth: settings.paperWidth || '58mm',
        currencySymbol: settings.currencySymbol || '৳',
        footerNote: settings.footerNote || '',
        signatoryName: settings.signatoryName || '',
        syncedAt: new Date().toISOString()
      };

      await setDoc(profileRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncProfile error:', e);
      return false;
    }
  }

  // ==========================================
  // CASH ENTRIES COLLECTION
  // ==========================================
  async syncCashEntry(entry: CashEntry, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = userId || this.getActiveUserId() || 'anonymous';
      const cashRef = doc(db, 'cash_entries', entry.id);

      const payload = {
        ...entry,
        userId: uid,
        shopId: shopId || uid,
        syncedAt: new Date().toISOString()
      };

      await setDoc(cashRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncCashEntry error:', e);
      return false;
    }
  }

  // ==========================================
  // CUSTOMER DUES COLLECTION
  // ==========================================
  async syncCustomerDue(due: CustomerDue, userId?: string, shopId?: string): Promise<boolean> {
    try {
      const uid = userId || this.getActiveUserId() || 'anonymous';
      const dueRef = doc(db, 'customer_dues', due.id);

      const payload = {
        ...due,
        userId: uid,
        shopId: shopId || uid,
        syncedAt: new Date().toISOString()
      };

      await setDoc(dueRef, payload, { merge: true });
      return true;
    } catch (e) {
      console.error('Firebase syncCustomerDue error:', e);
      return false;
    }
  }
}

export const firebaseService = new FirebaseService();
