import React, { useState, useMemo, useEffect } from 'react';
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
  MessageCircle,
  X,
  Share2,
  Calendar,
  AlertTriangle,
  Calculator,
} from 'lucide-react';
import { CustomerDue, DueType, ThermalPrinterSettings, BillInvoice, Language } from '../types';
import { translations } from '../utils/i18n';
import { KhatabookEntryModal, KhatabookEntryPayload } from './KhatabookEntryModal';
import { useBackHandler } from '../utils/useBackHandler';

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
  const sym = settings.currencySymbol || '₹';

  // Filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'receivable' | 'payable'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDue | null>(null);

  // Pop-up Modal for "+ ADD CUSTOMER"
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustType, setNewCustType] = useState<DueType>('receivable');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAmount, setNewCustAmount] = useState('');
  const [newCustNote, setNewCustNote] = useState('');

  // Pop-up Modal for Quick Payment / Due Entry on existing customer
  const [activeTxModal, setActiveTxModal] = useState<{
    customer: CustomerDue;
    action: 'add' | 'pay';
  } | null>(null);
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');

  // Khatabook Calculator Entry Modal State
  const [khatabookModal, setKhatabookModal] = useState<{
    isOpen: boolean;
    type: 'you_gave' | 'you_got';
    customer?: CustomerDue;
    isNewCustomer?: boolean;
  } | null>(null);

  // Report Modal / Print
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Native-like Android Back button handlers for CustomerDueTab
  useBackHandler('dueKhatabookModal', Boolean(khatabookModal?.isOpen), () => {
    setKhatabookModal(null);
    return true;
  }, 35);

  useBackHandler('dueTxModal', Boolean(activeTxModal), () => {
    setActiveTxModal(null);
    return true;
  }, 35);

  useBackHandler('dueAddCustomerModal', isAddCustomerModalOpen, () => {
    setIsAddCustomerModalOpen(false);
    return true;
  }, 35);

  useBackHandler('dueReportModal', isReportModalOpen, () => {
    setIsReportModalOpen(false);
    return true;
  }, 35);

  useBackHandler('dueCustomerTimeline', Boolean(selectedCustomer), () => {
    setSelectedCustomer(null);
    return true;
  }, 30);

  // Keep selectedCustomer in sync with updated dues
  useEffect(() => {
    if (selectedCustomer) {
      const fresh = dues.find((d) => d.id === selectedCustomer.id);
      if (fresh) {
        setSelectedCustomer(fresh);
      }
    }
  }, [dues]);

  // Totals calculations
  const totalReceivable = useMemo(() => {
    return dues
      .filter((d) => (d.type || 'receivable') === 'receivable')
      .reduce((sum, d) => sum + d.dueAmount, 0);
  }, [dues]);

  const totalPayable = useMemo(() => {
    return dues
      .filter((d) => d.type === 'payable')
      .reduce((sum, d) => sum + d.dueAmount, 0);
  }, [dues]);

  const countReceivable = dues.filter((d) => (d.type || 'receivable') === 'receivable').length;
  const countPayable = dues.filter((d) => d.type === 'payable').length;

  // Filtered customers
  const filteredDues = useMemo(() => {
    return dues.filter((d) => {
      const customerType = d.type || 'receivable';
      if (activeFilter === 'receivable' && customerType !== 'receivable') return false;
      if (activeFilter === 'payable' && customerType !== 'payable') return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        d.name.toLowerCase().includes(term) ||
        (d.phone && d.phone.toLowerCase().includes(term))
      );
    });
  }, [dues, activeFilter, searchTerm]);

  // Handle Add Customer Form
  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newCustAmount);
    if (!newCustName.trim() || isNaN(amount) || amount <= 0) {
      alert(
        isBn
          ? 'সঠিক কাস্টমারের নাম এবং টাকার পরিমাণ লিখুন'
          : 'Please enter a valid customer name and amount'
      );
      return;
    }

    onAddOrUpdateDue(
      newCustName.trim(),
      amount,
      newCustPhone.trim(),
      newCustNote.trim(),
      newCustType
    );

    // Reset & close modal
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAmount('');
    setNewCustNote('');
    setIsAddCustomerModalOpen(false);
  };

  // Handle Transaction Submit (Add Due / Settle Payment)
  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTxModal) return;
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0) return;

    const customerType = activeTxModal.customer.type || 'receivable';

    if (activeTxModal.action === 'add') {
      const defaultNote =
        customerType === 'payable'
          ? isBn
            ? 'পাওনাদার হিসেবে অতিরিক্ত জমা'
            : 'Additional credit deposited'
          : isBn
          ? 'অতিরিক্ত বাকি যোগ'
          : 'Additional due balance added';
      onAddOrUpdateDue(
        activeTxModal.customer.name,
        amount,
        activeTxModal.customer.phone,
        txNote.trim() || defaultNote,
        customerType
      );
    } else {
      const defaultNote =
        customerType === 'payable'
          ? isBn
            ? 'পাওনাদারকে পরিশোধ / মাল সমন্বয়'
            : 'Settle creditor payment / return'
          : isBn
          ? 'বাকি আদায় / পেমেন্ট জমা'
          : 'Due collection / payment received';
      onRecordPayment(activeTxModal.customer.id, amount, txNote.trim() || defaultNote);
    }

    setActiveTxModal(null);
    setTxAmount('');
    setTxNote('');
  };

  // Handle Khatabook Calculator Modal Save
  const handleKhatabookSave = (payload: KhatabookEntryPayload) => {
    if (!khatabookModal) return;

    if (khatabookModal.isNewCustomer) {
      const custName = payload.vendorOrParty || newCustName;
      if (!custName || !custName.trim()) {
        alert(isBn ? 'কাস্টমারের নাম লিখুন' : 'Please enter customer name');
        return;
      }
      onAddOrUpdateDue(
        custName.trim(),
        payload.amount,
        newCustPhone.trim(),
        payload.details,
        khatabookModal.type === 'you_gave' ? 'receivable' : 'payable'
      );
      setKhatabookModal(null);
      return;
    }

    const customer = khatabookModal.customer;
    if (!customer) return;

    const isPayable = customer.type === 'payable';

    if (khatabookModal.type === 'you_gave') {
      if (isPayable) {
        // Customer is payable (we owe them), and we gave them money -> Settlement
        onRecordPayment(
          customer.id,
          payload.amount,
          payload.details || (isBn ? 'পরিশোধ' : 'Payment')
        );
      } else {
        // Customer is receivable (they owe us), and we gave them goods on credit -> Add Due
        onAddOrUpdateDue(
          customer.name,
          payload.amount,
          customer.phone,
          payload.details || (isBn ? 'বাকি যোগ' : 'Due Added'),
          'receivable'
        );
      }
    } else {
      // you_got
      if (isPayable) {
        // Customer is payable (we owe them), and they gave us more money / advance
        onAddOrUpdateDue(
          customer.name,
          payload.amount,
          customer.phone,
          payload.details || (isBn ? 'অগ্রিম জমা' : 'Advance Credit'),
          'payable'
        );
      } else {
        // Customer is receivable (they owe us), and we got payment from them
        onRecordPayment(
          customer.id,
          payload.amount,
          payload.details || (isBn ? 'জমা নেওয়া হলো' : 'Payment Received')
        );
      }
    }

    setKhatabookModal(null);
  };

  // Generate Thermal Print Slip
  const handlePrintSlip = (customer: CustomerDue) => {
    const isPayable = customer.type === 'payable';
    const invoiceNo = (isPayable ? 'CR-' : 'DUE-') + String(Date.now()).slice(-5);
    const now = new Date();
    const dateFormatted = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const titleText = isPayable
      ? isBn
        ? 'কাস্টমার পাওনা রশিদ (অ্যাডভান্স)'
        : 'Customer Credit Slip (Advance)'
      : isBn
      ? 'কাস্টমার বকেয়া খাতা রশিদ'
      : 'Customer Due Ledger Slip';

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

  // Generate WhatsApp Reminder Link
  const handleWhatsAppReminder = (customer: CustomerDue) => {
    const isPayable = customer.type === 'payable';
    const cleanPhone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
    const store = settings.storeName || 'Our Store';

    let message = '';
    if (isPayable) {
      message = isBn
        ? `নমস্কার ${customer.name}, আপনার ${sym}${customer.dueAmount.toFixed(
            2
          )} টাকা ${store}-এ জমা রয়েছে। হিসাব সংক্রান্ত যেকোনো তথ্যের জন্য যোগাযোগ করুন।`
        : `Dear ${customer.name}, you have an advance credit balance of ${sym}${customer.dueAmount.toFixed(
            2
          )} with ${store}. Thank you.`;
    } else {
      message = isBn
        ? `নমস্কার ${customer.name}, ${store}-এ আপনার বকেয়া বাকির পরিমাণ ${sym}${customer.dueAmount.toFixed(
            2
          )}। অনুগ্রহ করে সময়মতো পরিশোধ করার অনুরোধ রইল। ধন্যবাদ!`
        : `Dear ${customer.name}, gentle reminder regarding your pending due balance of ${sym}${customer.dueAmount.toFixed(
            2
          )} at ${store}. Please settle at your earliest convenience. Thank you!`;
    }

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  // Initials generator
  const getInitials = (name: string) => {
    if (!name) return 'C';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Color generator based on name
  const getAvatarBg = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-700 border-blue-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-amber-100 text-amber-700 border-amber-200',
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-indigo-100 text-indigo-700 border-indigo-200',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-3.5 pb-28">
      {/* 1. KHATABOOK COMPACT TOP CARD: YOU WILL GIVE & YOU WILL GET */}
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200/90 overflow-hidden">
        {/* Top Two Metrics: Give vs Get */}
        <div className="grid grid-cols-2 divide-x divide-stone-200/80 p-3.5 sm:p-4 text-center">
          {/* You Will Give (আমি দেবো - কাস্টমার পাওনাদার) */}
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'payable' ? 'all' : 'payable')}
            className={`p-1.5 rounded-2xl transition-all cursor-pointer text-center ${
              activeFilter === 'payable' ? 'bg-emerald-50 ring-2 ring-emerald-500/50' : 'hover:bg-stone-50'
            }`}
          >
            <span className="text-[11px] font-bold text-stone-500 flex items-center justify-center gap-1 uppercase tracking-wider">
              <span>{isBn ? 'আপনি দেবেন' : 'You Will Give'}</span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                {countPayable}
              </span>
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono mt-1 tracking-tight">
              {sym}{totalPayable.toFixed(2)}
            </div>
            <span className="text-[10px] text-stone-400 font-medium">
              {isBn ? 'অগ্রিম জমা / কাস্টমার পাবে' : 'Customer advance balance'}
            </span>
          </button>

          {/* You Will Get (আমি পাবো - কাস্টমার বাকি) */}
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'receivable' ? 'all' : 'receivable')}
            className={`p-1.5 rounded-2xl transition-all cursor-pointer text-center ${
              activeFilter === 'receivable' ? 'bg-rose-50 ring-2 ring-rose-500/50' : 'hover:bg-stone-50'
            }`}
          >
            <span className="text-[11px] font-bold text-stone-500 flex items-center justify-center gap-1 uppercase tracking-wider">
              <span>{isBn ? 'আপনি পাবেন' : 'You Will Get'}</span>
              <span className="text-[10px] font-mono text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-full">
                {countReceivable}
              </span>
            </span>
            <div className="text-xl sm:text-2xl font-black text-rose-600 font-mono mt-1 tracking-tight">
              {sym}{totalReceivable.toFixed(2)}
            </div>
            <span className="text-[10px] text-stone-400 font-medium">
              {isBn ? 'মোট বকেয়া পাওনা' : 'Total dues to collect'}
            </span>
          </button>
        </div>

        {/* View Reports Bar */}
        <button
          type="button"
          onClick={() => setIsReportModalOpen(true)}
          className="w-full py-2.5 px-4 bg-stone-50 hover:bg-stone-100 border-t border-stone-200/80 flex items-center justify-between text-xs font-bold text-stone-700 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>{isBn ? 'বাকি খাতা রিপোর্ট দেখুন (PDF / Print)' : 'VIEW REPORTS (PDF)'}</span>
          </span>
          <span className="text-blue-600 text-xs font-bold flex items-center gap-0.5">
            <span>{isBn ? 'দেখুন' : 'View'}</span>
            <span>&gt;</span>
          </span>
        </button>
      </div>

      {/* 2. SEARCH BAR & FILTER CHIPS */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'কাস্টমারের নাম বা মোবাইল দিয়ে খুঁজুন...' : 'Search Customer by Name or Phone...'}
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs sm:text-sm shadow-2xs font-medium focus:outline-none focus:border-blue-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-sm font-bold cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            {isBn ? 'সব কাস্টমার' : 'All Customers'} ({dues.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('receivable')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeFilter === 'receivable'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
            }`}
          >
            <span>{isBn ? 'পাবেন (বাকি)' : "You'll Get"}</span>
            <span>({countReceivable})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('payable')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeFilter === 'payable'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <span>{isBn ? 'দেবেন (পাওনাদার)' : "You'll Give"}</span>
            <span>({countPayable})</span>
          </button>
        </div>
      </div>

      {/* 3. MAIN VIEW: SCROLLABLE LIST OF CUSTOMERS */}
      <div className="space-y-2">
        {filteredDues.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-stone-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">
                {searchTerm
                  ? isBn
                    ? 'কোনো কাস্টমার পাওয়া যায়নি'
                    : 'No matching customers found'
                  : isBn
                  ? 'বাকি খাতায় কোনো কাস্টমার নেই'
                  : 'No customer ledger entries'}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                {isBn
                  ? 'নিচের "+ কাস্টমার যোগ" বোতাম চেপে নতুন খাতা তৈরি করুন'
                  : 'Tap the "+ ADD CUSTOMER" button below to create an entry'}
              </p>
            </div>
            {!searchTerm && (
              <button
                type="button"
                onClick={() => setIsAddCustomerModalOpen(true)}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? 'কাস্টমার যোগ করুন' : 'Add Customer'}</span>
              </button>
            )}
          </div>
        ) : (
          filteredDues.map((customer) => {
            const isPayable = customer.type === 'payable';
            const updatedDate = new Date(customer.lastUpdated);
            const dateString = updatedDate.toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={customer.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-stone-300 p-3 sm:p-3.5 shadow-2xs transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2.5">
                  {/* Left: Initials Avatar & Name & Date */}
                  <div
                    onClick={() => setSelectedCustomer(customer)}
                    className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl border flex items-center justify-center font-bold text-sm shrink-0 ${getAvatarBg(
                        customer.name
                      )}`}
                    >
                      {getInitials(customer.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-stone-900 truncate">
                          {customer.name}
                        </span>
                        {isPayable && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                            {isBn ? 'পাবে' : 'Advance'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-400 font-medium">
                        {customer.phone ? (
                          <span className="font-mono text-stone-500">{customer.phone}</span>
                        ) : (
                          <span>{isBn ? 'মোবাইল নেই' : 'No phone'}</span>
                        )}
                        <span>•</span>
                        <span>{dateString}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & WhatsApp Remind Button */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-base sm:text-lg font-black font-mono tracking-tight ${
                        isPayable ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {sym}{customer.dueAmount.toFixed(2)}
                    </div>
                    <span className="text-[10px] text-stone-400 block -mt-0.5">
                      {isPayable
                        ? isBn
                          ? 'আপনি দেবেন'
                          : 'You will give'
                        : isBn
                        ? 'আপনি পাবেন'
                        : 'You will get'}
                    </span>
                  </div>
                </div>

                {/* Bottom Card Actions: Quick WhatsApp Remind + Settle/Add */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1.5 flex-wrap">
                  {/* WhatsApp REMIND Button */}
                  <button
                    type="button"
                    onClick={() => handleWhatsAppReminder(customer)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title={isBn ? 'হোয়াটসঅ্যাপে তাগাদা বা ব্যালেন্স পাঠান' : 'Send WhatsApp Reminder'}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isBn ? 'তাগাদা >' : 'REMIND >'}</span>
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {/* Settle/Payment Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setKhatabookModal({
                          isOpen: true,
                          type: isPayable ? 'you_gave' : 'you_got',
                          customer,
                        });
                      }}
                      className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border border-emerald-200/80 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <ArrowDownLeft className="w-3 h-3 stroke-[2.5]" />
                      <span>{isPayable ? (isBn ? 'পরিশোধ' : 'Settle') : (isBn ? 'জমা নিলাম' : 'Got ₹')}</span>
                    </button>

                    {/* Add More Due/Credit Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setKhatabookModal({
                          isOpen: true,
                          type: isPayable ? 'you_got' : 'you_gave',
                          customer,
                        });
                      }}
                      className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-800 border border-rose-200/80 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                      <span>{isPayable ? (isBn ? '+ জমা' : '+ Credit') : (isBn ? '+ বাকি' : 'Gave ₹')}</span>
                    </button>

                    {/* Print Slip */}
                    <button
                      type="button"
                      onClick={() => handlePrintSlip(customer)}
                      className="p-1.5 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-all cursor-pointer"
                      title={isBn ? 'রশিদ প্রিন্ট করুন' : 'Print Slip'}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. FLOATING "+ ADD CUSTOMER" BUTTON (Khatabook Style) */}
      <button
        id="floating-add-customer-btn"
        type="button"
        onClick={() => {
          setKhatabookModal({
            isOpen: true,
            type: 'you_gave',
            isNewCustomer: true,
          });
        }}
        className="fixed bottom-20 right-4 sm:right-8 z-30 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-full shadow-xl flex items-center gap-2 border-2 border-white cursor-pointer transition-all animate-in fade-in duration-200"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
        <span>{isBn ? '+ কাস্টমার যোগ' : '+ ADD CUSTOMER'}</span>
      </button>

      {/* 5. MODAL: ADD CUSTOMER POP-UP */}
      {isAddCustomerModalOpen && (
        <div
          id="add-customer-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            id="add-customer-modal-card"
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    {isBn ? 'নতুন কাস্টমার খাতা যোগ করুন' : 'Add New Customer'}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    {isBn ? 'কাস্টমারের নাম ও প্রারম্ভিক বাকি বা জমা' : 'Enter details to track dues'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddCustomerSubmit} className="p-5 space-y-3.5 overflow-y-auto">
              {/* Type Switcher: You'll Get vs You'll Give */}
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1.5">
                  {isBn ? 'হিসাবের ধরন (খাতা ক্যাটাগরি)' : 'Entry Type'}
                </label>
                <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setNewCustType('receivable')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      newCustType === 'receivable'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>{isBn ? 'আমি পাবো (বাকি)' : "You'll Get (Due)"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustType('payable')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      newCustType === 'payable'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>{isBn ? 'আমি দেবো (অগ্রিম)' : "You'll Give (Adv)"}</span>
                  </button>
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'কাস্টমারের নাম *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder={isBn ? 'উদাঃ রহিম আহমেদ' : 'e.g. Rahul Sharma'}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'মোবাইল নম্বর (হোয়াটসঅ্যাপ তাগাদার জন্য)' : 'Mobile Phone (for WhatsApp Reminders)'}
                </label>
                <input
                  type="tel"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="01XXXXXXXXX / 98XXXXXXXX"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Due / Advance Amount */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {newCustType === 'receivable'
                    ? isBn
                      ? 'বকেয়া বাকির পরিমাণ *'
                      : 'Due Amount *'
                    : isBn
                    ? 'অগ্রিম জমা পরিমাণ *'
                    : 'Advance Credit Amount *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-stone-400 text-sm">
                    {sym}
                  </span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    value={newCustAmount}
                    onChange={(e) => setNewCustAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'নোট বা পণ্যের বিবরণ (ঐচ্ছিক)' : 'Note / Description (Optional)'}
                </label>
                <input
                  type="text"
                  value={newCustNote}
                  onChange={(e) => setNewCustNote(e.target.value)}
                  placeholder={isBn ? 'উদাঃ জামদানি শাড়ি বাকি' : 'e.g. 2 Sarees credit'}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isBn ? 'খাতায় যোগ করুন' : 'Save Customer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: QUICK PAYMENT / DUE TRANSACTION MODAL */}
      {activeTxModal && (
        <div
          id="tx-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            id="tx-modal-card"
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  {activeTxModal.action === 'pay'
                    ? isBn
                      ? 'টাকা জমা নিন / নিষ্পত্তি'
                      : 'Record Payment (Got ₹)'
                    : isBn
                    ? 'অতিরিক্ত বাকি যোগ করুন'
                    : 'Add Due (Gave ₹)'}
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  {activeTxModal.customer.name} • {sym}
                  {activeTxModal.customer.dueAmount.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTxModal(null)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTxSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'টাকার পরিমাণ *' : 'Amount *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-stone-400 text-sm">
                    {sym}
                  </span>
                  <input
                    type="number"
                    autoFocus
                    required
                    min="0.01"
                    step="any"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-base font-mono font-black focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'বিবরণ বা নোট (ঐচ্ছিক)' : 'Note / Reason (Optional)'}
                </label>
                <input
                  type="text"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder={isBn ? 'উদাঃ নগদ পরিশোধ / কিস্তি' : 'e.g. Cash settled'}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTxModal(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer ${
                    activeTxModal.action === 'pay'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isBn ? 'সংরক্ষণ করুন' : 'Confirm Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: VIEW FULL CUSTOMER TRANSACTION TIMELINE */}
      {selectedCustomer && (
        <div
          id="customer-timeline-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            id="customer-timeline-card"
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
          >
            <div className="p-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl border flex items-center justify-center font-bold text-sm ${getAvatarBg(
                    selectedCustomer.name
                  )}`}
                >
                  {getInitials(selectedCustomer.name)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">{selectedCustomer.name}</h3>
                  <p className="text-xs text-stone-500 font-mono">
                    {selectedCustomer.phone || (isBn ? 'মোবাইল যুক্ত নেই' : 'No Phone')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Current Balance Card */}
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">
                  {isBn ? 'বর্তমান ব্যালেন্স' : 'Current Balance'}
                </span>
                <div
                  className={`text-2xl font-black font-mono ${
                    selectedCustomer.type === 'payable' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {sym}{selectedCustomer.dueAmount.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintSlip(selectedCustomer)}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isBn ? 'রশিদ' : 'Slip'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleWhatsAppReminder(selectedCustomer)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{isBn ? 'তাগাদা' : 'Remind'}</span>
                </button>
              </div>
            </div>

            {/* Transactions List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
              <span className="text-xs font-bold text-stone-600 flex items-center gap-1 mb-2">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>{isBn ? 'লেনদেন ইতিহাস (Timeline)' : 'Transaction History'}</span>
              </span>

              {selectedCustomer.transactions && selectedCustomer.transactions.length > 0 ? (
                selectedCustomer.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tx.type === 'payment'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tx.type === 'payment'
                            ? isBn
                              ? 'পরিশোধ / জমা'
                              : 'Payment'
                            : isBn
                            ? 'বাকি যোগ'
                            : 'Due Added'}
                        </span>
                        <span className="text-[11px] text-stone-500">{tx.dateFormatted}</span>
                      </div>
                      {tx.note && <p className="text-xs text-stone-700 mt-1 font-medium">{tx.note}</p>}
                    </div>
                    <div
                      className={`text-sm font-black font-mono ${
                        tx.type === 'payment' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {tx.type === 'payment' ? '-' : '+'}
                      {sym}{tx.amount.toFixed(2)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-stone-400">
                  {isBn ? 'কোনো পূর্ববর্তী লেনদেন এন্ট্রি নেই' : 'No transaction logs yet'}
                </div>
              )}
            </div>

            {/* Khatabook Action Buttons: YOU GAVE ₹ (Red) and YOU GOT ₹ (Green) */}
            <div className="p-3 bg-white border-t border-stone-200 grid grid-cols-2 gap-2.5">
              {/* YOU GAVE ₹ (Red Button) */}
              <button
                type="button"
                onClick={() => {
                  setKhatabookModal({
                    isOpen: true,
                    type: 'you_gave',
                    customer: selectedCustomer,
                  });
                }}
                className="py-3 px-2 rounded-2xl bg-[#a5001e] hover:bg-[#8b0019] active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                <span>{isBn ? 'আমি দিয়েছি (Gave ₹)' : 'YOU GAVE ₹'}</span>
              </button>

              {/* YOU GOT ₹ (Green Button) */}
              <button
                type="button"
                onClick={() => {
                  setKhatabookModal({
                    isOpen: true,
                    type: 'you_got',
                    customer: selectedCustomer,
                  });
                }}
                className="py-3 px-2 rounded-2xl bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
                <span>{isBn ? 'আমি পেয়েছি (Got ₹)' : 'YOU GOT ₹'}</span>
              </button>
            </div>

            {/* Modal Bottom: Delete Customer */}
            <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      isBn
                        ? `আপনি কি নিশ্চিতভাবে ${selectedCustomer.name}-এর খাতা মুছে ফেলতে চান?`
                        : `Are you sure you want to delete ${selectedCustomer.name}'s khata?`
                    )
                  ) {
                    onDeleteDue(selectedCustomer.id);
                    setSelectedCustomer(null);
                  }
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer px-2 py-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'খাতা মুছে ফেলুন' : 'Delete Customer'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. REPORT MODAL / PRINT VIEW */}
      {isReportModalOpen && (
        <div
          id="report-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            id="report-modal-card"
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
          >
            <div className="p-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-stone-900">
                  {isBn ? 'বাকি খাতা সারাংশ রিপোর্ট (PDF & Print)' : 'Customer Dues Report'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="text-center pb-3 border-b border-stone-200">
                <h4 className="text-base font-black text-stone-900">{settings.storeName}</h4>
                <p className="text-stone-500 font-medium">{settings.storeAddress}</p>
                <p className="text-stone-400 font-mono text-[11px] mt-0.5">
                  {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl">
                  <span className="text-stone-600 font-medium block">
                    {isBn ? 'মোট বকেয়া বাকি (পাবেন)' : 'Total Receivable'}
                  </span>
                  <span className="text-lg font-black text-rose-600 font-mono">
                    {sym}{totalReceivable.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-stone-400 block">
                    {countReceivable} {isBn ? 'জন কাস্টমার' : 'customers'}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <span className="text-stone-600 font-medium block">
                    {isBn ? 'মোট কাস্টমার পাওনা (দেবেন)' : 'Total Payable'}
                  </span>
                  <span className="text-lg font-black text-emerald-600 font-mono">
                    {sym}{totalPayable.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-stone-400 block">
                    {countPayable} {isBn ? 'জন গ্রাহক' : 'customers'}
                  </span>
                </div>
              </div>

              {/* Customer List table */}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 text-[11px]">
                    <th className="py-2">{isBn ? 'গ্রাহক' : 'Customer'}</th>
                    <th className="py-2">{isBn ? 'মোবাইল' : 'Phone'}</th>
                    <th className="py-2">{isBn ? 'ধরন' : 'Type'}</th>
                    <th className="py-2 text-right">{isBn ? 'ব্যালেন্স' : 'Balance'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {dues.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 font-sans font-bold text-stone-800">{c.name}</td>
                      <td className="py-2 text-stone-500 text-[11px]">{c.phone || '-'}</td>
                      <td className="py-2 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-sans font-bold ${
                            c.type === 'payable'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {c.type === 'payable' ? 'Give' : 'Get'}
                        </span>
                      </td>
                      <td
                        className={`py-2 text-right font-black ${
                          c.type === 'payable' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {sym}{c.dueAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>{isBn ? 'প্রিন্ট / PDF সংরক্ষণ' : 'Print / Save PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. KHATABOOK CALCULATOR ENTRY MODAL */}
      {khatabookModal && khatabookModal.isOpen && (
        <KhatabookEntryModal
          isOpen={khatabookModal.isOpen}
          onClose={() => setKhatabookModal(null)}
          onSave={handleKhatabookSave}
          entryType={khatabookModal.type}
          partyName={khatabookModal.customer?.name}
          partyPhone={khatabookModal.customer?.phone}
          currentDue={khatabookModal.customer?.dueAmount}
          settings={settings}
          language={language}
          showPartyInput={khatabookModal.isNewCustomer}
          partyInputLabel={isBn ? 'কাস্টমারের নাম *' : 'Customer Name *'}
        />
      )}
    </div>
  );
};
