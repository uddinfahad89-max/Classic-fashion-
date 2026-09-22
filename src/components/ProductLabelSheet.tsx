import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { BillInvoice, ThermalPrinterSettings, Language, BillItem } from '../types';
import { Tag, Scissors } from 'lucide-react';

interface ProductLabelSheetProps {
  bill: BillInvoice;
  settings: ThermalPrinterSettings;
  language?: Language;
}

interface SingleLabelItemProps {
  item: BillItem;
  index: number;
  invoiceNo: string;
  currencySymbol: string;
  paperWidth: '58mm' | '80mm';
}

const SingleLabelItem: React.FC<SingleLabelItemProps> = ({
  item,
  index,
  invoiceNo,
  currencySymbol,
  paperWidth,
}) => {
  const barcodeSvgRef = useRef<SVGSVGElement>(null);
  const barcodeValue = (
    item.barcode ||
    `${invoiceNo.replace(/[^A-Za-z0-9]/g, '') || '1'}-${index + 1}`
  ).toUpperCase();

  useEffect(() => {
    if (barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, barcodeValue, {
          format: 'CODE128',
          width: paperWidth === '80mm' ? 2 : 1.8,
          height: paperWidth === '80mm' ? 44 : 36,
          displayValue: true,
          font: 'monospace',
          fontSize: 12,
          textMargin: 3,
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (e) {
        console.error('Barcode rendering error:', e);
      }
    }
  }, [barcodeValue, paperWidth]);

  const is80mm = paperWidth === '80mm';

  return (
    <div
      className={`bg-white border-2 border-stone-900 rounded-xl p-3.5 sm:p-4 text-center mx-auto shadow-sm transition-all flex flex-col items-center justify-between ${
        is80mm ? 'w-full max-w-[360px]' : 'w-full max-w-[270px]'
      }`}
      style={{ minHeight: is80mm ? '190px' : '170px' }}
    >
      {/* 1. PRODUCT NAME */}
      <div className="w-full text-center mb-1">
        <h3
          className={`font-black text-stone-950 uppercase tracking-tight leading-tight line-clamp-2 ${
            is80mm ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
          }`}
        >
          {item.name}
        </h3>
      </div>

      {/* 2. BARCODE (Clean SVG 1D Barcode with numeric code) */}
      <div className="w-full flex items-center justify-center my-1 overflow-hidden">
        <svg ref={barcodeSvgRef} className="max-w-full h-auto" />
      </div>

      {/* 3. PRICE (Clean, bold, prominent) */}
      <div className="w-full pt-1.5 border-t border-dashed border-stone-400 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest leading-none mb-0.5">
          PRICE / MRP
        </span>
        <div
          className={`font-black text-stone-950 font-mono tracking-tight ${
            is80mm ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
          }`}
        >
          {currencySymbol ? `${currencySymbol} ` : ''}
          {item.price.toFixed(2)}
        </div>
      </div>
    </div>
  );
};

export const ProductLabelSheet: React.FC<ProductLabelSheetProps> = ({
  bill,
  settings,
  language = 'bn',
}) => {
  const isBn = language === 'bn';

  // Currency symbol resolution
  let sym = '';
  if (!settings.hideCurrencySymbol) {
    const rawSym = (settings.currencySymbol || '').trim();
    if (rawSym.toLowerCase().includes('rs')) {
      sym = 'Rs.';
    } else if (rawSym.toLowerCase().includes('tk') || rawSym === '৳') {
      sym = 'Tk.';
    } else if (rawSym === '₹' || rawSym === '?' || !rawSym) {
      sym = '₹';
    } else {
      sym = rawSym.replace(/[^\x20-\x7E]/g, '').replace(/\?/g, '').trim() || '₹';
    }
  }

  const paperWidth = settings.paperWidth || '58mm';
  const is80mm = paperWidth === '80mm';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Label Mode Status Bar Header */}
      <div className="w-full max-w-md mb-3 flex items-center justify-between text-xs text-amber-900 bg-amber-50/90 border border-amber-200/80 px-3.5 py-2 rounded-xl">
        <div className="flex items-center gap-1.5 font-bold">
          <Tag className="w-3.5 h-3.5 text-amber-600" />
          <span>
            {isBn
              ? `লেবেল মোড (${bill.items.length} টি পণ্যের ট্যাগ)`
              : `Label Mode (${bill.items.length} Product Tag${bill.items.length > 1 ? 's' : ''})`}
          </span>
        </div>
        <span className="text-[11px] font-mono font-semibold bg-white/80 px-2 py-0.5 rounded-md border border-amber-200">
          {paperWidth} Roll
        </span>
      </div>

      {/* Product Sticker Tags List */}
      <div
        className={`space-y-4 w-full flex flex-col items-center print:space-y-3 ${
          is80mm ? 'max-w-md' : 'max-w-xs'
        }`}
      >
        {bill.items.map((item, idx) => (
          <React.Fragment key={item.id || idx}>
            <SingleLabelItem
              item={item}
              index={idx}
              invoiceNo={bill.invoiceNo || 'INV'}
              currencySymbol={sym}
              paperWidth={paperWidth}
            />

            {/* Perforation guide line between labels (if multiple items) */}
            {idx < bill.items.length - 1 && (
              <div className="w-full flex items-center justify-center gap-2 text-stone-400 text-[10px] select-none py-1">
                <Scissors className="w-3.5 h-3.5 text-stone-400 -rotate-90" />
                <span className="border-b border-dashed border-stone-300 flex-1"></span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-stone-400">
                  {isBn ? 'কাটার দাগ (Cut Line)' : 'Tear / Cut Here'}
                </span>
                <span className="border-b border-dashed border-stone-300 flex-1"></span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
