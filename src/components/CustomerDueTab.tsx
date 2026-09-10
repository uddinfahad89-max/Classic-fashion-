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
} from 'lucide-react';
import { CustomerDue, ThermalPrinterSettings, BillInvoice } from '../types';

interface CustomerDueTabProps {
  dues: CustomerDue[];
  settings: ThermalPrinterSettings;
  onAddOrUpdateDue: (name: string, amount: number, phone?: string, note?: string) => void;
  onRecordPayment: (id: string, amount: number, note?: string) => void;
  onDeleteDue: (id: string) => void;
  onPrintDueSlip: (bill: BillInvoice) => void;
}

export const CustomerDueTab: React.FC<CustomerDueTabProps> = ({
  dues,
  settings,
  onAddOrUpdateDue,
  onRecordPayment,
  onDeleteDue,
  onPrintDueSlip,
}) => {
  // New Due Form
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custDue, setCustDue] = useState('');
  const [custNote, setCustNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Quick Action Modal/Sheet for Add Due or Receive Payment
  const [activeModal, setActiveModal] = useState<{
    customer: CustomerDue;
    type: 'add' | 'pay';
  } | null>(null);
  const [modalAmount, setModalAmount] = useState('');
  const [modalNote, setModalNote] = useState('');

  const totalOutstanding = dues.reduce((sum, d) => sum + d.dueAmount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(custDue);
    if (!custName.trim() || isNaN(amount) || amount <= 0) {
      alert('Please enter a Customer Name and valid Due Amount');
      return;
    }

    onAddOrUpdateDue(custName.trim(), amount, custPhone.trim(), custNote.trim());

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

    if (activeModal.type === 'add') {
      onAddOrUpdateDue(
        activeModal.customer.name,
        amount,
        activeModal.customer.phone,
        modalNote || 'Additional due'
      );
    } else {
      onRecordPayment(activeModal.customer.id, amount, modalNote || 'Payment collected');
    }

    setActiveModal(null);
    setModalAmount('');
    setModalNote('');
  };

  // Generate a quick thermal print due slip
  const handlePrintSlip = (customer: CustomerDue) => {
    const sym = settings.currencySymbol || '₹';
    const invoiceNo = 'DUE-' + String(Date.now()).slice(-5);
    const now = new Date();
    const dateFormatted = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const bill: BillInvoice = {
      id: 'due-slip-' + customer.id,
      invoiceNo,
      date: dateFormatted,
      timestamp: Date.now(),
      customerName: customer.name,
      customerPhone: customer.phone,
      items: [
        {
          id: 'item-due',
          name: 'Outstanding Balance (Due)',
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

  const sym = settings.currencySymbol || '₹';

  const filteredDues = dues.filter((d) => {
    const term = searchTerm.toLowerCase();
    return (
      d.name.toLowerCase().includes(term) ||
      (d.phone && d.phone.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      {/* Total Due Banner */}
      <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider block">
            Total Outstanding Customer Due
          </span>
          <span className="text-2xl sm:text-3xl font-black text-red-600 font-mono">
            {sym}
            {totalOutstanding.toFixed(2)}
          </span>
          <p className="text-[11px] text-red-500 mt-0.5">
            {dues.length} registered customers with credit
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
          <Users className="w-6 h-6" />
        </div>
      </div>

      {/* 1. ADD CUSTOMER DUE FORM */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-red-600" />
            <span>Add Customer Due</span>
          </h2>
          <span className="text-[11px] text-stone-400 font-medium">Customer Khata</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              id="custName"
              required
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder="Customer Name *"
              className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-red-500"
            />
            <input
              type="text"
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value)}
              placeholder="Phone (e.g. 98XXXXXXXX)"
              className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
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
              placeholder={`Due Amount (${sym}) *`}
              className="w-full border border-stone-200 bg-stone-50/80 pl-7 pr-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-red-500"
            />
          </div>

          <input
            type="text"
            value={custNote}
            onChange={(e) => setCustNote(e.target.value)}
            placeholder="Note / Reason (e.g. Cotton Saree, Kurti & Leggings credit)"
            className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-red-500"
          />

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Save Customer Due</span>
          </button>
        </form>
      </div>

      {/* 2. SEARCH & CUSTOMER DUE LIST */}
      <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <span className="text-xs font-bold text-stone-800">
            Customer Due List ({filteredDues.length})
          </span>

          <div className="relative w-full sm:w-52">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-red-500"
            />
          </div>
        </div>

        {filteredDues.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            No customer dues recorded. Add a customer due record above.
          </div>
        ) : (
          <ul id="dueList" className="divide-y divide-stone-100">
            {filteredDues.map((customer) => {
              const isExpanded = expandedId === customer.id;
              return (
                <li key={customer.id} className="p-3.5 sm:p-4 hover:bg-stone-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-900">{customer.name}</span>
                        {customer.phone && (
                          <span className="text-[11px] text-stone-500 font-mono flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400">
                        Last updated: {new Date(customer.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5">
                      <span className="text-base font-black text-red-600 font-mono">
                        {sym}
                        {customer.dueAmount.toFixed(2)}
                      </span>

                      <div className="flex items-center gap-1">
                        {/* + Add Due */}
                        <button
                          onClick={() => {
                            setActiveModal({ customer, type: 'add' });
                            setModalAmount('');
                            setModalNote('');
                          }}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-xs border border-red-200 transition-colors cursor-pointer"
                          title="Add Due"
                        >
                          + Due
                        </button>

                        {/* - Pay Due */}
                        <button
                          onClick={() => {
                            setActiveModal({ customer, type: 'pay' });
                            setModalAmount(customer.dueAmount.toString());
                            setModalNote('');
                          }}
                          className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 font-bold rounded-lg text-xs border border-green-200 transition-colors cursor-pointer"
                          title="Receive Payment"
                        >
                          - Pay
                        </button>

                        {/* Print Receipt Slip */}
                        <button
                          onClick={() => handlePrintSlip(customer)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="Print Thermal Slip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* History toggle */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : customer.id)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="View Transaction History"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete record */}
                        <button
                          onClick={() => {
                            if (confirm(`Remove ledger for ${customer.name}?`)) {
                              onDeleteDue(customer.id);
                            }
                          }}
                          className="p-1.5 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. TRANSACTION HISTORY (EXPANDABLE) */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2 bg-stone-50/80 p-3 rounded-xl">
                      <div className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-stone-500" />
                        <span>Transaction History for {customer.name}:</span>
                      </div>

                      {customer.transactions?.length === 0 ? (
                        <p className="text-[11px] text-stone-400">No transaction logs recorded.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {customer.transactions.map((tx) => (
                            <div
                              key={tx.id}
                              className="text-xs flex items-center justify-between p-1.5 rounded bg-white border border-stone-200/70"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                    tx.type === 'added'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {tx.type === 'added' ? '+ Added' : '- Paid'}
                                </span>
                                <span className="text-stone-700">{tx.note}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold">
                                  {sym}
                                  {tx.amount.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-stone-400 font-mono">
                                  {tx.dateFormatted}
                                </span>
                              </div>
                            </div>
                          ))}
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
                {activeModal.type === 'add' ? '+ Add Due Amount' : '- Receive Payment'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-stone-400 hover:text-stone-700 text-base leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-4 space-y-3">
              <div>
                <span className="text-xs text-stone-500">Customer:</span>
                <div className="font-bold text-sm text-stone-900">{activeModal.customer.name}</div>
                <div className="text-xs font-mono text-red-600 font-semibold mt-0.5">
                  Current Due: {sym}
                  {activeModal.customer.dueAmount.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Amount ({sym}) *
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
                  Note / Reason
                </label>
                <input
                  type="text"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder={
                    activeModal.type === 'add' ? "e.g. Men's shirt & jeans on credit" : 'e.g. Cash / UPI payment received'
                  }
                  className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs focus:outline-none focus:border-stone-900"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-xl text-xs text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer ${
                    activeModal.type === 'add'
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-green-600 hover:bg-green-500'
                  }`}
                >
                  {activeModal.type === 'add' ? 'Add Due' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
