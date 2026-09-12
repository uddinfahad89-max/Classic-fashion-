import React, { useState } from 'react';
import {
  Users,
  Plus,
  Minus,
  Search,
  Trash2,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  Phone,
  CheckCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  CreditCard,
  FileText,
} from 'lucide-react';
import { CustomerDue, DueType, ThermalPrinterSettings, BillInvoice, Language } from '../types';
import { translations } from '../utils/i18n';

interface CustomerDueTabProps {
  dues: CustomerDue[];
  settings: ThermalPrinterSettings;
  language?: Language;
  onAddOrUpdateDue: (
    name: string,
    amount: number,
    phone?: string,
    note?: string,
    type?: DueType
  ) => void;
  onRecordPayment: (id: string, amount: number, note?: string) => void;
  onDeleteDue: (id: string) => void;
  onPrintDueSlip: (bill: BillInvoice) => void;
}

export const CustomerDueTab: React.FC<CustomerDueTabProps> = ({
  dues,
  settings,
  language = 'bn',
  onAddOrUpdateDue,
  onRecordPayment,
  onDeleteDue,
  onPrintDueSlip,
}) => {
  const t = translations[language];
  const isBn = language === 'bn';

  // New Due / Payable Form
  const [entryType, setEntryType] = useState<DueType>('receivable'); // 'receivable' = আমি পাবো, 'payable' = আমি দেবো (কাস্টমার পাওনাদার)
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custDue, setCustDue] = useState('');
  const [custNote, setCustNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'receivable' | 'payable'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Quick Action Modal/Sheet for Add Due/Advance or Receive/Settle Payment
  const [activeModal, setActiveModal] = useState<{
    customer: CustomerDue;
    action: 'add' | 'pay';
  } | null>(null);
  const [modalAmount, setModalAmount] = useState('');
  const [modalNote, setModalNote] = useState('');

  const sym = settings.currencySymbol || '₹';

  // Calculations
  const totalReceivable = dues
    .filter((d) => (d.type || 'receivable') === 'receivable')
    .reduce((sum, d) => sum + d.dueAmount, 0);

  const totalPayable = dues
    .filter((d) => d.type === 'payable')
    .reduce((sum, d) => sum + d.dueAmount, 0);

  const netBalance = totalReceivable - totalPayable;

  const countReceivable = dues.filter((d) => (d.type || 'receivable') === 'receivable').length;
  const countPayable = dues.filter((d) => d.type === 'payable').length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(custDue);
    if (!custName.trim() || isNaN(amount) || amount <= 0) {
      alert(
        isBn
          ? 'সঠিক কাস্টমারের নাম এবং টাকার পরিমাণ লিখুন'
          : 'Please enter a valid customer name and amount'
      );
      return;
    }

    onAddOrUpdateDue(custName.trim(), amount, custPhone.trim(), custNote.trim(), entryType);

    setCustName('');
    setCustPhone('');
    setCustDue('');
    setCustNote('');
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal) return;
    const amount = parseFloat(modalAmount);
    if (isNaN(amount) || amount <= 0) return;

    const customerType = activeModal.customer.type || 'receivable';

    if (activeModal.action === 'add') {
      const defaultNote =
        customerType === 'payable'
          ? isBn
            ? 'পাওনাদার হিসেবে অতিরিক্ত জমা'
            : 'Additional advance credit deposited'
          : isBn
          ? 'অতিরিক্ত বাকি যোগ'
          : 'Additional due balance added';
      onAddOrUpdateDue(
        activeModal.customer.name,
        amount,
        activeModal.customer.phone,
        modalNote.trim() || defaultNote,
        customerType
      );
    } else {
      const defaultNote =
        customerType === 'payable'
          ? isBn
            ? 'পাওনাদারকে পরিশোধ / পণ্য সমন্বয়'
            : 'Settle creditor payment / return adjustment'
          : isBn
          ? 'বাকি আদায় / পেমেন্ট জমা'
          : 'Due collection / payment received';
      onRecordPayment(activeModal.customer.id, amount, modalNote.trim() || defaultNote);
    }

    setActiveModal(null);
    setModalAmount('');
    setModalNote('');
  };

  // Generate a thermal print due/payable slip
  const handlePrintSlip = (customer: CustomerDue) => {
    const isPayable = customer.type === 'payable';
    const invoiceNo = (isPayable ? 'CR-' : 'DUE-') + String(Date.now()).slice(-5);
    const now = new Date();
    const dateFormatted = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const titleText = isPayable ? t.customerPayableSlipTitle : t.customerDueSlipTitle;

    const bill: BillInvoice = {
      id: 'due-slip-' + customer.id,
      invoiceNo,
      date: dateFormatted,
      timestamp: Date.now(),
      customerName:
        customer.name + (isPayable ? (isBn ? ' [পাওনাদার]' : ' [Creditor]') : (isBn ? ' [বাকি]' : ' [Due]')),
      customerPhone: customer.phone,
      items: [
        {
          id: 'item-balance',
          name: titleText,
          price: customer.dueAmount,
          qty: 1,
          total: customer.dueAmount,
        },
      ],
      subtotal: customer.dueAmount,
      discount: 0,
      grandTotal: customer.dueAmount,
      paymentMethod: 'due',
      paidAmount: 0,
      changeAmount: 0,
    };

    onPrintDueSlip(bill);
  };

  // Filter dues list
  const filteredDues = dues.filter((d) => {
    const customerType = d.type || 'receivable';
    if (activeFilter === 'receivable' && customerType !== 'receivable') return false;
    if (activeFilter === 'payable' && customerType !== 'payable') return false;

    const term = searchTerm.toLowerCase();
    return (
      d.name.toLowerCase().includes(term) ||
      (d.phone && d.phone.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      {/* 1. COMPREHENSIVE BALANCE BANNER (RECEIVABLE VS PAYABLE) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {/* Card 1: Total Receivable (আমি পাবো) */}
        <div
          onClick={() => setActiveFilter(activeFilter === 'receivable' ? 'all' : 'receivable')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeFilter === 'receivable'
              ? 'bg-red-100/80 border-red-400 ring-2 ring-red-400'
              : 'bg-red-50/80 hover:bg-red-100/60 border-red-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-red-600" />
              <span>{t.receivableTitle}</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-200 text-red-800">
              {countReceivable} {t.personCount}
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-black text-red-600 font-mono block">
            {sym}
            {totalReceivable.toFixed(2)}
          </span>
          <p className="text-[10px] text-red-600/80 mt-0.5">{t.receivableSub}</p>
        </div>

        {/* Card 2: Total Payable (আমি দেবো / কাস্টমার পাওনাদার) */}
        <div
          onClick={() => setActiveFilter(activeFilter === 'payable' ? 'all' : 'payable')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeFilter === 'payable'
              ? 'bg-blue-100/80 border-blue-400 ring-2 ring-blue-400'
              : 'bg-blue-50/80 hover:bg-blue-100/60 border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.payableTitle}</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-200 text-blue-800">
              {countPayable} {t.personCount}
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-black text-blue-600 font-mono block">
            {sym}
            {totalPayable.toFixed(2)}
          </span>
          <p className="text-[10px] text-blue-600/80 mt-0.5">{t.payableSub}</p>
        </div>

        {/* Card 3: Net Balance Position */}
        <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-stone-500" />
              <span>{t.netDueTitle}</span>
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                netBalance >= 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {netBalance >= 0 ? t.receivableHigher : t.payableHigher}
            </span>
          </div>
          <span
            className={`text-xl sm:text-2xl font-black font-mono block ${
              netBalance >= 0 ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {netBalance >= 0 ? '+' : ''}
            {sym}
            {netBalance.toFixed(2)}
          </span>
          <p className="text-[10px] text-stone-500 mt-0.5">{t.netDiffSub}</p>
        </div>
      </div>

      {/* 2. ADD CUSTOMER DUE / PAYABLE ENTRY FORM */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                entryType === 'receivable' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
              }`}
            >
              {entryType === 'receivable' ? (
                <ArrowDownLeft className="w-4 h-4" />
              ) : (
                <ArrowUpRight className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                {entryType === 'receivable' ? t.customerOwesMeTitle : t.iOweCustomerTitle}
              </h2>
              <p className="text-[11px] text-stone-400">{t.entryFormSubtitle}</p>
            </div>
          </div>

          {/* Direction Toggle Pills */}
          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200/80">
            <button
              type="button"
              onClick={() => setEntryType('receivable')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                entryType === 'receivable'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>{t.btnReceivable}</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryType('payable')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                entryType === 'payable'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>{t.btnPayable}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                {t.custNameLabel}
              </label>
              <input
                type="text"
                id="custName"
                required
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                placeholder={t.custNamePlaceholder}
                className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-stone-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                {t.custPhoneLabel}
              </label>
              <input
                type="text"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                placeholder={t.custPhonePlaceholder}
                className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-stone-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              {t.amountLabel}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono font-bold">
                {sym}
              </span>
              <input
                type="number"
                id="custDue"
                required
                min="0.01"
                step="any"
                value={custDue}
                onChange={(e) => setCustDue(e.target.value)}
                placeholder={
                  entryType === 'receivable' ? t.amountReceivablePlaceholder : t.amountPayablePlaceholder
                }
                className="w-full border border-stone-200 bg-stone-50/80 pl-8 pr-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-stone-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              {t.noteReasonLabel}
            </label>
            <input
              type="text"
              value={custNote}
              onChange={(e) => setCustNote(e.target.value)}
              placeholder={
                entryType === 'receivable'
                  ? t.noteReceivablePlaceholder
                  : t.notePayablePlaceholder
              }
              className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-stone-800"
            />
          </div>

          {/* Quick Note Suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-stone-400">{t.quickNoteLabel}</span>
            {(entryType === 'receivable'
              ? isBn
                ? ['বাকি কেনাকাটা', 'বাকি কাপড়/পোশাক', 'আংশিক বাকি', 'পুরানো বকেয়া']
                : ['Due Purchase', 'Cloth / Goods Due', 'Partial Balance', 'Previous Due']
              : isBn
              ? ['অগ্রিম জমা (Advance)', 'অর্ডারের অগ্রিম', 'পণ্য ফেরতের টাকা', 'কাপড় তৈরির বায়না']
              : ['Advance Deposit', 'Order Advance', 'Return Refund', 'Booking Advance']
            ).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setCustNote(tag)}
                className="text-[10px] px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium transition-colors cursor-pointer"
              >
                + {tag}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className={`w-full text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99] ${
              entryType === 'receivable'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <span>
              {entryType === 'receivable' ? t.saveDueBtn : t.savePayableBtn}
            </span>
          </button>
        </form>
      </div>

      {/* 3. SEARCH, FILTER TABS & CUSTOMER LIST */}
      <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {t.filterAll} ({dues.length})
            </button>
            <button
              onClick={() => setActiveFilter('receivable')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                activeFilter === 'receivable'
                  ? 'bg-red-600 text-white'
                  : 'bg-white border border-stone-200 text-red-700 hover:bg-red-50'
              }`}
            >
              <span>{t.filterReceivable}</span>
              <span className="text-[10px] opacity-90">({countReceivable})</span>
            </button>
            <button
              onClick={() => setActiveFilter('payable')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                activeFilter === 'payable'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-stone-200 text-blue-700 hover:bg-blue-50'
              }`}
            >
              <span>{t.filterPayable}</span>
              <span className="text-[10px] opacity-90">({countPayable})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchDuePlaceholder}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-stone-800"
            />
          </div>
        </div>

        {filteredDues.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            {searchTerm
              ? isBn
                ? 'খোঁজা অনুযায়ী কোনো কাস্টমার পাওয়া যায়নি।'
                : 'No matching customer found.'
              : activeFilter === 'payable'
              ? isBn
                ? 'কোনো কাস্টমার পাওনাদার হিসেবে এন্ট্রি করা নেই।'
                : 'No creditor or advance customer records found.'
              : isBn
              ? 'কোনো কাস্টমার হিসাব নেই। উপরে নতুন হিসাব যোগ করুন।'
              : 'No customer ledger records. Add a new record above.'}
          </div>
        ) : (
          <ul id="dueList" className="divide-y divide-stone-100">
            {filteredDues.map((customer) => {
              const isExpanded = expandedId === customer.id;
              const isPayable = customer.type === 'payable';

              return (
                <li
                  key={customer.id}
                  className="p-3.5 sm:p-4 hover:bg-stone-50/60 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-stone-900">{customer.name}</span>
                        {/* Type Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isPayable
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}
                        >
                          {isPayable ? (
                            <>
                              <ArrowUpRight className="w-3 h-3" />
                              <span>{isBn ? 'কাস্টমার পাওনাদার (সে পাবে)' : 'Creditor (Advance Balance)'}</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>{isBn ? 'আমি পাবো (বাকি)' : 'Receivable (Customer Due)'}</span>
                            </>
                          )}
                        </span>

                        {customer.phone && (
                          <span className="text-[11px] text-stone-500 font-mono flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded-md">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 mt-0.5 block">
                        {isBn ? 'সর্বশেষ আপডেট:' : 'Last updated:'}{' '}
                        {new Date(customer.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5">
                      <div className="text-right">
                        <span
                          className={`text-base font-black font-mono ${
                            isPayable ? 'text-blue-600' : 'text-red-600'
                          }`}
                        >
                          {sym}
                          {customer.dueAmount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-stone-400 block -mt-0.5">
                          {isPayable ? (isBn ? 'দোকান দেবে' : 'To Pay') : (isBn ? 'বকেয়া পাওনা' : 'Due Amount')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Quick Button 1: Increase (+ Due or + Advance) */}
                        <button
                          onClick={() => {
                            setActiveModal({ customer, action: 'add' });
                            setModalAmount('');
                            setModalNote('');
                          }}
                          className={`px-2.5 py-1.5 font-bold rounded-lg text-xs border transition-colors cursor-pointer flex items-center gap-1 ${
                            isPayable
                              ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                          }`}
                          title={
                            isPayable
                              ? isBn
                                ? 'অতিরিক্ত পাওনা/জমা যোগ'
                                : 'Add Advance / Credit'
                              : isBn
                              ? 'বাকি যোগ করুন'
                              : 'Add Due'
                          }
                        >
                          <Plus className="w-3 h-3" />
                          <span>
                            {isPayable ? (isBn ? 'জমা' : 'Advance') : (isBn ? 'বাকি' : 'Due')}
                          </span>
                        </button>

                        {/* Quick Button 2: Pay/Settle (- Receive or - Settle) */}
                        <button
                          onClick={() => {
                            setActiveModal({ customer, action: 'pay' });
                            setModalAmount(customer.dueAmount.toString());
                            setModalNote('');
                          }}
                          className={`px-2.5 py-1.5 font-bold rounded-lg text-xs border transition-colors cursor-pointer flex items-center gap-1 ${
                            isPayable
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'
                          }`}
                          title={
                            isPayable
                              ? isBn
                                ? 'পাওনাদারকে পরিশোধ করুন'
                                : 'Settle / Pay Creditor'
                              : isBn
                              ? 'বাকি আদায় জমা করুন'
                              : 'Collect Due Payment'
                          }
                        >
                          <Minus className="w-3 h-3" />
                          <span>
                            {isPayable ? (isBn ? 'পরিশোধ' : 'Settle') : (isBn ? 'আদায়' : 'Receive')}
                          </span>
                        </button>

                        {/* Print Receipt Slip */}
                        <button
                          onClick={() => handlePrintSlip(customer)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title={isBn ? 'স্লিপ প্রিন্ট করুন' : 'Print Slip'}
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* History toggle */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : customer.id)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title={isBn ? 'লেনদেনের হিস্ট্রি দেখুন' : 'View Transaction History'}
                        >
                          <Clock className="w-4 h-4" />
                        </button>

                        {/* Delete record */}
                        <button
                          onClick={() => {
                            const confirmMsg = isBn
                              ? `${customer.name}-এর সম্পূর্ণ হিসাব খাতা মুছে ফেলতে চান?`
                              : `Are you sure you want to delete ${customer.name}'s account record?`;
                            if (confirm(confirmMsg)) {
                              onDeleteDue(customer.id);
                            }
                          }}
                          className="p-1.5 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={isBn ? 'হিসাব মুছে ফেলুন' : 'Delete Account'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. TRANSACTION TIMELINE (EXPANDABLE) */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2 bg-stone-50/80 p-3 rounded-xl">
                      <div className="text-[11px] font-bold text-stone-700 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-500" />
                          <span>
                            {isBn
                              ? `${customer.name}-এর বিস্তারিত লেনদেন হিস্ট্রি:`
                              : `${customer.name}'s Transaction History:`}
                          </span>
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {customer.transactions?.length || 0} {isBn ? 'টি এন্ট্রি' : 'entries'}
                        </span>
                      </div>

                      {!customer.transactions || customer.transactions.length === 0 ? (
                        <p className="text-[11px] text-stone-400">
                          {isBn ? 'কোনো লেনদেন রেকর্ড নেই।' : 'No transaction records found.'}
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {customer.transactions.map((tx) => {
                            const isTxPayable = tx.dueType === 'payable';
                            const isAdded = tx.type === 'added';

                            return (
                              <div
                                key={tx.id}
                                className="text-xs flex items-center justify-between p-2 rounded-lg bg-white border border-stone-200/70"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                                      isAdded
                                        ? isTxPayable
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-red-100 text-red-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    {isAdded
                                      ? isTxPayable
                                        ? isBn
                                          ? '+ জমা (পাওনাদার)'
                                          : '+ Advance'
                                        : isBn
                                        ? '+ বাকি যোগ'
                                        : '+ Due Added'
                                      : isTxPayable
                                      ? isBn
                                        ? '- পরিশোধ'
                                        : '- Settle'
                                      : isBn
                                      ? '- আদায়'
                                      : '- Received'}
                                  </span>
                                  <span className="text-stone-700 truncate max-w-[200px] sm:max-w-xs">
                                    {tx.note}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono font-bold text-stone-900">
                                    {sym}
                                    {tx.amount.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-stone-400 font-mono">
                                    {tx.dateFormatted}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* QUICK ADD/PAY MODAL */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
              <h3 className="font-bold text-xs sm:text-sm text-stone-900">
                {activeModal.customer.type === 'payable'
                  ? activeModal.action === 'add'
                    ? isBn
                      ? '+ পাওনা/অগ্রিম জমা যোগ'
                      : '+ Add Advance / Credit'
                    : isBn
                    ? '- পাওনাদারকে পরিশোধ'
                    : '- Settle / Pay Creditor'
                  : activeModal.action === 'add'
                  ? isBn
                    ? '+ বাকি টাকার পরিমাণ যোগ'
                    : '+ Add Due Amount'
                  : isBn
                  ? '- বকেয়া বাকি আদায়'
                  : '- Collect Due Payment'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-stone-400 hover:text-stone-700 text-base leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-4 space-y-3">
              <div>
                <span className="text-xs text-stone-500">{isBn ? 'কাস্টমার:' : 'Customer:'}</span>
                <div className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                  <span>{activeModal.customer.name}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      activeModal.customer.type === 'payable'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {activeModal.customer.type === 'payable'
                      ? isBn
                        ? 'পাওনাদার'
                        : 'Creditor'
                      : isBn
                      ? 'বাকি'
                      : 'Due'}
                  </span>
                </div>
                <div
                  className={`text-xs font-mono font-semibold mt-0.5 ${
                    activeModal.customer.type === 'payable' ? 'text-blue-600' : 'text-red-600'
                  }`}
                >
                  {isBn ? 'বর্তমান ব্যালেন্স:' : 'Current Balance:'} {sym}
                  {activeModal.customer.dueAmount.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {isBn ? `টাকার পরিমাণ (${sym}) *` : `Amount (${sym}) *`}
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-stone-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {isBn ? 'বিবরণ / নোট' : 'Note / Reason'}
                </label>
                <input
                  type="text"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder={
                    activeModal.customer.type === 'payable'
                      ? activeModal.action === 'add'
                        ? isBn
                          ? 'যেমন: নতুন অর্ডারের অগ্রিম টাকা জমা'
                          : 'e.g. Advance deposit for new order'
                        : isBn
                        ? 'যেমন: নগদ বা ইউপিআই মারফত পাওনা শোধ'
                        : 'e.g. Settle advance via Cash or UPI'
                      : activeModal.action === 'add'
                      ? isBn
                        ? 'যেমন: নতুন পোশাক বাকি নেওয়া হলো'
                        : 'e.g. Purchased clothes on credit'
                      : isBn
                      ? 'যেমন: বাকি টাকা নগদে শোধ করলো'
                      : 'e.g. Due amount paid in cash'
                  }
                  className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs focus:outline-none focus:border-stone-900"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-xl text-xs text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer ${
                    activeModal.action === 'add'
                      ? activeModal.customer.type === 'payable'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {activeModal.action === 'add'
                    ? isBn
                      ? 'নিশ্চিত যোগ করুন'
                      : 'Confirm Add'
                    : isBn
                    ? 'নিশ্চিত নিষ্পত্তি করুন'
                    : 'Confirm Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
