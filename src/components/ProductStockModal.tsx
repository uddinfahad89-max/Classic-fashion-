import React, { useState, useMemo } from 'react';
import {
  X,
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  ShoppingCart,
  Boxes,
  TrendingUp,
  AlertTriangle,
  ArrowUpCircle,
} from 'lucide-react';
import { ProductStockItem, ThermalPrinterSettings, Language } from '../types';
import { useBackHandler } from '../utils/useBackHandler';

interface ProductStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductStockItem[];
  onSaveProduct: (data: {
    id?: string;
    name: string;
    price: number;
    purchasePrice?: number;
    stock?: number;
    addStockDelta?: number;
    unit?: string;
    category?: string;
  }) => void;
  onAdjustStock: (productId: string, delta: number) => void;
  onDeleteProduct: (productId: string) => void;
  onSelectForBill?: (product: ProductStockItem, qty?: number) => void;
  settings: ThermalPrinterSettings;
  language?: Language;
}

export const ProductStockModal: React.FC<ProductStockModalProps> = ({
  isOpen,
  onClose,
  products,
  onSaveProduct,
  onAdjustStock,
  onDeleteProduct,
  onSelectForBill,
  settings,
  language = 'bn',
}) => {
  const isBn = language === 'bn';

  useBackHandler(
    'productStockModal',
    isOpen,
    () => {
      onClose();
      return true;
    },
    45
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickAddStockId, setQuickAddStockId] = useState<string | null>(null);
  const [quickAddStockQty, setQuickAddStockQty] = useState('');

  const hideCurrency =
    settings.hideCurrencySymbol ||
    settings.currencySymbol === '₹' ||
    !settings.currencySymbol;
  const sym = hideCurrency ? 'Rs ' : `${settings.currencySymbol} `;

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;

    // Sort: products starting with the query come first, then partial matches
    const startsWith: ProductStockItem[] = [];
    const contains: ProductStockItem[] = [];

    for (const p of products) {
      const pName = p.name.toLowerCase();
      if (pName.startsWith(q)) {
        startsWith.push(p);
      } else if (pName.includes(q) || (p.category && p.category.toLowerCase().includes(q))) {
        contains.push(p);
      }
    }
    return [...startsWith, ...contains];
  }, [products, searchQuery]);

  const totalProducts = products.length;
  const totalStockUnits = useMemo(
    () => products.reduce((sum, p) => sum + Math.max(0, p.stock || 0), 0),
    [products]
  );
  const totalStockValue = useMemo(
    () => products.reduce((sum, p) => sum + Math.max(0, p.stock || 0) * (p.price || 0), 0),
    [products]
  );

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setPurchasePrice('');
    setStock('');
    setUnit('Pcs');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const parsedPrice = parseFloat(price);
    const parsedCost = purchasePrice ? parseFloat(purchasePrice) : undefined;
    const parsedStock = stock !== '' ? parseInt(stock, 10) : 0;

    if (!cleanName || isNaN(parsedPrice) || parsedPrice < 0) {
      return;
    }

    onSaveProduct({
      id: editingId || undefined,
      name: cleanName,
      price: parsedPrice,
      purchasePrice: parsedCost && !isNaN(parsedCost) ? parsedCost : undefined,
      stock: isNaN(parsedStock) ? 0 : Math.max(0, parsedStock),
      unit: unit || 'Pcs',
    });

    resetForm();
  };

  const handleStartEdit = (prod: ProductStockItem) => {
    setEditingId(prod.id);
    setName(prod.name);
    setPrice(String(prod.price || 0));
    setPurchasePrice(prod.purchasePrice !== undefined ? String(prod.purchasePrice) : '');
    setStock(String(prod.stock || 0));
    setUnit(prod.unit || 'Pcs');
  };

  const handleConfirmQuickStock = (productId: string) => {
    const delta = parseInt(quickAddStockQty, 10);
    if (!isNaN(delta) && delta !== 0) {
      onAdjustStock(productId, delta);
    }
    setQuickAddStockId(null);
    setQuickAddStockQty('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                {isBn ? 'প্রোডাক্ট স্টক ও প্রাইস লিস্ট (Product Stock)' : 'Product Stock & Inventory'}
              </h2>
              <p className="text-[11px] text-blue-100">
                {isBn
                  ? 'প্রোডাক্ট সেভ রাখলে বিল করার সময় প্রথম অক্ষর লিখলেই নাম ও দাম চলে আসবে'
                  : 'Saved products auto-appear on first letter while billing'}
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

        {/* Summary Stats Bar */}
        <div className="grid grid-cols-3 gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200 shrink-0">
          <div className="bg-white px-3 py-2 rounded-xl border border-stone-200/80 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <div className="text-[10px] font-semibold text-stone-500">
                {isBn ? 'মোট প্রোডাক্ট' : 'Total Products'}
              </div>
              <div className="text-xs sm:text-sm font-black text-stone-900 font-mono">
                {totalProducts}
              </div>
            </div>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-stone-200/80 flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <div className="text-[10px] font-semibold text-stone-500">
                {isBn ? 'মোট স্টক (পিস)' : 'Total Stock Qty'}
              </div>
              <div className="text-xs sm:text-sm font-black text-emerald-700 font-mono">
                {totalStockUnits}
              </div>
            </div>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-stone-200/80 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <div className="text-[10px] font-semibold text-stone-500">
                {isBn ? 'স্টকের মোট মূল্য' : 'Stock Value'}
              </div>
              <div className="text-xs sm:text-sm font-black text-indigo-700 font-mono truncate">
                {sym}
                {totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Add / Edit Product Stock Form */}
          <form
            onSubmit={handleSubmit}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3 ${
              editingId
                ? 'bg-amber-50/70 border-amber-300'
                : 'bg-blue-50/40 border-blue-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                <span>
                  {editingId
                    ? isBn
                      ? 'প্রোডাক্ট ও স্টক সংশোধন করুন (Edit Product)'
                      : 'Edit Product & Stock'
                    : isBn
                    ? 'নতুন প্রোডাক্ট ও স্টক অ্যাড করুন (Add Product Stock)'
                    : 'Add New Product & Stock'}
                </span>
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] font-bold text-stone-500 hover:text-stone-800 underline cursor-pointer"
                >
                  {isBn ? 'বাতিল করুন' : 'Cancel Edit'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Product Name */}
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  {isBn ? 'প্রোডাক্টের নাম *' : 'Product Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isBn ? 'যেমন: Cotton Saree / পাঞ্জাবি / শার্ট' : 'e.g. Cotton Saree / Shirt'}
                  className="w-full border border-stone-300 bg-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Selling Price */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  {isBn ? 'বিক্রয় মূল্য (দর) *' : 'Sale Price *'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-stone-300 bg-white px-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Stock Quantity */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  {isBn ? 'স্টক পরিমাণ' : 'Stock Qty'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  className="w-full border border-stone-300 bg-white px-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold text-emerald-700 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Cost Price (Optional) */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-stone-500 mb-1">
                  {isBn ? 'কেনা দাম (ঐচ্ছিক)' : 'Cost (Opt)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0"
                  className="w-full border border-stone-200 bg-white px-2.5 py-2 rounded-xl text-xs sm:text-sm font-mono text-stone-700 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                editingId
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                {editingId
                  ? isBn
                    ? 'প্রোডাক্ট আপডেট করুন'
                    : 'Update Product Stock'
                  : isBn
                  ? 'স্টকে প্রোডাক্ট সেভ করুন (Save to Stock)'
                  : 'Save Product to Stock'}
              </span>
            </button>
          </form>

          {/* Search Saved Products */}
          <div className="relative">
            <Search className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isBn
                  ? 'প্রোডাক্টের প্রথম অক্ষর বা নাম লিখে খুঁজুন...'
                  : 'Type first letter or product name to search...'
              }
              className="w-full border border-stone-200 bg-stone-50 pl-10 pr-8 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Product Stock List */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 px-4 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              <Package className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-semibold text-stone-600">
                {searchQuery
                  ? isBn
                    ? `"${searchQuery}" দিয়ে কোনো প্রোডাক্ট পাওয়া যায়নি`
                    : `No product found matching "${searchQuery}"`
                  : isBn
                  ? 'এখনো কোনো প্রোডাক্ট স্টকে যোগ করা হয়নি'
                  : 'No products added to stock yet'}
              </p>
              <p className="text-[11px] text-stone-400 mt-1">
                {isBn
                  ? 'উপরের বক্সে প্রোডাক্টের নাম, দাম এবং স্টক সংখ্যা লিখে সেভ করুন'
                  : 'Add product name, selling price, and stock quantity above'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-white">
              {filteredProducts.map((prod) => {
                const isLowStock = (prod.stock || 0) <= 3 && (prod.stock || 0) > 0;
                const isOutOfStock = (prod.stock || 0) <= 0;
                const isAddingStock = quickAddStockId === prod.id;

                return (
                  <div
                    key={prod.id}
                    className="p-3 sm:p-3.5 hover:bg-stone-50/80 transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Product Name & Price */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                            {prod.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                              isOutOfStock
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : isLowStock
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isLowStock && <AlertTriangle className="w-2.5 h-2.5" />}
                            <span>
                              {isBn ? 'স্টক:' : 'Stock:'} {prod.stock || 0} {prod.unit || 'Pcs'}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="font-mono font-extrabold text-blue-700">
                            {isBn ? 'বিক্রয় দর:' : 'Price:'} {sym}
                            {prod.price.toFixed(0)}
                          </span>
                          {prod.purchasePrice !== undefined && prod.purchasePrice > 0 && (
                            <span className="font-mono text-[11px] text-stone-400">
                              {isBn ? 'কেনা:' : 'Cost:'} {sym}
                              {prod.purchasePrice.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Quick Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onSelectForBill && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectForBill(prod, 1);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                            title={isBn ? 'বিলে যোগ করুন' : 'Add to Bill'}
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>{isBn ? '+ বিলে নিন' : '+ Bill'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (isAddingStock) {
                              setQuickAddStockId(null);
                            } else {
                              setQuickAddStockId(prod.id);
                              setQuickAddStockQty('');
                            }
                          }}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          title={isBn ? 'নতুন স্টক যোগ করুন' : 'Add Stock'}
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span>{isBn ? '+ স্টক' : '+ Stock'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartEdit(prod)}
                          className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title={isBn ? 'এডিট' : 'Edit'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteProduct(prod.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={isBn ? 'ডিলিট' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Add Stock Row */}
                    {isAddingStock && (
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 flex-wrap bg-emerald-50/50 p-2 rounded-xl">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-emerald-800">
                            {isBn ? 'দ্রুত স্টক বাড়ান:' : 'Quick Add:'}
                          </span>
                          {[1, 5, 10, 20, 50].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => onAdjustStock(prod.id, num)}
                              className="px-2 py-1 bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer"
                            >
                              +{num}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={quickAddStockQty}
                            onChange={(e) => setQuickAddStockQty(e.target.value)}
                            placeholder={isBn ? 'সংখ্যা লিখুন' : 'Qty'}
                            className="w-20 border border-emerald-300 bg-white px-2 py-1 rounded-lg text-xs font-mono font-bold focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmQuickStock(prod.id)}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            {isBn ? 'যোগ করুন' : 'Add'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
