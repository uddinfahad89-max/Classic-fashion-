import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  User,
  FileText,
  Package,
  DollarSign,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { firebaseService } from '../services/firebaseService';
import {
  SoftDeletedItem,
  UserProfile,
  Language,
  BillInvoice,
  ProductStockItem,
  ThermalPrinterSettings,
} from '../types';

const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemRestored?: () => void;
  language?: Language;
  currentUserProfile?: UserProfile;
  settings?: ThermalPrinterSettings;
  onUpdateSettings?: (settings: ThermalPrinterSettings) => void;
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen,
  onClose,
  onItemRestored,
  language = 'bn',
  currentUserProfile,
  settings,
  onUpdateSettings,
}) => {
  const isBn = language === 'bn';
  const [items, setItems] = useState<SoftDeletedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [autoPurgedCount, setAutoPurgedCount] = useState<number>(0);

  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState<boolean>(() => {
    const activeSettings = settings || storageService.getSettings();
    return activeSettings.autoDeleteRecycleBin90Days !== false;
  });

  useEffect(() => {
    const activeSettings = settings || storageService.getSettings();
    setAutoDeleteEnabled(activeSettings.autoDeleteRecycleBin90Days !== false);
  }, [settings, isOpen]);

  const getDeletedAtMs = (deletedAt: number | string | undefined): number => {
    if (!deletedAt) return 0;
    const ms = typeof deletedAt === 'string' ? new Date(deletedAt).getTime() : Number(deletedAt);
    return isNaN(ms) ? 0 : ms;
  };

  // Purge items older than 90 days from a list and sync permanent deletion to Firebase
  const purgeExpiredItems = async (
    list: SoftDeletedItem[],
    enabled: boolean
  ): Promise<{ active: SoftDeletedItem[]; purgedCount: number }> => {
    if (!enabled || list.length === 0) {
      return { active: list, purgedCount: 0 };
    }
    const cutoffMs = Date.now() - RETENTION_MS;
    const expired: SoftDeletedItem[] = [];
    const active: SoftDeletedItem[] = [];

    for (const item of list) {
      const deletedAtMs = getDeletedAtMs(item.deletedAt);
      if (deletedAtMs > 0 && deletedAtMs <= cutoffMs) {
        expired.push(item);
      } else {
        active.push(item);
      }
    }

    if (expired.length > 0) {
      storageService.saveRecycleBinItems(active);
      // Permanently delete expired records from Firestore in background
      firebaseService.permanentlyDeleteSoftDeletedBatch(expired).catch(() => {});
    }

    return { active, purgedCount: expired.length };
  };

  // Load deleted items from both Local Storage and Firebase
  const loadDeletedItems = async (overrideAutoDelete?: boolean) => {
    setIsLoading(true);
    try {
      const activeSettings = settings || storageService.getSettings();
      const shouldAutoPurge =
        overrideAutoDelete !== undefined
          ? overrideAutoDelete
          : activeSettings.autoDeleteRecycleBin90Days !== false;

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
        (a, b) => getDeletedAtMs(b.deletedAt) - getDeletedAtMs(a.deletedAt)
      );

      // Apply 90-day auto-delete rule if enabled
      const { active, purgedCount } = await purgeExpiredItems(merged, shouldAutoPurge);
      if (purgedCount > 0) {
        setAutoPurgedCount((prev) => prev + purgedCount);
      }

      setItems(active);
      storageService.saveRecycleBinItems(active);
    } catch (err) {
      console.warn('Error loading recycle bin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setConfirmDeleteItemId(null);
      setShowClearConfirm(false);
      setAutoPurgedCount(0);
      loadDeletedItems();
    }
  }, [isOpen]);

  // Toggle 90-day auto-delete option directly from Recycle Bin
  const handleToggleAutoDelete = async (checked: boolean) => {
    setAutoDeleteEnabled(checked);
    const currentSettings = settings || storageService.getSettings();
    const updatedSettings: ThermalPrinterSettings = {
      ...currentSettings,
      autoDeleteRecycleBin90Days: checked,
    };

    if (onUpdateSettings) {
      onUpdateSettings(updatedSettings);
    } else {
      storageService.saveSettings(updatedSettings);
      const prof = storageService.getUserProfile();
      firebaseService.syncProfile(updatedSettings, undefined, undefined, prof.phone, prof.email);
    }

    if (checked) {
      const { active, purgedCount } = await purgeExpiredItems(items, true);
      if (purgedCount > 0) {
        setItems(active);
        setAutoPurgedCount((prev) => prev + purgedCount);
      }
    }
  };

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
    setConfirmDeleteItemId(null);
    try {
      // 1. Local restoration
      if (item.entityType === 'invoice') {
        const rawBill = item.data as BillInvoice;
        if (rawBill) {
          storageService.restoreBill(rawBill);
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
        await firebaseService.restoreSoftDeletedRecord(item.entityType, item.id, item.data);
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

  // Permanently delete a single item (Local + Firebase)
  const handlePermanentDelete = async (item: SoftDeletedItem) => {
    setActionLoadingId(item.id);
    setConfirmDeleteItemId(null);
    try {
      storageService.removeFromRecycleBin(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      await firebaseService.permanentlyDeleteSoftDeletedRecord(item.entityType, item.id);
    } catch (err) {
      console.error('Permanent delete error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete all items permanently (Local + Firebase)
  const handleDeleteAllPermanently = async () => {
    setIsLoading(true);
    try {
      const toDelete = [...items];
      storageService.clearRecycleBin();
      setItems([]);
      setShowClearConfirm(false);
      if (toDelete.length > 0) {
        await firebaseService.permanentlyDeleteSoftDeletedBatch(toDelete);
      }
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
      {/* 1. TOP HEADER: Deep Blue Header with back arrow */}
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
          <div>
            <h1 className="text-lg sm:text-xl font-medium tracking-wide leading-tight">
              Recycle Bin
            </h1>
            <p className="text-[11px] text-blue-100 leading-tight">
              {autoDeleteEnabled
                ? isBn
                  ? '৯০ দিন পর অটোমেটিক ডিলিট চালু আছে'
                  : 'Auto-deletes items after 90 days'
                : isBn
                ? 'অটোমেটিক ডিলিট বন্ধ আছে'
                : 'Auto-delete is turned off'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadDeletedItems()}
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

      {/* 2.5 AUTO-DELETE 90 DAYS OPTION BAR */}
      <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-amber-950">
                  {isBn
                    ? '৯০ দিন পর অটোমেটিক ডিলিট (Auto-Delete)'
                    : 'Auto-Delete After 90 Days'}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    autoDeleteEnabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {autoDeleteEnabled ? (isBn ? 'চালু (ON)' : 'ON') : (isBn ? 'বন্ধ (OFF)' : 'OFF')}
                </span>
              </div>
              <p className="text-[11px] text-amber-900/80 leading-snug mt-0.5">
                {autoDeleteEnabled
                  ? isBn
                    ? 'রিসাইকেল বিনের ডাটা ৯০ দিন পূর্ণ হলে অটোমেটিক চিরতরে ডিলিট হয়ে যাবে।'
                    : 'Items in the Recycle Bin are automatically deleted permanently after 90 days.'
                  : isBn
                  ? 'অপশনটি বন্ধ আছে — আপনি ডিলিট না করা পর্যন্ত ডাটা রিসাইকেল বিনে থাকবে।'
                  : 'Off — deleted items stay in the Recycle Bin until you manually delete them.'}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={autoDeleteEnabled}
              onChange={(e) => handleToggleAutoDelete(e.target.checked)}
              className="sr-only peer"
              aria-label={isBn ? '৯০ দিন পর অটোমেটিক ডিলিট' : 'Auto-delete after 90 days'}
            />
            <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1976d2]"></div>
          </label>
        </div>

        {autoPurgedCount > 0 && (
          <div className="max-w-2xl mx-auto mt-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {isBn
                  ? `৯০ দিনের বেশি পুরনো ${autoPurgedCount}টি ডাটা অটোমেটিক চিরতরে ডিলিট করা হয়েছে।`
                  : `Automatically deleted ${autoPurgedCount} expired item(s) older than 90 days.`}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setAutoPurgedCount(0)}
              className="text-emerald-700 hover:text-emerald-950 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
              const isConfirmingDelete = confirmDeleteItemId === item.id;
              const storeDisplay = item.storeName || 'Classic Fashion';
              const isSupplierOrParty = item.entityType === 'customer_due' || item.entityType === 'purchase_trip';
              const isProduct = item.entityType === 'product';
              const entityLabel =
                isSupplierOrParty
                  ? 'Supplier'
                  : item.entityType === 'invoice'
                  ? 'Invoice'
                  : isProduct
                  ? 'Product'
                  : 'Item';
              const daysRemaining = storageService.getRecycleBinDaysRemaining(item.deletedAt, RETENTION_DAYS);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-xs border border-stone-200 overflow-hidden transition-all hover:shadow-sm"
                >
                  {/* Top: Entity Info */}
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

                      {/* Deletion Time Subtitle with Trash Icon + 90-day Countdown */}
                      <div className="flex items-center justify-between gap-2 flex-wrap mt-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-stone-500">
                          <Trash2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>
                            {entityLabel} {getElapsedTimeString(item.deletedAt)}
                            {isProduct && item.data?.stock !== undefined ? ` • স্টক: ${item.data.stock}` : ''}
                          </span>
                        </div>

                        {autoDeleteEnabled && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              daysRemaining <= 7
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-stone-100 text-stone-600 border border-stone-200'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>
                              {daysRemaining === 0
                                ? isBn
                                  ? 'আজ অটো ডিলিট হবে'
                                  : 'Auto-deletes today'
                                : isBn
                                ? `${daysRemaining} দিন বাকি`
                                : `${daysRemaining}d left`}
                            </span>
                          </span>
                        )}
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
                  {isConfirmingDelete ? (
                    <div className="border-t border-red-200 bg-red-50 px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-red-800">
                        {isBn ? 'চিরতরে মুছে ফেলবেন?' : 'Delete permanently?'}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteItemId(null)}
                          disabled={isItemBusy}
                          className="px-3 py-1 rounded-md bg-white border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-100 cursor-pointer"
                        >
                          {isBn ? 'বাতিল' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDelete(item)}
                          disabled={isItemBusy}
                          className="px-3 py-1 rounded-md bg-[#d32f2f] text-white text-xs font-bold hover:bg-red-700 cursor-pointer flex items-center gap-1"
                        >
                          {isItemBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>{isBn ? 'হ্যাঁ, মুছুন' : 'Delete'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
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
                        onClick={() => setConfirmDeleteItemId(item.id)}
                        disabled={isItemBusy}
                        className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[#d32f2f] hover:bg-red-50 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4 text-[#d32f2f] stroke-[2.3]" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. STICKY BOTTOM BAR: DELETE ALL PERMANENTLY */}
      {items.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-stone-200 p-3 sm:p-4 shadow-lg shrink-0 max-w-2xl mx-auto w-full">
          {showClearConfirm ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-bold text-red-900 leading-snug">
                {isBn
                  ? `সাবধান! রিসাইকেল বিনের সকল ${items.length}টি ডাটা চিরতরে ডিলিট হয়ে যাবে এবং আর ফিরিয়ে আনা যাবে না। আপনি কি নিশ্চিত?`
                  : `WARNING: All ${items.length} items in the Recycle Bin will be permanently erased and cannot be recovered. Are you sure?`}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isLoading}
                  className="py-2.5 px-3 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 cursor-pointer"
                >
                  {isBn ? 'বাতিল করুন' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAllPermanently}
                  disabled={isLoading}
                  className="py-2.5 px-3 rounded-lg bg-[#d32f2f] text-white font-bold text-xs hover:bg-red-700 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{isBn ? 'হ্যাঁ, সব মুছে ফেলুন' : 'Yes, Delete All'}</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-lg border-2 border-[#d32f2f] text-[#d32f2f] hover:bg-red-50 active:scale-[0.99] font-black text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 transition-all uppercase cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 stroke-[2.5]" />
              <span>{isBn ? 'সবগুলো স্থায়ীভাবে মুছে ফেলুন (DELETE ALL PERMANENTLY)' : 'DELETE ALL PERMANENTLY'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
