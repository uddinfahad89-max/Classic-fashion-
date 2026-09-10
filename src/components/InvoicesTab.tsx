import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Calendar,
  Filter,
  Printer,
  Eye,
  Smartphone,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  CreditCard,
  Banknote,
  SmartphoneNfc,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { BillInvoice, ThermalPrinterSettings } from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';

interface InvoicesTabProps {
  bills: BillInvoice[];
  settings: ThermalPrinterSettings;
  onViewReceipt: (bill: BillInvoice) => void;
  onDeleteBill: (id: string) => void;
}

type DateFilterPreset = 'all' | 'today' | 'yesterday' | 'week' | 'custom';

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  bills,
  settings,
  onViewReceipt,
  onDeleteBill,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customDate, setCustomDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'upi' | 'card' | 'due'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; message: string } | null>(null);

  const sym = settings.currencySymbol || '₹';

  // Helper date matchers
  const isSameDay = (timestamp: number, targetDate: Date) => {
    const d = new Date(timestamp);
    return (
      d.getFullYear() === targetDate.getFullYear() &&
      d.getMonth() === targetDate.getMonth() &&
      d.getDate() === targetDate.getDate()
    );
  };

  // Filter bills
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      // 1. Search filter (Invoice #, Customer Name, Customer Phone, Item Name)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesInvoice = bill.invoiceNo.toLowerCase().includes(query);
        const matchesCustomer = bill.customerName?.toLowerCase().includes(query) || false;
        const matchesPhone = bill.customerPhone?.toLowerCase().includes(query) || false;
        const matchesItem = bill.items.some((it) => it.name.toLowerCase().includes(query));

        if (!matchesInvoice && !matchesCustomer && !matchesPhone && !matchesItem) {
          return false;
        }
      }

      // 2. Date filter
      if (datePreset === 'today') {
        if (!isSameDay(bill.timestamp, new Date())) return false;
      } else if (datePreset === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (!isSameDay(bill.timestamp, yesterday)) return false;
      } else if (datePreset === 'week') {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (bill.timestamp < sevenDaysAgo) return false;
      } else if (datePreset === 'custom' && customDate) {
        const [year, month, day] = customDate.split('-').map(Number);
        const target = new Date(year, month - 1, day);
        if (!isSameDay(bill.timestamp, target)) return false;
      }

      // 3. Payment filter
      if (paymentFilter !== 'all') {
        if (bill.paymentMethod !== paymentFilter) return false;
      }

      return true;
    });
  }, [bills, searchTerm, datePreset, customDate, paymentFilter]);

  // Financial Stats of filtered bills
  const stats = useMemo(() => {
    const totalCount = filteredBills.length;
    const totalRevenue = filteredBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const paidRevenue = filteredBills
      .filter((b) => b.paymentMethod !== 'due')
      .reduce((sum, b) => sum + b.grandTotal, 0);
    const dueRevenue = filteredBills
      .filter((b) => b.paymentMethod === 'due')
      .reduce((sum, b) => sum + b.grandTotal, 0);

    return { totalCount, totalRevenue, paidRevenue, dueRevenue };
  }, [filteredBills]);

  // Handlers
  const handleQuickPrint = async (bill: BillInvoice) => {
    setActionFeedback({ id: bill.id, message: 'Printing...' });
    const res = await thermalPrinterService.printViaBluetooth(bill, settings);
    if (res.success) {
      setActionFeedback({ id: bill.id, message: 'Printed via BLE!' });
    } else {
      // Fallback to browser print if not connected
      thermalPrinterService.printViaBrowser(bill, settings);
      setActionFeedback({ id: bill.id, message: 'Browser Print' });
    }
    setTimeout(() => setActionFeedback(null), 2200);
  };

  const handleRawBtPrint = (bill: BillInvoice) => {
    setActionFeedback({ id: bill.id, message: 'Opening RawBT...' });
    thermalPrinterService.printViaRawBT(bill, settings);
    setTimeout(() => setActionFeedback(null), 2000);
  };

  const handleDelete = (id: string, invNo: string) => {
    if (window.confirm(`Are you sure you want to delete Invoice #${invNo}?`)) {
      onDeleteBill(id);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-3.5">
      {/* 1. Header & Summary Stats */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-stone-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Invoices & Past Bills ({bills.length})</span>
            </h2>
            <p className="text-[11px] text-stone-500 font-medium">
              Every bill auto-saved with complete line items, discount, and payment records
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
              Total: {sym}{stats.totalRevenue.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2 pt-3 text-center">
          <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
            <span className="block text-[10px] uppercase font-bold text-stone-400">Bills</span>
            <span className="text-sm sm:text-base font-bold text-stone-800 font-mono">
              {stats.totalCount}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="block text-[10px] uppercase font-bold text-emerald-600">Paid Sales</span>
            <span className="text-sm sm:text-base font-bold text-emerald-700 font-mono">
              {sym}{stats.paidRevenue.toFixed(0)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
            <span className="block text-[10px] uppercase font-bold text-rose-500">Credit / Due</span>
            <span className="text-sm sm:text-base font-bold text-rose-700 font-mono">
              {sym}{stats.dueRevenue.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filters & Search Controls */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-stone-200 space-y-2.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Bill #, Customer Name, Phone, or Item..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 cursor-pointer font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Filters Row: Date Presets + Payment Method */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Date presets */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-semibold text-stone-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              Date:
            </span>
            {(['all', 'today', 'yesterday', 'week', 'custom'] as DateFilterPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer capitalize ${
                  datePreset === preset
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {preset === 'week' ? '7 Days' : preset}
              </button>
            ))}
          </div>

          {/* Payment filter dropdown */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] font-semibold text-stone-500">Payment:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="bg-stone-100 border border-stone-200 text-stone-800 text-[11px] font-bold px-2 py-1 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Modes</option>
              <option value="cash">Cash Only</option>
              <option value="upi">UPI Only</option>
              <option value="card">Card Only</option>
              <option value="due">Credit / Due Only</option>
            </select>
          </div>
        </div>

        {/* Custom Date Input if selected */}
        {datePreset === 'custom' && (
          <div className="pt-1 flex items-center gap-2">
            <span className="text-xs text-stone-600 font-medium">Pick Date:</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-stone-50 border border-stone-200 text-xs px-2.5 py-1 rounded-lg font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* 3. Invoices List */}
      <div className="space-y-2.5">
        {filteredBills.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-stone-200 space-y-2">
            <FileText className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-xs font-semibold text-stone-700">No invoices matched your filters</p>
            <p className="text-[11px] text-stone-400">
              Try clearing search keywords or choosing "All" in the date filter.
            </p>
            {(searchTerm || datePreset !== 'all' || paymentFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setDatePreset('all');
                  setCustomDate('');
                  setPaymentFilter('all');
                }}
                className="mt-2 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          filteredBills.map((bill) => {
            const isExpanded = expandedInvoiceId === bill.id;
            const isDue = bill.paymentMethod === 'due';
            const feedback = actionFeedback?.id === bill.id ? actionFeedback.message : null;

            return (
              <div
                key={bill.id}
                className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden hover:border-stone-300 transition-all"
              >
                {/* Main Card Summary */}
                <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-stone-900 font-mono">
                        #{bill.invoiceNo}
                      </span>

                      {/* Payment Status Pill */}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          isDue
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isDue ? 'Due' : 'Paid'} • {bill.paymentMethod}
                      </span>

                      {feedback && (
                        <span className="text-[10px] font-bold text-blue-600 animate-pulse flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {feedback}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-stone-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{bill.date}</span>
                      <span>•</span>
                      <span className="font-semibold text-stone-800">
                        {bill.customerName ? bill.customerName : 'Walk-in Customer'}
                        {bill.customerPhone ? ` (${bill.customerPhone})` : ''}
                      </span>
                      <span>•</span>
                      <span>{bill.items.length} {bill.items.length === 1 ? 'item' : 'items'}</span>
                    </div>
                  </div>

                  {/* Financial Total & Primary Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    <div className="text-left sm:text-right">
                      <div className="text-sm sm:text-base font-bold text-stone-900 font-mono">
                        {sym}{bill.grandTotal.toFixed(2)}
                      </div>
                      {bill.discount > 0 && (
                        <div className="text-[10px] text-stone-400 line-through font-mono">
                          {sym}{bill.subtotal.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                      {/* View & Reprint Receipt */}
                      <button
                        onClick={() => onViewReceipt(bill)}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="View Thermal Receipt preview and print options"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Receipt</span>
                      </button>

                      {/* Quick Print Button */}
                      <button
                        onClick={() => handleQuickPrint(bill)}
                        className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
                        title="1-Click Print (Bluetooth / Browser Fallback)"
                      >
                        <Printer className="w-4 h-4 text-stone-700" />
                      </button>

                      {/* RawBT Android Print */}
                      <button
                        onClick={() => handleRawBtPrint(bill)}
                        className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold cursor-pointer transition-colors"
                        title="Print via RawBT (Android Intent)"
                      >
                        <Smartphone className="w-4 h-4 text-amber-700" />
                      </button>

                      {/* Expand / Collapse Details */}
                      <button
                        onClick={() => toggleExpand(bill.id)}
                        className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                        title="Toggle Invoice Items"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(bill.id, bill.invoiceNo)}
                        className="p-1.5 rounded-xl text-stone-300 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Item Breakdown Details */}
                {isExpanded && (
                  <div className="bg-stone-50/80 p-3 sm:p-4 border-t border-stone-200 text-xs space-y-2">
                    <div className="font-semibold text-stone-700 text-[11px] uppercase tracking-wider">
                      Purchased Items Breakdown
                    </div>

                    <div className="divide-y divide-stone-200/60 bg-white rounded-xl border border-stone-200 overflow-hidden">
                      {bill.items.map((item, idx) => (
                        <div key={idx} className="p-2 sm:p-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-stone-800">{item.name}</span>
                            <div className="text-[11px] text-stone-400">
                              {sym}{item.price.toFixed(2)} × {item.qty}
                            </div>
                          </div>
                          <span className="font-bold font-mono text-stone-900">
                            {sym}{item.total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Summary Math */}
                    <div className="space-y-1 text-[11px] text-stone-600 pt-1">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-mono">{sym}{bill.subtotal.toFixed(2)}</span>
                      </div>
                      {bill.discount > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Discount:</span>
                          <span className="font-mono">-{sym}{bill.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-stone-900 text-xs border-t border-stone-200 pt-1">
                        <span>Grand Total:</span>
                        <span className="font-mono">{sym}{bill.grandTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-stone-500">
                        <span>Paid:</span>
                        <span className="font-mono">{sym}{bill.paidAmount.toFixed(2)}</span>
                      </div>
                      {bill.changeAmount > 0 && (
                        <div className="flex justify-between text-stone-500">
                          <span>Change Returned:</span>
                          <span className="font-mono">{sym}{bill.changeAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
