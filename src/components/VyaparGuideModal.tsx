import React from 'react';
import { X, CheckCircle2, Download, AlertCircle, ShoppingBag, ArrowRight, Smartphone, FileSpreadsheet } from 'lucide-react';
import { Language, ProductStockItem } from '../types';
import { exportProductsForVyaparExcel } from '../utils/barcodeUtils';

interface VyaparGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  products?: ProductStockItem[];
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const VyaparGuideModal: React.FC<VyaparGuideModalProps> = ({
  isOpen,
  onClose,
  language = 'bn',
  products = [],
  onShowToast,
}) => {
  if (!isOpen) return null;

  const isBn = language === 'bn';

  const handleExportExcel = () => {
    if (!products || products.length === 0) {
      if (onShowToast) {
        onShowToast(isBn ? 'কোনো প্রোডাক্ট তালিকা নেই' : 'No products found', 'error');
      }
      return;
    }
    exportProductsForVyaparExcel(products);
    if (onShowToast) {
      onShowToast(
        isBn
          ? '✅ "Vyapar_Items_Import.xlsx" ডাউনলোড হয়েছে! ব্যাপার অ্যাপে Import করুন।'
          : '✅ "Vyapar_Items_Import.xlsx" downloaded! Import into Vyapar.',
        'success'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black text-base shadow-inner">
              V
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                {isBn ? 'ব্যাপার (Vyapar) অ্যাপে স্ক্যান ও প্রোডাক্ট এড' : 'Vyapar App Barcode Scan Guide'}
              </h2>
              <p className="text-[11px] text-rose-100">
                {isBn
                  ? 'কেন "Item not identified" আসে এবং কীভাবে সমাধান করবেন'
                  : 'How to resolve "Item not identified" in Vyapar'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-stone-800 text-xs sm:text-sm">
          {/* 1. What "Item not identified" actually means */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0">
                !
              </span>
              <span>{isBn ? 'ব্যাপার অ্যাপের মেসেজের আসল অর্থ:' : 'What Vyapar Toast Means:'}</span>
            </div>
            <div className="bg-white/90 border border-amber-200/80 rounded-xl p-2.5 font-mono text-[11px] text-stone-800 flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-red-600 text-white flex items-center justify-center text-[8px] font-black">
                V
              </span>
              <span className="font-bold">Item not identified. Please add item.</span>
            </div>
            <p className="text-[11px] text-amber-950 leading-relaxed">
              {isBn ? (
                <>
                  <strong className="text-emerald-700 font-bold">✅ স্ক্যানার সফলভাবে বারকোডটি রিড করেছে!</strong>{' '}
                  ব্যাপার অ্যাপ যেকোনো বারকোড সরাসরি বিলে তখনই যোগ করতে পারে, যখন সেই বারকোডটি আগে থেকে ব্যাপার অ্যাপের আইটেম লিস্টে (Items) সেভ করা থাকে। যেহেতু প্রোডাক্টটি এখনও ব্যাপার অ্যাপে যুক্ত করা হয়নি, তাই এটি চেনার জন্য যুক্ত করতে বলছে।
                </>
              ) : (
                'The scanner successfully decoded your barcode! Vyapar shows this prompt only when the barcode has not yet been registered in Vyapar item inventory.'
              )}
            </p>
          </div>

          {/* 2. Three Simple Ways to Add Products */}
          <div className="space-y-3">
            <h3 className="font-black text-stone-900 text-xs sm:text-sm uppercase tracking-wide flex items-center gap-1.5">
              <span>{isBn ? '৩টি সহজ উপায়ে প্রোডাক্ট যোগ করুন:' : '3 Simple Ways to Add Products:'}</span>
            </h3>

            {/* Step 1: In-App 1-Time Add */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                  ১
                </span>
                <span>{isBn ? 'পদ্ধতি ১: স্ক্যান করার সাথে সাথে ১-বার সেভ (সবচেয়ে সহজ)' : 'Method 1: Quick 1-Tap Save'}</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed pl-7">
                {isBn
                  ? 'ব্যাপার অ্যাপে স্ক্যান করার পর যখন "Item not identified" লেখা আসে, তখন সেখানে ট্যাপ করুন। লক্ষ্য করবেন ব্যাপার অ্যাপে "Item Code" ঘরে বারকোডটি নিজে থেকেই বসে গেছে! শুধু পণ্যের নাম ও দাম লিখে Save দিন। এরপর থেকে প্রতিবার স্ক্যান করলেই প্রোডাক্টটি সরাসরি বিলে যুক্ত হয়ে যাবে।'
                  : 'Tap on the toast in Vyapar. The scanned barcode will be pre-filled in Item Code. Type name & price and Save. Future scans will auto-add the item instantly!'}
              </p>
            </div>

            {/* Step 2: Excel Export for Vyapar */}
            <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-blue-950 text-xs sm:text-sm">
                  <span className="w-5 h-5 rounded-full bg-blue-700 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    ২
                  </span>
                  <span>{isBn ? 'পদ্ধতি ২: সব প্রোডাক্ট একসাথে এক্সেল দিয়ে ইমপোর্ট' : 'Method 2: Batch Excel Import'}</span>
                </div>
              </div>
              <p className="text-[11px] text-blue-900 leading-relaxed pl-7">
                {isBn
                  ? 'আমাদের এই অ্যাপের সব প্রোডাক্ট ও বারকোড ১-ক্লিকে এক্সেল ফাইলে ডাউনলোড করে ব্যাপার অ্যাপে Import from Excel দিলেই সমস্ত বারকোড ব্যাপার অ্যাপে চলে যাবে।'
                  : 'Export all products with barcodes in Vyapar Excel format and import directly in Vyapar.'}
              </p>
              <div className="pl-7 pt-1">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full sm:w-auto py-2 px-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                  <span>{isBn ? '📥 ব্যাপার এক্সেল ফাইল ডাউনলোড করুন' : 'Download Vyapar Excel File'}</span>
                </button>
              </div>
            </div>

            {/* Step 3: Use Our Own Built-in Billing Tab */}
            <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                  ৩
                </span>
                <span>{isBn ? 'পদ্ধতি ৩: আমাদের নিজস্ব বিলিং ট্যাব ব্যবহার করুন' : 'Method 3: Built-in POS Billing'}</span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-relaxed pl-7">
                {isBn
                  ? 'আমাদের এই অ্যাপের নিচের "বিলিং (Billing)" ট্যাবে গিয়ে ক্যামেরা অন করে স্ক্যান করলেই প্রোডাক্টটি সরাসরি ক্যাশ মেমোতে যুক্ত হয়ে যায় এবং ব্লুটুথ থার্মাল প্রিন্টারে প্রিন্ট হয়ে যায়—কোনো এক্সট্রা অ্যাপের দরকার হয় না।'
                  : 'Our app includes full POS billing. Switch to the Billing tab and scan with the camera to instantly add products to invoice and print receipts.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-5 bg-stone-900 hover:bg-stone-950 text-white rounded-xl font-bold text-xs cursor-pointer transition-all"
          >
            {isBn ? 'বুঝেছি / ঠিক আছে' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
