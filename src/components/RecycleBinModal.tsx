import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  User,
  FileText,
  Package,
  BookOpen,
  DollarSign,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { firebaseService } from '../services/firebaseService';
import { SoftDeletedItem, UserProfile, Language, BillInvoice, ProductStockItem } from '../types';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemRestored?: () => void;
  language?: Language;
  currentUserProfile?: UserProfile;
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen,
  onClose,
  onItemRestored,
  language = 'bn',
  currentUserProfile,
}) => {
  const isBn = language === 'bn';
  const [items, setItems] = useState<SoftDeletedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('all');

  // Load deleted items from both Local Storage and Firebase
  const loadDeletedItems = async () => {
    setIsLoading(true);
    try {
      // 1. Get local deleted items
      const localItems = storageService.getRecycleBinItems();

      // 2. Fetch remote soft-deleted records from Firebase
      let remoteItems: SoftDeletedItem[] = [];
      try {
        const userEmail = currentUserProfile?.email || storageService.getUserProfile().email;
        remoteItems = await firebaseService.fetchAllSoftDeletedRecords(userEmail || undefined);
      } catch (err) {
        console.warn('Firebase fetch soft deleted records notice:', err);
      }

      // Merge and deduplicate by ID
      const map = new Map<string, SoftDeletedItem>();
      localItems.forEach((it) => map.set(it.id, it));
      remoteItems.forEach((it) => map.set(it.id, it));

      const merged = Array.from(map.values()).sort(
        (a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)
      );

      setItems(merged);
      storageService.saveRecycleBinItems(merged);
    } catch (err) {
      console.warn('Error loading recycle bin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDeletedItems();
    }
  }, [isOpen]);

  // Format elapsed time (e.g. "deleted 6 days ago")
  const getElapsedTimeString = (timestamp: number) => {
    if (!timestamp) return isBn ? 'সম্প্রতি ডিলিট করা হয়েছে' : 'deleted recently';
    const now = Date.now();
    const diffMs = Math.max(0, now - timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return isBn ? `${diffDays} দিন আগে ডিলিট করা হয়েছে` : `deleted ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    if (diffHours > 0) {
      return isBn ? `${diffHours} ঘণ্টা আগে ডিলিট করা হয়েছে` : `deleted ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    if (diffMins > 0) {
      return isBn ? `${diffMins} মিনিট আগে ডিলিট করা হয়েছে` : `deleted ${diffMins} min ago`;
    }
    return isBn ? 'কিছুক্ষণ আগে ডিলিট করা হয়েছে' : 'deleted just now';
  };

  // Restore / Undo a single item
  const handleUndo = async (item: SoftDeletedItem) => {
    setActionLoadingId(item.id);
    try {
      // 1. Local restoration
      if (item.entityType === 'invoice') {
        const rawBill = item.data as BillInvoice;
        if (rawBill) {
          const restoredBill: BillInvoice = { ...rawBill, isDeleted: false };
          storageService.saveBill(restoredBill);
          try {
            const deletedSet = storageService.getDeletedBillIds();
            deletedSet.delete(item.id);
            localStorage.setItem(
              'thermal_pos_deleted_bill_ids_v1',
              JSON.stringify(Array.from(deletedSet))
            );
          } catch {}
        }
      } else if (item.entityType === 'product') {
        const prod = item.data as ProductStockItem;
        if (prod) {
          storageService.restoreProduct(prod);
        }
      } else if (item.entityType === 'customer_due') {
        const due = item.data;
        if (due) {
          const dues = storageService.getCustomerDues().filter((d) => d.id !== due.id);
          dues.unshift({
            ...due,
            isDeleted: false,
            lastUpdated: Date.now()
          });
          storageService.saveCustomerDues(dues);
        }
      } else if (item.entityType === 'purchase_trip') {
        const trip = item.data;
        if (trip) {
          const trips = storageService.getPurchaseTrips().filter((t) => t.id !== trip.id);
          trips.unshift({ ...trip, isDeleted: false });
          storageService.savePurchaseTrips(trips);
        }
      } else if (item.entityType === 'cash_entry') {
        const cash = item.data;
        if (cash) {
          const entries = storageService.getCashEntries().filter((e) => e.id !== cash.id);
          entries.unshift({ ...cash, isDeleted: false });
          storageService.saveCashEntries(entries);
        }
      }

      // 2. Cloud restoration in Firebase
      try {
        await firebaseService.restoreSoftDeletedRecord(item.entityType, item.id);
      } catch (err) {
        console.warn('Firebase restore error:', err);
      }

      // 3. Remove from Recycle Bin state and local storage
      storageService.removeFromRecycleBin(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));

      if (onItemRestored) {
        onItemRestored();
      }
    } catch (err) {
      console.error('Failed to undo delete:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Permanently delete a single item
  const handlePermanentDelete = async (item: SoftDeletedItem) => {
    if (!window.confirm(isBn ? 'আপনি কি নিশ্চিত যে এটি চিরতরে মুছে ফেলতে চান?' : 'Permanently delete this item?')) {
      return;
    }
    setActionLoadingId(item.id);
    try {
      storageService.removeFromRecycleBin(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      console.error('Permanent delete error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete all items permanently
  const handleDeleteAllPermanently = async () => {
    if (
      !window.confirm(
        isBn
          ? 'সাবধান! রিসাইকেল বিনের সকল ডাটা চিরতরে ডিলিট হয়ে যাবে এবং আর ফিরিয়ে আনা যাবে না। আপনি কি নিশ্চিত?'
          : 'WARNING: All items in the Recycle Bin will be permanently erased. Are you sure?'
      )
    ) {
      return;
    }
    setIsLoading(true);
    try {
      storageService.clearRecycleBin();
      setItems([]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error('Clear all error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (filterType === 'all') return items;
    return items.filter((it) => it.entityType === filterType);
  }, [items, filterType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f5f5f5] animate-in fade-in duration-150">
      {/* 1. TOP HEADER: Matching user screenshot (Deep Blue Header with back arrow) */}
      <header className="bg-[#1976d2] text-white px-4 py-3.5 flex items-center justify-between shadow-md select-none shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1 -ml-1 text-white hover:bg-white/15 rounded-full transition-colors cursor-pointer"
            title={isBn ? 'ফিরে যান' : 'Back'}
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
          </button>
          <h1 className="text-lg sm:text-xl font-medium tracking-wide">
            {isBn ? 'Recycle Bin' : 'Recycle Bin'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDeletedItems}
            disabled={isLoading}
            className="p-1.5 text-white/90 hover:text-white hover:bg-white/15 rounded-full transition-colors cursor-pointer disabled:opacity-50"
            title={isBn ? 'রিফ্রেশ করুন' : 'Refresh'}
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* 2. SUB HEADER / FILTER PILLS */}
      <div className="bg-white border-b border-stone-200 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 shadow-xs">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            filterType === 'all'
              ? 'bg-[#1976d2] text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          {isBn ? 'সকল আইটেম' : 'All Items'} ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('invoice')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            filterType === 'invoice'
              ? 'bg-[#1976d2] text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          {isBn ? 'ইনভয়েস/বিল' : 'Invoices'} ({items.filter((x) => x.entityType === 'invoice').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('customer_due')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            filterType === 'customer_due'
              ? 'bg-[#1976d2] text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          {isBn ? 'পার্টি/সাপ্লায়ার/বাকি' : 'Parties & Dues'} ({items.filter((x) => x.entityType === 'customer_due').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('product')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            filterType === 'product'
              ? 'bg-[#1976d2] text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          {isBn ? 'প্রোডাক্ট স্টক' : 'Products'} ({items.filter((x) => x.entityType === 'product').length})
        </button>
      </div>

      {/* 3. SCROLLABLE LIST OF DELETED ITEMS */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 max-w-2xl mx-auto w-full">
        {isLoading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-stone-500">
            <Loader2 className="w-8 h-8 text-[#1976d2] animate-spin mb-3" />
            <p className="text-sm font-medium">{isBn ? 'রিসাইকেল বিন লোড হচ্ছে...' : 'Loading Recycle Bin...'}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-stone-200/70 flex items-center justify-center text-stone-400 mb-3">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-stone-700">
              {isBn ? 'রিসাইকেল বিন সম্পূর্ণ খালি' : 'Recycle Bin is Empty'}
            </h3>
            <p className="text-xs text-stone-500 max-w-xs mt-1.5 leading-relaxed">
              {isBn
                ? 'ডিলিট হওয়া যেকোনো ইনভয়েস, পার্টি বা প্রোডাক্ট এখানে জমা হবে এবং প্রয়োজনে Undo করে সক্রিয় তালিকায় ফিরিয়ে আনা যাবে।'
                : 'Any deleted invoices, parties, or products will appear here and can be restored using Undo.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {filteredItems.map((item) => {
              const isItemBusy = actionLoadingId === item.id;
              const storeDisplay = item.storeName || 'Classic Fashion';
              const isSupplierOrParty = item.entityType === 'customer_due' || item.entityType === 'purchase_trip';
              const entityLabel =
                isSupplierOrParty
                  ? 'Supplier'
                  : item.entityType === 'invoice'
                  ? 'Invoice'
                  : item.entityType === 'product'
                  ? 'Product'
                  : 'Item';

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-xs border border-stone-200 overflow-hidden transition-all hover:shadow-sm"
                >
                  {/* Top: Entity Info (Matching user screenshot) */}
                  <div className="p-3 sm:p-3.5 flex items-start gap-3">
                    {/* Circular Avatar */}
                    <div className="w-11 h-11 rounded-full border border-emerald-400 bg-emerald-50 shrink-0 flex items-center justify-center text-emerald-600">
                      {item.entityType === 'invoice' ? (
                        <FileText className="w-5 h-5 text-blue-600" />
                      ) : item.entityType === 'product' ? (
                        <Package className="w-5 h-5 text-amber-600" />
                      ) : item.entityType === 'cash_entry' ? (
                        <DollarSign className="w-5 h-5 text-purple-600" />
                      ) : (
                        <User className="w-5 h-5 text-emerald-600 stroke-[2.2]" />
                      )}
                    </div>

                    {/* Titles */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-base font-bold text-stone-900 truncate">
                          {item.title}
                        </h4>
                        {isProduct && item.data && (
                          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                            ৳{item.data.price || 0}
                          </span>
                        )}
                      </div>

                      {/* Deletion Time Subtitle with Trash Icon */}
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5">
                        <Trash2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>
                          {entityLabel} {getElapsedTimeString(item.deletedAt)}
                          {isProduct && item.data?.stock !== undefined ? ` • স্টক: ${item.data.stock}` : ''}
                        </span>
                      </div>

                      {/* Store Subtitle */}
                      <p className="text-xs text-stone-400 mt-0.5 truncate">
                        {isSupplierOrParty
                          ? `Supplier from ${storeDisplay}`
                          : isProduct
                          ? `Product from ${storeDisplay}`
                          : `${entityLabel} from ${storeDisplay}`}
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Two Actions (Undo & Delete) split by a middle divider */}
                  <div className="border-t border-stone-200 flex items-center divide-x divide-stone-200 bg-white">
                    {/* Left Button: Undo */}
                    <button
                      type="button"
                      onClick={() => handleUndo(item)}
                      disabled={isItemBusy}
                      className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[#1976d2] hover:bg-blue-50 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isItemBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#1976d2]" />
                      ) : (
                        <RotateCcw className="w-4 h-4 text-[#1976d2] stroke-[2.3]" />
                      )}
                      <span>Undo</span>
                    </button>

                    {/* Right Button: Delete Permanently */}
                    <button
                      type="button"
                      onClick={() => handlePermanentDelete(item)}
                      disabled={isItemBusy}
                      className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[#d32f2f] hover:bg-red-50 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 text-[#d32f2f] stroke-[2.3]" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. STICKY BOTTOM BAR: DELETE ALL PERMANENTLY */}
      {items.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-stone-200 p-3 sm:p-4 shadow-lg shrink-0 max-w-2xl mx-auto w-full">
          <button
            type="button"
            onClick={handleDeleteAllPermanently}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-lg border-2 border-[#d32f2f] text-[#d32f2f] hover:bg-red-50 active:scale-[0.99] font-black text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 transition-all uppercase cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 stroke-[2.5]" />
            <span>{isBn ? 'সবগুলো স্থায়ীভাবে মুছে ফেলুন (DELETE ALL PERMANENTLY)' : 'DELETE ALL PERMANENTLY'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
