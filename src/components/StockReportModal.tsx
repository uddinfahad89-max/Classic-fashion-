import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  BarChart3,
  Package,
  TrendingUp,
  Wallet,
  Search,
  Download,
  Printer,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit2,
  ArrowUpDown,
  Boxes,
  Info,
} from 'lucide-react';
import {
  ProductStockItem,
  ThermalPrinterSettings,
  Language,
  UserProfile,
} from '../types';
import { useBackHandler } from '../utils/useBackHandler';
import { exportStockValuationToExcel } from '../utils/barcodeUtils';

interface StockReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductStockItem[];
  settings: ThermalPrinterSettings;
  language?: Language;
  userProfile?: UserProfile;
  onOpenProductStock?: () => void;
}

type StockStatusFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'missing_cost';
type StockSortBy = 'sale_val_desc' | 'cost_val_desc' | 'qty_desc' | 'qty_asc' | 'name_asc';

export const StockReportModal: React.FC<StockReportModalProps> = ({
  isOpen,
  onClose,
  products,
  settings,
  language = 'bn',
  userProfile,
  onOpenProductStock,
}) => {
  const isBn = language === 'bn';
  const canViewCostAndProfit =
    userProfile?.role !== 'Staff' || Boolean(userProfile?.permissions?.canViewProfit);

  useBackHandler(
    'stockReportModal',
    isOpen,
    () => {
      onClose();
      return true;
    },
    46
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('all');
  const [sortBy, setSortBy] = useState<StockSortBy>('sale_val_desc');
  const [isPrintingReport, setIsPrintingReport] = useState(false);

  const hideCurrency =
    settings.hideCurrencySymbol ||
    settings.currencySymbol === '₹' ||
    !settings.currencySymbol;
  const sym = hideCurrency ? 'Rs ' : `${settings.currencySymbol} `;

  const formatMoney = (amount: number): string => {
    return `${sym}${Math.round(amount).toLocaleString('en-IN')}`;
  };

  // Core stock valuation metrics across entire inventory
  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalSaleValue = 0;
    let totalPurchaseValue = 0;
    let estimatedProfit = 0;
    let itemsWithCostCount = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let missingCostCount = 0;

    for (const p of products) {
      const qty = Math.max(0, Number(p.stock) || 0);
      const saleRate = Math.max(0, Number(p.price) || 0);
      const costRate = Math.max(0, Number(p.purchasePrice) || 0);

      totalUnits += qty;
      totalSaleValue += qty * saleRate;
      totalPurchaseValue += qty * costRate;

      if (qty > 0) {
        inStockCount += 1;
        if (qty <= 3) lowStockCount += 1;
        if (costRate > 0) {
          itemsWithCostCount += 1;
          if (saleRate > 0) {
            estimatedProfit += qty * (saleRate - costRate);
          }
        } else {
          missingCostCount += 1;
        }
      } else {
        outOfStockCount += 1;
      }
    }

    return {
      totalItems: products.length,
      totalUnits,
      totalSaleValue,
      totalPurchaseValue,
      estimatedProfit,
      itemsWithCostCount,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      missingCostCount,
    };
  }, [products]);

  // Filtered and sorted products list
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const rows = products
      .map((p) => {
        const qty = Math.max(0, Number(p.stock) || 0);
        const saleRate = Math.max(0, Number(p.price) || 0);
        const costRate = Math.max(0, Number(p.purchasePrice) || 0);
        const saleVal = qty * saleRate;
        const costVal = qty * costRate;
        const profitVal = qty > 0 && costRate > 0 && saleRate > 0 ? saleVal - costVal : 0;

        return {
          product: p,
          qty,
          saleRate,
          costRate,
          saleVal,
          costVal,
          profitVal,
        };
      })
      .filter(({ product, qty, costRate }) => {
        if (statusFilter === 'in_stock' && qty <= 0) return false;
        if (statusFilter === 'low_stock' && (qty <= 0 || qty > 3)) return false;
        if (statusFilter === 'out_of_stock' && qty > 0) return false;
        if (statusFilter === 'missing_cost' && (qty <= 0 || costRate > 0)) return false;

        if (!q) return true;
        const pName = (product.name || '').toLowerCase();
        const pCode = (product.barcode || '').toLowerCase();
        const pCat = (product.category || '').toLowerCase();
        return pName.includes(q) || pCode.includes(q) || pCat.includes(q);
      });

    rows.sort((a, b) => {
      if (sortBy === 'sale_val_desc') return b.saleVal - a.saleVal;
      if (sortBy === 'cost_val_desc') return b.costVal - a.costVal;
      if (sortBy === 'qty_desc') return b.qty - a.qty;
      if (sortBy === 'qty_asc') return a.qty - b.qty;
      return (a.product.name || '').localeCompare(b.product.name || '');
    });

    return rows;
  }, [products, searchQuery, statusFilter, sortBy]);

  // Totals for the currently filtered view
  const filteredTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.units += r.qty;
        acc.saleVal += r.saleVal;
        acc.costVal += r.costVal;
        acc.profitVal += r.profitVal;
        return acc;
      },
      { units: 0, saleVal: 0, costVal: 0, profitVal: 0 }
    );
  }, [filteredRows]);

  useEffect(() => {
    if (!isPrintingReport) return;

    const cleanup = () => setIsPrintingReport(false);
    window.addEventListener('afterprint', cleanup);
    const timer = window.setTimeout(() => {
      window.print();
    }, 80);
    const fallbackTimer = window.setTimeout(() => {
      setIsPrintingReport(false);
    }, 60000);

    return () => {
      window.removeEventListener('afterprint', cleanup);
      window.clearTimeout(timer);
      window.clearTimeout(fallbackTimer);
    };
  }, [isPrintingReport]);

  if (!isOpen) return null;

  const printPortal =
    isPrintingReport &&
    typeof document !== 'undefined' &&
    createPortal(
      <div id="stock-report-print-root" className="active-print bg-white text-black p-4 font-sans">
        <div className="border-b-2 border-black pb-3 mb-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black uppercase">
              {settings.storeName || (isBn ? 'আমার দোকান' : 'MY STORE')}
            </h1>
            {settings.storeAddress && <p className="text-xs">{settings.storeAddress}</p>}
            {settings.storePhone && <p className="text-xs">Tel: {settings.storePhone}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-base font-black">
              {isBn ? 'বর্তমান স্টক ভ্যালু রিপোর্ট' : 'CURRENT STOCK VALUATION REPORT'}
            </h2>
            <p className="text-xs">
              {new Date().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}{' '}
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
          {canViewCostAndProfit && (
            <div className="border border-black p-2 rounded">
              <div className="font-bold">
                {isBn ? 'কেনা দামে মোট মাল (Cost Value)' : 'Total Purchase Value'}
              </div>
              <div className="text-base font-black">{formatMoney(summary.totalPurchaseValue)}</div>
            </div>
          )}
          <div className="border border-black p-2 rounded">
            <div className="font-bold">
              {isBn ? 'বিক্রয় মূল্যে মোট মাল (Sale Value)' : 'Total Selling Value'}
            </div>
            <div className="text-base font-black">{formatMoney(summary.totalSaleValue)}</div>
          </div>
          <div className="border border-black p-2 rounded">
            <div className="font-bold">{isBn ? 'মোট আইটেম ও পিস' : 'Items & Total Units'}</div>
            <div className="text-base font-black">
              {summary.totalItems} / {summary.totalUnits} Pcs
            </div>
          </div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y-2 border-black bg-stone-100">
              <th className="text-left py-1.5 px-1">#</th>
              <th className="text-left py-1.5 px-1">{isBn ? 'প্রোডাক্ট' : 'Product'}</th>
              <th className="text-right py-1.5 px-1">{isBn ? 'স্টক' : 'Qty'}</th>
              {canViewCostAndProfit && (
                <>
                  <th className="text-right py-1.5 px-1">{isBn ? 'কেনা দর' : 'Cost'}</th>
                  <th className="text-right py-1.5 px-1">{isBn ? 'মোট কেনা' : 'Cost Val'}</th>
                </>
              )}
              <th className="text-right py-1.5 px-1">{isBn ? 'বিক্রয় দর' : 'Rate'}</th>
              <th className="text-right py-1.5 px-1">{isBn ? 'মোট বিক্রয়' : 'Sale Val'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(({ product, qty, costRate, costVal, saleRate, saleVal }, idx) => (
              <tr key={product.id} className="border-b border-stone-300">
                <td className="py-1 px-1">{idx + 1}</td>
                <td className="py-1 px-1 font-semibold">
                  {product.name}
                  {product.barcode ? ` (${product.barcode})` : ''}
                </td>
                <td className="py-1 px-1 text-right font-mono">
                  {qty} {product.unit || 'Pcs'}
                </td>
                {canViewCostAndProfit && (
                  <>
                    <td className="py-1 px-1 text-right font-mono">{costRate > 0 ? formatMoney(costRate) : '-'}</td>
                    <td className="py-1 px-1 text-right font-mono">{costVal > 0 ? formatMoney(costVal) : '-'}</td>
                  </>
                )}
                <td className="py-1 px-1 text-right font-mono">{formatMoney(saleRate)}</td>
                <td className="py-1 px-1 text-right font-mono font-bold">{formatMoney(saleVal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-black">
              <td colSpan={2} className="py-1.5 px-1">
                {isBn ? `মোট (${filteredRows.length} টি আইটেম)` : `TOTAL (${filteredRows.length} Items)`}
              </td>
              <td className="py-1.5 px-1 text-right font-mono">{filteredTotals.units}</td>
              {canViewCostAndProfit && (
                <>
                  <td className="py-1.5 px-1"></td>
                  <td className="py-1.5 px-1 text-right font-mono">{formatMoney(filteredTotals.costVal)}</td>
                </>
              )}
              <td className="py-1.5 px-1"></td>
              <td className="py-1.5 px-1 text-right font-mono">{formatMoney(filteredTotals.saleVal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>,
      document.body
    );

  return (
    <>
      {printPortal}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-3xl overflow-hidden my-auto flex flex-col max-h-[93vh]">
          {/* Header */}
          <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-gradient-to-r from-indigo-700 via-blue-700 to-emerald-600 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-black tracking-tight truncate">
                  {isBn ? 'বর্তমান স্টক ভ্যালু রিপোর্ট (Stock Report)' : 'Current Stock Valuation Report'}
                </h2>
                <p className="text-[11px] text-blue-100 truncate">
                  {isBn
                    ? 'আপনার দোকানে বর্তমানে মোট কত টাকার মাল আছে তার সম্পূর্ণ হিসাব'
                    : 'Complete value of all goods currently available in stock'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {products.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => exportStockValuationToExcel(products, canViewCostAndProfit)}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    title={isBn ? 'এক্সেল রিপোর্ট ডাউনলোড করুন' : 'Download Excel Report'}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isBn ? 'এক্সেল' : 'Excel'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrintingReport(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title={isBn ? 'রিপোর্ট প্রিন্ট / PDF করুন' : 'Print / Save PDF'}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isBn ? 'প্রিন্ট' : 'Print'}</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 bg-stone-50/70">
            {/* Hero Summary Valuation Cards */}
            <div className={`grid gap-2.5 ${canViewCostAndProfit ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {/* Card 1: Total Purchase / Cost Capital Value */}
              {canViewCostAndProfit && (
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-emerald-500/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wide">
                      {isBn ? 'কেনা দামে মোট মাল (পুঁজি)' : 'Total Cost Value'}
                    </span>
                    <Wallet className="w-4 h-4 text-emerald-200 shrink-0" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono mt-1 tracking-tight">
                    {formatMoney(summary.totalPurchaseValue)}
                  </div>
                  <div className="text-[10px] text-emerald-100 mt-1 flex items-center justify-between gap-1">
                    <span>
                      {isBn
                        ? `কেনা দর যুক্ত: ${summary.itemsWithCostCount}/${summary.inStockCount} আইটেম`
                        : `Cost entered: ${summary.itemsWithCostCount}/${summary.inStockCount} items`}
                    </span>
                  </div>
                </div>
              )}

              {/* Card 2: Total Selling / Retail Value */}
              <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-indigo-500/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-blue-100 uppercase tracking-wide">
                    {isBn ? 'বিক্রয় মূল্যে মোট মাল' : 'Total Selling Value'}
                  </span>
                  <TrendingUp className="w-4 h-4 text-blue-200 shrink-0" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono mt-1 tracking-tight">
                  {formatMoney(summary.totalSaleValue)}
                </div>
                <div className="text-[10px] text-blue-100 mt-1 flex items-center gap-1.5">
                  <Boxes className="w-3 h-3 shrink-0" />
                  <span>
                    {isBn
                      ? `মোট ${summary.totalUnits} পিস (${summary.inStockCount}টি প্রোডাক্ট স্টকে)`
                      : `${summary.totalUnits} units across ${summary.inStockCount} in-stock items`}
                  </span>
                </div>
              </div>

              {/* Card 3: Estimated Profit OR Stock Units Summary */}
              {canViewCostAndProfit ? (
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-amber-200/90">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                      {isBn ? 'সম্ভাব্য লাভ (Est. Profit)' : 'Estimated Profit'}
                    </span>
                    <BarChart3 className="w-4 h-4 text-amber-600 shrink-0" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-amber-700 mt-1 tracking-tight">
                    {formatMoney(summary.estimatedProfit)}
                  </div>
                  <div className="text-[10px] text-stone-500 mt-1">
                    {summary.itemsWithCostCount > 0
                      ? isBn
                        ? `কেনা দাম দেওয়া ${summary.itemsWithCostCount}টি আইটেমের হিসাবে`
                        : `Based on ${summary.itemsWithCostCount} items with cost price`
                      : isBn
                      ? 'প্রোডাক্টে কেনা দাম যোগ করলে লাভ দেখাবে'
                      : 'Add purchase rate to calculate profit'}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-stone-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wide">
                      {isBn ? 'মোট প্রোডাক্ট ও স্টক' : 'Total Inventory Qty'}
                    </span>
                    <Package className="w-4 h-4 text-blue-600 shrink-0" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-stone-900 mt-1 tracking-tight">
                    {summary.totalUnits} <span className="text-sm font-bold text-stone-500">{isBn ? 'পিস' : 'Pcs'}</span>
                  </div>
                  <div className="text-[10px] text-stone-500 mt-1">
                    {isBn
                      ? `${summary.inStockCount}টি স্টকে আছে • ${summary.outOfStockCount}টি শেষ`
                      : `${summary.inStockCount} in stock • ${summary.outOfStockCount} out`}
                  </div>
                </div>
              )}
            </div>

            {/* Helpful note when some stocked products don't have purchasePrice */}
            {canViewCostAndProfit && summary.missingCostCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5">
                <div className="flex items-start gap-2 text-xs text-amber-900">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {isBn
                      ? `${summary.missingCostCount}টি স্টক পণ্যে 'কেনা দাম' (Purchase Rate) দেওয়া নেই। সঠিক পুঁজির হিসাব পেতে এগুলো আপডেট করুন।`
                      : `${summary.missingCostCount} stocked item(s) don't have a Purchase Rate yet. Add cost rates for exact capital calculation.`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusFilter('missing_cost')}
                  className="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer transition-colors"
                >
                  {isBn ? 'তালিকা দেখুন' : 'View List'}
                </button>
              </div>
            )}

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all border ${
                  statusFilter === 'all'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {isBn ? `সব (${summary.totalItems})` : `All (${summary.totalItems})`}
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('in_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all border flex items-center gap-1 ${
                  statusFilter === 'in_stock'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isBn ? `স্টকে আছে (${summary.inStockCount})` : `In Stock (${summary.inStockCount})`}</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('low_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all border flex items-center gap-1 ${
                  statusFilter === 'low_stock'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isBn ? `লো স্টক (${summary.lowStockCount})` : `Low Stock (${summary.lowStockCount})`}</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('out_of_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all border flex items-center gap-1 ${
                  statusFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{isBn ? `স্টক শেষ (${summary.outOfStockCount})` : `Out (${summary.outOfStockCount})`}</span>
              </button>

              {canViewCostAndProfit && summary.missingCostCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('missing_cost')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all border ${
                    statusFilter === 'missing_cost'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                  }`}
                >
                  {isBn ? `কেনা দাম নেই (${summary.missingCostCount})` : `No Cost (${summary.missingCostCount})`}
                </button>
              )}
            </div>

            {/* Search + Sort Bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isBn
                      ? 'প্রোডাক্টের নাম বা SKU কোড দিয়ে খুঁজুন...'
                      : 'Search by product name or SKU...'
                  }
                  className="w-full bg-white border border-stone-200 pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as StockSortBy)}
                  className="text-xs font-bold text-stone-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="sale_val_desc">
                    {isBn ? 'বেশি বিক্রয় মূল্য আগে' : 'Highest Sale Value'}
                  </option>
                  {canViewCostAndProfit && (
                    <option value="cost_val_desc">
                      {isBn ? 'বেশি কেনা মূল্য আগে' : 'Highest Cost Value'}
                    </option>
                  )}
                  <option value="qty_desc">{isBn ? 'বেশি স্টক আগে' : 'Highest Qty'}</option>
                  <option value="qty_asc">{isBn ? 'কম স্টক আগে' : 'Lowest Qty'}</option>
                  <option value="name_asc">{isBn ? 'নাম (A-Z)' : 'Name (A-Z)'}</option>
                </select>
              </div>
            </div>

            {/* Product Breakdown List */}
            {filteredRows.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-2">
                <Package className="w-10 h-10 text-stone-300 mx-auto" />
                <p className="text-sm font-bold text-stone-700">
                  {products.length === 0
                    ? isBn
                      ? 'এখনো কোনো প্রোডাক্ট স্টকে যোগ করা হয়নি'
                      : 'No products added to stock yet'
                    : isBn
                    ? 'এই ফিল্টারে কোনো প্রোডাক্ট পাওয়া যায়নি'
                    : 'No products match this filter'}
                </p>
                {onOpenProductStock && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProductStock();
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Package className="w-4 h-4" />
                    <span>{isBn ? 'প্রোডাক্ট স্টক যোগ করুন' : 'Open Product Stock'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRows.map(({ product, qty, saleRate, costRate, saleVal, costVal, profitVal }, idx) => {
                  const isOut = qty <= 0;
                  const isLow = qty > 0 && qty <= 3;

                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-2xl border border-stone-200/90 p-3 sm:p-3.5 shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-mono font-bold text-stone-400">
                              #{idx + 1}
                            </span>
                            <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 truncate">
                              {product.name}
                            </h3>
                            {product.barcode && (
                              <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded border border-stone-200">
                                {product.barcode}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full font-mono ${
                                isOut
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : isLow
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {qty} {product.unit || 'Pcs'}
                            </span>
                            <span className="text-stone-500 font-mono">
                              {isBn ? 'বিক্রয় দর:' : 'Rate:'} <strong className="text-stone-800">{formatMoney(saleRate)}</strong>
                            </span>
                            {canViewCostAndProfit && (
                              <span className="text-stone-500 font-mono">
                                {isBn ? 'কেনা:' : 'Cost:'}{' '}
                                <strong className={costRate > 0 ? 'text-emerald-700' : 'text-rose-500'}>
                                  {costRate > 0 ? formatMoney(costRate) : isBn ? 'নেই' : 'N/A'}
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {onOpenProductStock && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenProductStock();
                            }}
                            className="p-1.5 rounded-xl bg-stone-100 hover:bg-blue-50 text-stone-600 hover:text-blue-700 transition-colors cursor-pointer shrink-0"
                            title={isBn ? 'স্টক বা দাম আপডেট করুন' : 'Edit Stock or Price'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Valuation Strip */}
                      <div
                        className={`grid gap-2 pt-2 border-t border-stone-100 text-xs ${
                          canViewCostAndProfit ? 'grid-cols-3' : 'grid-cols-1'
                        }`}
                      >
                        {canViewCostAndProfit && (
                          <div className="bg-emerald-50/70 px-2.5 py-1.5 rounded-xl border border-emerald-100">
                            <div className="text-[10px] font-semibold text-emerald-800">
                              {isBn ? 'মোট কেনা মূল্য' : 'Total Cost'}
                            </div>
                            <div className="font-mono font-black text-emerald-700">
                              {costVal > 0 ? formatMoney(costVal) : '—'}
                            </div>
                          </div>
                        )}

                        <div className="bg-blue-50/70 px-2.5 py-1.5 rounded-xl border border-blue-100">
                          <div className="text-[10px] font-semibold text-blue-800">
                            {isBn ? 'মোট বিক্রয় মূল্য' : 'Total Sale Value'}
                          </div>
                          <div className="font-mono font-black text-blue-700">
                            {formatMoney(saleVal)}
                          </div>
                        </div>

                        {canViewCostAndProfit && (
                          <div className="bg-amber-50/70 px-2.5 py-1.5 rounded-xl border border-amber-100">
                            <div className="text-[10px] font-semibold text-amber-900">
                              {isBn ? 'সম্ভাব্য লাভ' : 'Est. Profit'}
                            </div>
                            <div className="font-mono font-black text-amber-700">
                              {costRate > 0 && saleRate > 0 ? formatMoney(profitVal) : '—'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Bottom Filtered Totals & Actions Footer */}
          <div className="px-4 py-3 bg-white border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <div>
                <span className="text-[10px] text-stone-500 block">
                  {isBn ? `তালিকায় (${filteredRows.length} আইটেম)` : `Showing (${filteredRows.length} items)`}
                </span>
                <span className="font-mono font-black text-stone-900">
                  {filteredTotals.units} {isBn ? 'পিস' : 'Pcs'}
                </span>
              </div>
              {canViewCostAndProfit && (
                <div>
                  <span className="text-[10px] text-emerald-700 block font-semibold">
                    {isBn ? 'কেনা মূল্য' : 'Cost Value'}
                  </span>
                  <span className="font-mono font-black text-emerald-700">
                    {formatMoney(filteredTotals.costVal)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-[10px] text-indigo-700 block font-semibold">
                  {isBn ? 'বিক্রয় মূল্য' : 'Sale Value'}
                </span>
                <span className="font-mono font-black text-indigo-700">
                  {formatMoney(filteredTotals.saleVal)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenProductStock && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenProductStock();
                  }}
                  className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold cursor-pointer transition-colors"
                >
                  {isBn ? 'স্টক ম্যানেজ' : 'Manage Stock'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
