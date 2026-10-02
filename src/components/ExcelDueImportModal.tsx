import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Download,
  Users,
  Check,
} from 'lucide-react';
import { DueType, Language } from '../types';
import { useBackHandler } from '../utils/useBackHandler';
import { KHATABOOK_CUSTOMERS } from '../data/khatabookSeedData';

export interface ParsedDueRow {
  name: string;
  phone: string;
  amount: number;
  note?: string;
  type: DueType;
}

interface ExcelDueImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (rows: ParsedDueRow[]) => void;
  language?: Language;
}

export const ExcelDueImportModal: React.FC<ExcelDueImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  language = 'bn',
}) => {
  const isBn = language === 'bn';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [defaultType, setDefaultType] = useState<DueType>('receivable');
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedDueRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useBackHandler('excelDueImportModal', isOpen, () => {
    onClose();
    return true;
  }, 45);

  if (!isOpen) return null;

  // Helper to parse any 2D table array into ParsedDueRow items
  const processRawGrid = (grid: any[][]) => {
    if (!grid || grid.length === 0) {
      setErrorMsg(isBn ? 'এক্সেল ফাইলে কোনো তথ্য পাওয়া যায়নি।' : 'No data found in the file.');
      return;
    }

    const rows: ParsedDueRow[] = [];
    let startIdx = 0;

    // Check if the first row is a header row
    const firstRowStr = grid[0].map((c) => String(c || '').toLowerCase()).join(' ');
    const hasHeader =
      /name|customer|নাম|party|phone|mobile|ফোন|মোবাইল|due|balance|টাকা|বকেয়া|বকেয়া|amount/i.test(
        firstRowStr
      );

    if (hasHeader) {
      startIdx = 1;
    }

    for (let i = startIdx; i < grid.length; i++) {
      const row = grid[i];
      if (!row || row.length === 0) continue;

      let name = '';
      let phone = '';
      let amount = 0;
      let note = '';

      // Analyze cells in row
      for (let j = 0; j < row.length; j++) {
        const val = row[j];
        if (val === null || val === undefined || val === '') continue;
        const strVal = String(val).trim();

        // Phone number check (Indian numbers: 10 digits without code, 11 with leading 0, 12 with 91, or 13 with +91/091)
        const digits = strVal.replace(/[^0-9]/g, '');
        if (!phone && digits.length >= 10 && digits.length <= 13) {
          phone = digits;
          continue;
        }

        // Amount check (pure numeric or currency string)
        const parsedNum = parseFloat(strVal.replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsedNum) && parsedNum > 0 && amount === 0 && !/^0[1-9]/.test(strVal)) {
          amount = parsedNum;
          continue;
        }

        // Name
        if (!name && strVal.length >= 2 && !/^[0-9+]+$/.test(strVal)) {
          name = strVal;
          continue;
        }

        // Note
        if (name && !note && strVal.length > 0) {
          note = strVal;
        }
      }

      // Fallback if positional
      if (!name && row[0]) name = String(row[0]).trim();
      if (amount <= 0 && row[1]) {
        const altNum = parseFloat(String(row[1]).replace(/[^0-9.-]/g, ''));
        if (!isNaN(altNum) && altNum > 0) amount = altNum;
      }
      if (amount <= 0 && row[2]) {
        const altNum = parseFloat(String(row[2]).replace(/[^0-9.-]/g, ''));
        if (!isNaN(altNum) && altNum > 0) amount = altNum;
      }

      if (name && amount > 0) {
        rows.push({
          name,
          phone,
          amount,
          note,
          type: defaultType,
        });
      }
    }

    if (rows.length === 0) {
      setErrorMsg(
        isBn
          ? 'সঠিক কাস্টমার নাম ও বকেয়া টাকার তথ্য পাওয়া যায়নি। কলামগুলো পরীক্ষা করুন।'
          : 'Could not find valid Customer Name and Due Amount.'
      );
    } else {
      setErrorMsg(null);
      setParsedRows(rows);
    }
  };

  // Handle Excel (.xlsx, .xls, .csv) File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const grid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        processRawGrid(grid);
      } catch (err: any) {
        console.error('Excel parse error:', err);
        setErrorMsg(isBn ? 'ফাইলটি পড়তে সমস্যা হয়েছে। অন্য ফাইল চেষ্টা করুন।' : 'Failed to parse Excel file.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg(isBn ? 'ফাইল পড়তে ব্যর্থ হয়েছে।' : 'Error reading file.');
      setIsProcessing(false);
    };
    reader.readAsBinaryString(file);
  };

  // Handle Pasted Text from Excel / Google Sheets
  const handleParsePastedText = () => {
    if (!pasteText.trim()) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const lines = pasteText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const grid = lines.map((line) => {
        // Tab-separated (Excel copy) or Comma-separated (CSV)
        if (line.includes('\t')) return line.split('\t');
        if (line.includes(',')) return line.split(',');
        return line.trim().split(/\s{2,}/);
      });
      processRawGrid(grid);
    } catch {
      setErrorMsg(isBn ? 'পেস্ট করা তথ্য প্রসেস করা যায়নি।' : 'Failed to process pasted text.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Sample Excel Template
  const handleDownloadSample = () => {
    const sampleData = [
      ['Customer Name', 'Phone', 'Due Amount', 'Notes'],
      ['Rahim Ahmed', '01712345678', 1250, 'Cloth purchase'],
      ['Karim Mia', '01898765432', 800, 'Pending bill'],
      ['Suman Paul', '01911223344', 3500, 'Eid advance'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SampleDues');
    XLSX.writeFile(wb, 'Customer_Dues_Sample.xlsx');
  };

  // Confirm Import
  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    onImportSuccess(parsedRows);
    onClose();
  };

  const totalImportAmount = parsedRows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>{isBn ? '📊 এক্সেল / CSV থেকে বকেয়া ইমপোর্ট' : 'Import Dues from Excel / CSV'}</span>
              </h3>
              <p className="text-[11px] text-stone-400">
                {isBn
                  ? 'এক্সেল শীট আপলোড করুন অথবা কপি-পেস্ট করে এক ক্লিকে সব কাস্টমার যুক্ত করুন'
                  : 'Upload .xlsx/.csv or copy-paste rows from Excel into ledger'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Khatabook Preset Bar */}
        <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
              <span>⚡</span>
              <span>
                {isBn
                  ? 'Classic Fashion-এর Khatabook রিপোর্ট (১১১ জন • ₹১,৭৬,৪৬০)'
                  : 'Classic Fashion Khatabook Report (111 Customers • ₹1,76,460)'}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const rows: ParsedDueRow[] = KHATABOOK_CUSTOMERS.filter(
                (c) => c.amount > 0
              ).map((c) => ({
                name: c.name,
                phone: c.phone,
                amount: c.amount,
                note: isBn
                  ? 'Classic Fashion Khatabook রিপোর্ট'
                  : 'Classic Fashion Khatabook',
                type: c.type,
              }));
              setParsedRows(rows);
              setFileName('Classic_Fashion_Khatabook_111_Customers.pdf');
              setErrorMsg(null);
            }}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer shadow-xs transition-all active:scale-95"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isBn ? '১-ক্লিকে রিপোর্ট লোড করুন' : 'Load Khatabook Data'}</span>
          </button>
        </div>

        {/* Tab Switcher & Sample Button */}
        <div className="px-5 pt-3 pb-2 bg-stone-50 border-b border-stone-200 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-stone-200/80 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'file'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isBn ? '📁 ফাইল আপলোড (.xlsx / .csv)' : 'File Upload'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-blue-600" />
              <span>{isBn ? '📋 কপি-পেস্ট করুন' : 'Paste from Excel'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadSample}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
            title={isBn ? 'নমুনা এক্সেল ফাইল ডাউনলোড' : 'Download sample template'}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isBn ? 'নমুনা এক্সেল ফরম্যাট' : 'Sample Format'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* File Upload Tab */}
          {activeTab === 'file' && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 p-6 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-2xs border border-emerald-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="font-extrabold text-sm text-stone-800">
                  {fileName ? (
                    <span className="text-emerald-700">{fileName}</span>
                  ) : isBn ? (
                    'এক্সেল বা CSV ফাইল এখানে নির্বাচন করুন'
                  ) : (
                    'Click to select Excel / CSV file'
                  )}
                </div>
                <p className="text-xs text-stone-500">
                  {isBn
                    ? 'সমর্থিত ফরম্যাট: .xlsx, .xls, .csv'
                    : 'Supported: Microsoft Excel (.xlsx, .xls) or .csv'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Copy-Paste Tab */}
          {activeTab === 'paste' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                {isBn
                  ? 'এক্সেল শীট থেকে কলামগুলো কপি করে নিচে পেস্ট (Ctrl+V) করুন:'
                  : 'Copy rows from Excel and paste here:'}
              </label>
              <textarea
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={
                  isBn
                    ? 'উদাঃ\nRahim Ahmed\t01712345678\t1500\nKarim Mia\t01898765432\t800'
                    : 'e.g.\nRahim Ahmed\t01712345678\t1500\nKarim Mia\t01898765432\t800'
                }
                className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-3 text-xs font-mono font-medium focus:bg-white focus:outline-none focus:border-blue-500 leading-relaxed"
              />
              <button
                type="button"
                onClick={handleParsePastedText}
                disabled={!pasteText.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                <Check className="w-4 h-4" />
                <span>{isBn ? 'পেস্ট করা তথ্য প্রিভিউ দেখুন' : 'Parse Pasted Rows'}</span>
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-100">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Table if rows parsed */}
          {parsedRows.length > 0 && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-stone-900 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{isBn ? 'ইমপোর্টের জন্য প্রস্তুত:' : 'Ready to Import:'}</span>
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-mono font-black px-2 py-0.5 rounded-full">
                    {parsedRows.length} {isBn ? 'জন' : 'Customers'}
                  </span>
                </div>

                <div className="text-xs font-mono font-black text-rose-600">
                  {isBn ? 'মোট বকেয়া: ' : 'Total: '}₹{totalImportAmount.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Scrollable Preview Table */}
              <div className="border border-stone-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-100 text-stone-600 font-extrabold sticky top-0 border-b border-stone-200">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">{isBn ? 'কাস্টমার নাম' : 'Customer'}</th>
                      <th className="p-2.5">{isBn ? 'মোবাইল' : 'Phone'}</th>
                      <th className="p-2.5 text-right">{isBn ? 'বকেয়া টাকা' : 'Due Amount'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    {parsedRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-stone-50">
                        <td className="p-2.5 font-mono text-stone-400 text-[11px]">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-stone-900">{r.name}</td>
                        <td className="p-2.5 font-mono text-stone-600 text-[11px]">
                          {r.phone || '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-rose-600">
                          ₹{r.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-100 cursor-pointer"
          >
            {isBn ? 'বাতিল' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={parsedRows.length === 0 || isProcessing}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isBn
                ? `সব বকেয়া ইমপোর্ট করুন (${parsedRows.length} জন)`
                : `Import All Dues (${parsedRows.length})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
