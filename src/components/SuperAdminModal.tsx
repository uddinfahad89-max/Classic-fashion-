import React, { useState, useEffect, useMemo } from 'react';
import {
  Crown,
  Store,
  Receipt,
  Package,
  Users,
  DollarSign,
  RefreshCw,
  X,
  Search,
  Filter,
  Ban,
  Check,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Building2,
  TrendingUp,
  FileText,
  Calendar,
  Lock,
  Unlock,
  ChevronRight,
} from 'lucide-react';
import {
  Language,
  StoreVendorAccount,
  SoftDeletedItem,
  BillInvoice,
  UserProfile,
} from '../types';
import { firebaseService, MASTER_ADMIN_EMAIL } from '../services/firebaseService';
import { storageService } from '../services/storageService';

interface SuperAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  currentUserProfile: UserProfile;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshLocalData?: () => void;
}

export const SuperAdminModal: React.FC<SuperAdminModalProps> = ({
  isOpen,
  onClose,
  language = 'bn',
  currentUserProfile,
  onShowToast,
  onRefreshLocalData,
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';

  const t = (bn: string, en: string, hi: string) => {
    if (isHi) return hi;
    if (isBn) return bn;
    return en;
  };

  // Tabs: 'stores' | 'transactions' | 'recovery'
  const [activeTab, setActiveTab] = useState<'stores' | 'transactions' | 'recovery'>('stores');

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Data states
  const [stores, setStores] = useState<StoreVendorAccount[]>([]);
  const [transactions, setTransactions] = useState<BillInvoice[]>([]);
  const [deletedRecords, setDeletedRecords] = useState<SoftDeletedItem[]>([]);

  // Filters
  const [storeSearch, setStoreSearch] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [txStoreFilter, setTxStoreFilter] = useState('__ALL__');
  const [recoveryStoreFilter, setRecoveryStoreFilter] = useState('__ALL__');
  const [recoveryTypeFilter, setRecoveryTypeFilter] = useState<string>('all');

  // Block Modal state
  const [blockingStore, setBlockingStore] = useState<StoreVendorAccount | null>(null);
  const [blockReason, setBlockReason] = useState('');

  // Initial load
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [allStores, allTx, allDeleted] = await Promise.all([
        firebaseService.fetchAllStores(),
        firebaseService.fetchAllTransactionsAcrossStores(),
        firebaseService.fetchAllSoftDeletedRecords(),
      ]);

      setStores(allStores);
      setTransactions(allTx);
      setDeletedRecords(allDeleted);
    } catch (e) {
      console.error('Super Admin data load error:', e);
      onShowToast(
        t('এডমিন ডাটা লোড করতে সমস্যা হয়েছে', 'Failed to load Admin data', 'एडमिन डेटा लोड करने में विफल'),
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Overview Stats
  const totalStoresCount = stores.length;
  const activeStoresCount = stores.filter((s) => !s.isBlocked).length;
  const blockedStoresCount = stores.filter((s) => s.isBlocked).length;
  const totalPlatformRevenue = transactions.reduce((sum, tx) => sum + (Number(tx.grandTotal) || 0), 0);
  const totalPlatformInvoices = transactions.length;
  const totalDeletedCount = deletedRecords.length;

  // Filtered Stores
  const filteredStores = stores.filter((s) => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.storeName || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.uid || '').toLowerCase().includes(q)
    );
  });

  // Filtered Transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (txStoreFilter !== '__ALL__') {
      const storeId = (tx.userId || (tx as any).userEmail || (tx as any).shopId || '').toLowerCase();
      if (storeId !== txStoreFilter.toLowerCase()) return false;
    }
    const q = txSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (tx.invoiceNo || '').toLowerCase().includes(q) ||
      (tx.customerName || '').toLowerCase().includes(q) ||
      (tx.customerPhone || '').includes(q) ||
      (tx.date || '').includes(q)
    );
  });

  // Filtered Soft-Deleted Records
  const filteredDeletedRecords = deletedRecords.filter((rec) => {
    if (recoveryStoreFilter !== '__ALL__') {
      if ((rec.storeId || '').toLowerCase() !== recoveryStoreFilter.toLowerCase()) return false;
    }
    if (recoveryTypeFilter !== 'all') {
      if (rec.entityType !== recoveryTypeFilter) return false;
    }
    return true;
  });

  // Handle Block / Unblock Store
  const handleConfirmToggleBlock = async () => {
    if (!blockingStore) return;
    const targetUid = blockingStore.email || blockingStore.uid;
    const newBlockedState = !blockingStore.isBlocked;

    setActionLoadingId(targetUid);
    try {
      const res = await firebaseService.toggleBlockStoreUser(
        targetUid,
        newBlockedState,
        blockReason.trim()
      );

      if (res.success) {
        setStores((prev) =>
          prev.map((s) =>
            (s.email || s.uid).toLowerCase() === targetUid.toLowerCase()
              ? {
                  ...s,
                  isBlocked: newBlockedState,
                  blockedReason: newBlockedState ? blockReason.trim() : '',
                }
              : s
          )
        );
        onShowToast(
          newBlockedState
            ? t(
                `স্টোর "${blockingStore.storeName}" সাময়িকভাবে ব্লক করা হয়েছে।`,
                `Store "${blockingStore.storeName}" has been blocked.`,
                `स्टोर "${blockingStore.storeName}" को ब्लॉक कर दिया गया है।`
              )
            : t(
                `স্টোর "${blockingStore.storeName}" সফলভাবে আনব্লক করা হয়েছে।`,
                `Store "${blockingStore.storeName}" has been unblocked.`,
                `स्टोर "${blockingStore.storeName}" को अनब्लॉक कर दिया गया है।`
              ),
          'success'
        );
        setBlockingStore(null);
        setBlockReason('');
      } else {
        onShowToast(res.error || 'Operation failed', 'error');
      }
    } catch {
      onShowToast('Action failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Single-Click Generic Data Restore
  const handleSingleClickRestore = async (item: SoftDeletedItem) => {
    setActionLoadingId(item.id);
    try {
      const success = await firebaseService.restoreSoftDeletedRecord(item.entityType, item.id);
      if (success) {
        // Remove restored item from local deleted state
        setDeletedRecords((prev) => prev.filter((r) => r.id !== item.id));

        // If restored item belongs to this active client store, update local cache
        const activeEmail = (currentUserProfile.email || '').toLowerCase();
        const itemStore = (item.storeId || '').toLowerCase();
        if (itemStore === activeEmail || itemStore.includes(activeEmail)) {
          if (item.entityType === 'invoice') {
            const rawBill = item.data as BillInvoice;
            if (rawBill) {
              const restoredBill: BillInvoice = { ...rawBill, isDeleted: false };
              storageService.saveBill(restoredBill);
              // Clean from deleted bill set
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
            const prod = item.data;
            if (prod) {
              storageService.saveProduct({ ...prod, isDeleted: false });
              try {
                const deletedSet = storageService.getDeletedProductIds();
                deletedSet.delete(item.id);
                localStorage.setItem(
                  'thermal_pos_deleted_prod_ids_v1',
                  JSON.stringify(Array.from(deletedSet))
                );
              } catch {}
            }
          }
          if (onRefreshLocalData) {
            onRefreshLocalData();
          }
        }

        onShowToast(
          t(
            `✓ ${item.title} সফলভাবে পুনরুদ্ধার (Restored) করা হয়েছে!`,
            `✓ ${item.title} restored successfully!`,
            `✓ ${item.title} सफलतापूर्वक पुनर्प्राप्त किया गया!`
          ),
          'success'
        );
      } else {
        onShowToast(
          t('পুনরুদ্ধার করতে ব্যর্থ হয়েছে।', 'Failed to restore record.', 'रिकॉर्ड पुनर्प्राप्त करने में विफल।'),
          'error'
        );
      }
    } catch (e: any) {
      onShowToast(e?.message || 'Restore error', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div
      id="super-admin-modal-overlay"
      className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-stone-900 text-white p-4 sm:p-5 relative shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-400/20 border border-amber-300/40 text-amber-300 flex items-center justify-center font-black text-xl shadow-inner">
                <Crown className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5">
                    {t(
                      'সুপার এডমিন কন্ট্রোল ও ডাটা রিকভারি',
                      'Super Admin Control & Data Recovery',
                      'सुपर एडमिन कंट्रोल व डेटा रिकवरी'
                    )}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-400 text-stone-950 shadow-2xs">
                    MASTER CONTROL
                  </span>
                </div>
                <p className="text-xs text-purple-200 mt-0.5 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {currentUserProfile.email} ({t('সর্বোচ্চ ক্ষমতা সম্পন্ন সুপার এডমিন', 'Master Super Admin', 'मास्टर सुपर एडमिन')})
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAllData}
                disabled={isLoading}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title={t('রিফ্রেশ করুন', 'Refresh Data', 'रिफ्रेश करें')}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('রিফ্রেশ', 'Refresh', 'रिफ्रेश')}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title={t('বন্ধ করুন', 'Close', 'बंद करें')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4 pt-3 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-purple-200 font-bold">
                {t('মোট স্টোর/ভেন্ডর', 'Total Stores', 'कुल स्टोर्स')}
              </p>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg sm:text-xl font-black">{totalStoresCount}</span>
                <span className="text-[10px] text-emerald-300 font-bold">
                  {activeStoresCount} {t('সক্রিয়', 'active', 'सक्रिय')}
                </span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-purple-200 font-bold">
                {t('মোট সেলস ভলিউম', 'Platform Revenue', 'कुल बिक्री')}
              </p>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg sm:text-xl font-black">
                  ৳{Math.round(totalPlatformRevenue).toLocaleString('en-IN')}
                </span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-purple-200 font-bold">
                {t('মোট লেনদেন', 'Total Invoices', 'कुल इनवॉइस')}
              </p>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg sm:text-xl font-black">{totalPlatformInvoices}</span>
                <Receipt className="w-3.5 h-3.5 text-purple-200" />
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-amber-200 font-bold">
                {t('মুছে ফেলা রেকর্ড (রিকভারি)', 'Soft-Deleted Items', 'हटाए गए रिकॉर्ड')}
              </p>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg sm:text-xl font-black text-amber-300">
                  {totalDeletedCount}
                </span>
                <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-stone-100 border-b border-stone-200 px-3 sm:px-5 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('stores')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                activeTab === 'stores'
                  ? 'border-purple-700 text-purple-900 bg-white rounded-t-xl shadow-2xs'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <Store className="w-4 h-4 text-purple-700" />
              <span>{t('স্টোর ও ভেন্ডর তালিকা', 'Stores & Vendors', 'स्टोर व वेंडर सूची')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700">
                {totalStoresCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                activeTab === 'transactions'
                  ? 'border-purple-700 text-purple-900 bg-white rounded-t-xl shadow-2xs'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <Receipt className="w-4 h-4 text-indigo-700" />
              <span>{t('সকল লেনদেন ওভারভিউ', 'Platform Transactions', 'सभी लेन-देन ओवरव्यू')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700">
                {totalPlatformInvoices}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recovery')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                activeTab === 'recovery'
                  ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-xl shadow-2xs'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-emerald-700" />
              <span>
                {t('এডমিন ডাটা রিকভারি প্যানেল', 'Admin Recovery Panel', 'एडमिन डेटा रिकवरी पैनल')}
              </span>
              {totalDeletedCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-black animate-pulse">
                  {totalDeletedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: STORES & MULTI-VENDOR MANAGEMENT */}
        {activeTab === 'stores' && (
          <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  placeholder={t(
                    'স্টোরের নাম, মালিকের নাম বা ইমেল দিয়ে খুঁজুন...',
                    'Search stores by name, owner, or email...',
                    'स्टोर का नाम, मालिक का नाम या ईमेल खोजें...'
                  )}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>{activeStoresCount} {t('সক্রিয়', 'Active', 'सक्रिय')}</span>
                </span>
                {blockedStoresCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200">
                    <Ban className="w-3 h-3 text-red-600" />
                    <span>{blockedStoresCount} {t('ব্লকড', 'Blocked', 'ब्लॉक')}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Stores Grid / Table */}
            <div className="space-y-2.5">
              {filteredStores.length === 0 ? (
                <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-200">
                  <Store className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs text-stone-500 font-bold">
                    {t('কোনো স্টোর পাওয়া যায়নি', 'No stores found', 'कोई स्टोर नहीं मिला')}
                  </p>
                </div>
              ) : (
                filteredStores.map((store) => {
                  const isMaster =
                    store.isSuperAdmin ||
                    (store.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

                  return (
                    <div
                      key={store.uid || store.email}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        store.isBlocked
                          ? 'bg-red-50/50 border-red-200 ring-1 ring-red-300/40'
                          : isMaster
                          ? 'bg-purple-50/40 border-purple-200 shadow-2xs'
                          : 'bg-white border-stone-200 hover:border-stone-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                            isMaster
                              ? 'bg-amber-400 text-stone-950 shadow-xs'
                              : store.isBlocked
                              ? 'bg-red-100 text-red-700'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {isMaster ? <Crown className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-stone-900">
                              {store.storeName || 'Vendor Store'}
                            </h3>
                            {isMaster && (
                              <span className="px-2 py-0.2 rounded-md text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-200">
                                MASTER STORE
                              </span>
                            )}
                            {store.isBlocked ? (
                              <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                                <Ban className="w-2.5 h-2.5" />
                                <span>{t('ব্লকড (Blocked)', 'Blocked', 'ब्लॉक')}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>{t('সক্রিয় (Active)', 'Active', 'सक्रिय')}</span>
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-stone-500 font-medium">
                            {t('মালিক:', 'Owner:', 'मालिक:')} <span className="font-semibold text-stone-800">{store.name}</span> •{' '}
                            <span className="font-mono text-[11px] text-stone-600">{store.email}</span>
                          </p>

                          {store.blockedReason && (
                            <p className="text-[11px] text-red-700 font-semibold bg-red-100/70 px-2 py-0.5 rounded-md mt-1 inline-block">
                              ⚠️ {t('ব্লক করার কারণ:', 'Reason:', 'कारण:')} {store.blockedReason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Store Stats & Control Buttons */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                        <div className="text-left sm:text-right">
                          <p className="text-[11px] text-stone-500 font-medium">
                            {store.totalInvoices || 0} {t('ইনভয়েস', 'Invoices', 'इनवॉइस')}
                          </p>
                          <p className="text-xs font-black text-stone-900">
                            ৳{Math.round(store.totalRevenue || 0).toLocaleString('en-IN')}
                          </p>
                        </div>

                        {/* Action: Block / Unblock Store */}
                        {!isMaster ? (
                          <button
                            type="button"
                            onClick={() => {
                              setBlockingStore(store);
                              setBlockReason(store.blockedReason || '');
                            }}
                            disabled={actionLoadingId === (store.email || store.uid)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                              store.isBlocked
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                            }`}
                          >
                            {actionLoadingId === (store.email || store.uid) ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : store.isBlocked ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span>{t('আনব্লক করুন', 'Unblock Store', 'अनब्लॉक करें')}</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span>{t('ব্লক করুন', 'Block Store', 'ब्लॉक करें')}</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
                            {t('সর্বোচ্চ এডমিন', 'Master Protected', 'मास्टर सुरक्षित')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: PLATFORM TRANSACTIONS OVERVIEW */}
        {activeTab === 'transactions' && (
          <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px] relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder={t(
                    'ইনভয়েস #, কাস্টমার বা তারিখ দিয়ে খুঁজুন...',
                    'Search by invoice #, customer or date...',
                    'इनवॉइस #, ग्राहक या तारीख खोजें...'
                  )}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              {/* Filter by Store */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-stone-500" />
                <select
                  value={txStoreFilter}
                  onChange={(e) => setTxStoreFilter(e.target.value)}
                  className="bg-stone-50 border border-stone-200 text-stone-800 text-xs font-bold rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="__ALL__">
                    {t('সকল স্টোর (All Stores)', 'All Stores', 'सभी स्टोर्स')}
                  </option>
                  {stores.map((s) => (
                    <option key={s.uid || s.email} value={s.email || s.uid}>
                      {s.storeName} ({s.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Invoices List */}
            <div className="space-y-2">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-200">
                  <Receipt className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs text-stone-500 font-bold">
                    {t('কোনো লেনদেন পাওয়া যায়নি', 'No transactions found', 'कोई लेन-देन नहीं मिला')}
                  </p>
                </div>
              ) : (
                filteredTransactions.map((tx) => {
                  const storeEmail = tx.userId || (tx as any).userEmail || tx.storeId || 'store';
                  const matchedStore = stores.find(
                    (s) =>
                      (s.email || s.uid).toLowerCase() === storeEmail.toLowerCase()
                  );

                  return (
                    <div
                      key={tx.id}
                      className="p-3 bg-white rounded-2xl border border-stone-200 hover:border-purple-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black text-xs shrink-0 border border-purple-200">
                          #{tx.invoiceNo}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-stone-900">
                              {tx.customerName || (isBn ? 'সাধারণ কাস্টমার' : 'Walk-in Customer')}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                              {matchedStore?.storeName || storeEmail.split('@')[0]}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.2 rounded-md uppercase ${
                                tx.paymentStatus === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {tx.paymentStatus || tx.paymentMethod}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 font-mono">
                            {tx.date} {tx.time || ''} • {tx.items?.length || 0} {t('আইটেম', 'items', 'सामान')}
                            {tx.customerPhone ? ` • 📞 ${tx.customerPhone}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                        <div>
                          <p className="text-sm font-black text-stone-900">
                            ৳{Math.round(tx.grandTotal).toLocaleString('en-IN')}
                          </p>
                          <p className="text-[10px] text-stone-500 uppercase font-bold">
                            {tx.paymentMethod}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: ADMIN DATA RECOVERY PANEL (SINGLE-CLICK RESTORE) */}
        {activeTab === 'recovery' && (
          <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 sm:p-4 flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs sm:text-sm font-black text-amber-950">
                  {t(
                    'এক ক্লিকে ডাটা পুনরুদ্ধার ইঞ্জিন (Single-Click Soft-Delete Recovery)',
                    'Single-Click Soft-Delete Data Recovery Engine',
                    'एक क्लिक डेटा पुनर्प्राप्ति इंजन'
                  )}
                </h4>
                <p className="text-xs text-amber-800 mt-0.5 font-medium leading-relaxed">
                  {t(
                    'যেকোনো স্টোরের অসাবধানতাবশত মুছে ফেলা বিল/ইনভয়েস, পণ্য বা খাতা এখানে নিরাপদে সংরক্ষিত আছে। "এক ক্লিকে পুনরুদ্ধার" বাটনে চাপ দিলেই ডাটা পূর্বের অবস্থায় ফিরে আসবে।',
                    'All accidentally deleted invoices, products, and customer dues across all stores are safely held here. Click "Single-Click Restore" to immediately recover records.',
                    'सभी गलती से हटाए गए बिल, उत्पाद व खाते यहाँ सुरक्षित हैं। एक क्लिक में डेटा वापस पाएँ।'
                  )}
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-2.5 flex-wrap">
              {/* Category Filter */}
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setRecoveryTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    recoveryTypeFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  {t('সকল রেকর্ড', 'All Records', 'सभी रिकॉर्ड')} ({deletedRecords.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryTypeFilter('invoice')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    recoveryTypeFilter === 'invoice'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  <Receipt className="w-3 h-3" />
                  <span>{t('ইনভয়েস', 'Invoices', 'इनवॉइस')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryTypeFilter('product')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    recoveryTypeFilter === 'product'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  <Package className="w-3 h-3" />
                  <span>{t('পণ্য', 'Products', 'उत्पाद')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryTypeFilter('customer_due')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    recoveryTypeFilter === 'customer_due'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>{t('বাকি খাতা', 'Dues', 'बाकी खाता')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryTypeFilter('cash_entry')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    recoveryTypeFilter === 'cash_entry'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  <span>{t('ক্যাশ খাতা', 'Cashbook', 'कैश खाता')}</span>
                </button>
              </div>

              {/* Store Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={recoveryStoreFilter}
                  onChange={(e) => setRecoveryStoreFilter(e.target.value)}
                  className="bg-stone-50 border border-stone-200 text-stone-800 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="__ALL__">
                    {t('সকল স্টোরের ডাটা', 'All Stores Data', 'सभी स्टोर्स का डेटा')}
                  </option>
                  {stores.map((s) => (
                    <option key={s.uid || s.email} value={s.email || s.uid}>
                      {s.storeName} ({s.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Deleted Items List */}
            <div className="space-y-2.5">
              {filteredDeletedRecords.length === 0 ? (
                <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-200">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-stone-600 font-bold">
                    {t(
                      'বর্তমানে কোনো রেকর্ড মুছে ফেলা অবস্থায় নেই (সব ডাটা সুরক্ষিত)',
                      'No soft-deleted records found. All data is intact.',
                      'कोई हटाए गए रिकॉर्ड नहीं मिले। सभी डेटा सुरक्षित है।'
                    )}
                  </p>
                </div>
              ) : (
                filteredDeletedRecords.map((item) => {
                  const isRestoring = actionLoadingId === item.id;
                  const dateStr = item.deletedAt
                    ? new Date(item.deletedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Unknown';

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 bg-white rounded-2xl border border-stone-200 hover:border-emerald-300 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center font-bold shrink-0">
                          {item.entityType === 'invoice' && <Receipt className="w-5 h-5 text-indigo-700" />}
                          {item.entityType === 'product' && <Package className="w-5 h-5 text-emerald-700" />}
                          {item.entityType === 'customer_due' && <Users className="w-5 h-5 text-amber-700" />}
                          {item.entityType === 'cash_entry' && <DollarSign className="w-5 h-5 text-blue-700" />}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-stone-900">
                              {item.title}
                            </h4>
                            <span className="px-2 py-0.2 rounded-md text-[10px] font-bold uppercase bg-stone-100 text-stone-700 border border-stone-200">
                              {item.entityType.replace('_', ' ')}
                            </span>
                            <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              {item.storeId}
                            </span>
                          </div>

                          <p className="text-[11px] text-stone-500 font-medium">
                            {t('মুছে ফেলার সময়:', 'Deleted on:', 'हटाने का समय:')}{' '}
                            <span className="font-semibold text-stone-700">{dateStr}</span> •{' '}
                            {t('মুছেছেন:', 'By:', 'हटाया गया:')}{' '}
                            <span className="font-semibold text-stone-700">
                              {item.deletedBy || 'User'}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Single-Click Restore Button */}
                      <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                        <button
                          type="button"
                          onClick={() => handleSingleClickRestore(item)}
                          disabled={isRestoring}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {isRestoring ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>{t('পুনরুদ্ধার হচ্ছে...', 'Restoring...', 'पुनर्प्राप्त हो रहा है...')}</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>
                                {t('⚡ এক ক্লিকে পুনরুদ্ধার (Restore)', '⚡ Single-Click Restore', '⚡ एक क्लिक में पुनर्प्राप्त')}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Modal Bottom Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span className="font-semibold flex items-center gap-1.5 text-stone-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{t('সুপার এডমিন রুলস সক্রিয় (Multi-Vendor Security Isolated)', 'Multi-Vendor Security Isolated', 'मल्टी-वेंडर सुरक्षा सक्रिय')}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold transition-colors cursor-pointer"
          >
            {t('প্যানেল বন্ধ করুন', 'Close Panel', 'पैनल बंद करें')}
          </button>
        </div>
      </div>

      {/* Confirmation Modal to Block/Unblock Store */}
      {blockingStore && (
        <div className="fixed inset-0 z-60 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  blockingStore.isBlocked
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {blockingStore.isBlocked ? (
                  <Unlock className="w-5 h-5" />
                ) : (
                  <Ban className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-black text-stone-900">
                  {blockingStore.isBlocked
                    ? t('স্টোর আনব্লক নিশ্চিতকরণ', 'Confirm Store Unblock', 'स्टोर अनब्लॉक पुष्टि')
                    : t('স্টোর ব্লক নিশ্চিতকরণ', 'Confirm Store Block', 'स्टोर ब्लॉक पुष्टि')}
                </h3>
                <p className="text-xs text-stone-500 font-medium">
                  {blockingStore.storeName} ({blockingStore.name})
                </p>
              </div>
            </div>

            {!blockingStore.isBlocked && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700">
                  {t('ব্লক করার কারণ (ঐচ্ছিক):', 'Block Reason (Optional):', 'ब्लॉक का कारण (वैकल्पिक):')}
                </label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder={t(
                    'যেমন: পেমেন্ট বকেয়া বা নীতিমালার লঙ্ঘন...',
                    'e.g. Overdue payment or terms violation...',
                    'जैसे: भुगतान बकाया या नियमों का उल्लंघन...'
                  )}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
            )}

            <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200 leading-relaxed font-medium">
              {blockingStore.isBlocked
                ? t(
                    'আনব্লক করার পর এই স্টোরটির ব্যবহারকারী যথারীতি লগইন ও বিলিং পরিচালনা করতে পারবেন।',
                    'After unblocking, users of this store will be able to log in and create bills as normal.',
                    'अनब्लॉक करने के बाद इस स्टोर के उपयोगकर्ता लॉगिन व बिलिंग कर सकेंगे।'
                  )
                : t(
                    'ব্লক করা হলে এই স্টোরটির ব্যবহারকারী অ্যাপে লগইন করতে পারবেন না এবং সাময়িক স্থগিত নোটিশ দেখতে পাবেন।',
                    'When blocked, store users will not be able to access the app and will see a suspension notice.',
                    'ब्लॉक होने पर स्टोर के उपयोगकर्ता ऐप में लॉगिन नहीं कर पाएँगे।'
                  )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setBlockingStore(null);
                  setBlockReason('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
              >
                {t('বাতিল', 'Cancel', 'रद्द करें')}
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleBlock}
                className={`px-4 py-2 rounded-xl text-xs font-black text-white transition-all shadow-xs cursor-pointer ${
                  blockingStore.isBlocked
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {blockingStore.isBlocked
                  ? t('হ্যাঁ, আনব্লক করুন', 'Yes, Unblock Store', 'हाँ, अनब्लॉक करें')
                  : t('হ্যাঁ, ব্লক করুন', 'Yes, Block Store', 'हाँ, ब्लॉक करें')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
