import { bengaliToEnglishDigits } from './barcodeUtils';
import { generateAutoSkuFromName } from '../components/ProductStockModal';
import { ExtractedBillItem } from '../components/PurchaseBillUploadModal';

export interface ParsedBillResult {
  supplierName: string;
  billNo: string;
  billDate: string;
  totalBillAmount: number;
  items: ExtractedBillItem[];
  rawLines: string[];
}

/**
 * Intelligent client-side parser that converts OCR text from physical purchase bills,
 * cash memos, wholesale receipts, and challans into structured product items with auto-SKU barcodes.
 */
export function parseBillOcrText(
  rawText: string,
  profitMarginPercent: number = 25
): ParsedBillResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      supplierName: '',
      billNo: '',
      billDate: '',
      totalBillAmount: 0,
      items: [],
      rawLines: [],
    };
  }

  // Split lines and normalize
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const cleanLines = lines.map((line) => {
    // Convert Bengali numerals to English
    return bengaliToEnglishDigits(line);
  });

  let supplierName = '';
  let billNo = '';
  let billDate = '';
  let totalBillAmount = 0;
  const items: ExtractedBillItem[] = [];
  const usefulLines: string[] = [];

  // Common noise headers / table headers to skip from product items
  const skipKeywords = [
    'serial',
    'sl no',
    's.l',
    'description',
    'item name',
    'particulars',
    'quantity',
    'rate',
    'price',
    'amount',
    'subtotal',
    'sub-total',
    'grand total',
    'total amount',
    'cash memo',
    'credit memo',
    'invoice',
    'challan',
    'signature',
    'authorized',
    'thank you',
    'terms &',
    'conditions',
    'e.&o.e',
    'বিবরণ',
    'পরিমাণ',
    'দর',
    'মোট',
    'স্বাক্ষর',
  ];

  // Regex patterns for metadata
  const datePattern = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})|(\d{4}[./-]\d{1,2}[./-]\d{1,2})/;
  const billNoPattern = /(?:bill|inv|invoice|memo|challan|নং|বিল|মেমো)\s*(?:no\.?|#|:|-)?\s*([a-zA-Z0-9/-]+)/i;
  const totalPattern = /(?:grand\s*total|net\s*payable|total\s*amount|total|সর্বমোট|মোট)\s*[:=]?\s*([₹৳Rs$]?\s*[\d,]+(?:\.\d+)?)/i;
  const supplierKeywords = [
    'm/s',
    'traders',
    'enterprise',
    'enterprises',
    'store',
    'stores',
    'shop',
    'textile',
    'garments',
    'fabrics',
    'agency',
    'agencies',
    'company',
    'co.',
    'ltd',
    'বস্ত্রালয়',
    'ট্রেডার্স',
    'স্টোর',
    'ভাণ্ডার',
    'গার্মেন্টস',
    'কোম্পানি',
  ];

  for (let i = 0; i < cleanLines.length; i++) {
    const rawLine = cleanLines[i];
    usefulLines.push(rawLine);
    const lower = rawLine.toLowerCase();

    // 1. Supplier detection (mostly in the top 6 lines)
    if (i < 8 && !supplierName) {
      if (supplierKeywords.some((kw) => lower.includes(kw))) {
        // Clean line to get supplier
        const cleanSupplier = rawLine
          .replace(/^[^a-zA-Z\u0980-\u09FF]+/, '')
          .replace(/phone|mobile|tel|date|bill|gst|tin.*/i, '')
          .trim();
        if (cleanSupplier.length >= 3 && cleanSupplier.length <= 60) {
          supplierName = cleanSupplier;
        }
      }
    }

    // 2. Bill Date detection
    if (!billDate) {
      const dateMatch = rawLine.match(datePattern);
      if (dateMatch) {
        billDate = dateMatch[0].replace(/[./]/g, '-');
      }
    }

    // 3. Bill Number detection
    if (!billNo) {
      const billMatch = rawLine.match(billNoPattern);
      if (billMatch && billMatch[1] && billMatch[1].length >= 2) {
        billNo = billMatch[1].trim();
      }
    }

    // 4. Total amount detection
    const totalMatch = rawLine.match(totalPattern);
    if (totalMatch && totalMatch[1]) {
      const numStr = totalMatch[1].replace(/[^0-9.]/g, '');
      const parsedVal = parseFloat(numStr);
      if (parsedVal > 0) {
        totalBillAmount = parsedVal;
      }
    }

    // Check if line should be skipped as table header
    const isHeaderRow = skipKeywords.some(
      (kw) => lower.includes(kw) && (lower.includes('rate') || lower.includes('qty') || lower.includes('amt') || lower.includes('price'))
    );
    if (isHeaderRow) continue;

    // Skip pure totals/footers from being parsed as products
    if (lower.startsWith('total') || lower.startsWith('grand total') || lower.startsWith('সর্বমোট') || lower.startsWith('sub total')) {
      continue;
    }

    // 5. Try parsing as a Product Line Item
    const item = parseSingleLineItem(rawLine, profitMarginPercent, items.length);
    if (item) {
      items.push(item);
    }
  }

  // If totalBillAmount wasn't explicitly found, sum the items
  const itemsSum = items.reduce((acc, it) => acc + (it.totalAmount || 0), 0);
  if (totalBillAmount <= 0) {
    totalBillAmount = itemsSum;
  }

  return {
    supplierName,
    billNo,
    billDate,
    totalBillAmount,
    items,
    rawLines: usefulLines,
  };
}

/**
 * Parses an individual text line from a receipt into a Product Item
 */
function parseSingleLineItem(
  line: string,
  marginPercent: number,
  index: number
): ExtractedBillItem | null {
  // Strip leading numbering: e.g. "1. ", "01) ", "3 - ", "#4 "
  let cleaned = line.replace(/^\s*(?:#|\()?(\d{1,3})[.)\-:\s]+\s*/, '').trim();

  // If line is too short or doesn't have letters, skip
  if (cleaned.length < 3) return null;

  // Extract units
  const unitRegex = /\b(pcs|pc|pieces|kg|kgs|gm|gms|gram|grams|ltr|litre|liter|meter|mtr|m|box|boxes|pkt|pkts|packet|packets|set|sets|doz|dozen|জোড়া|পিস|কেজি|বক্স|মিটার|প্যাকেট)\b/i;
  let unit = 'Pcs';
  const unitMatch = cleaned.match(unitRegex);
  if (unitMatch) {
    unit = unitMatch[0];
    cleaned = cleaned.replace(unitMatch[0], ' ');
  }

  // Look for "@ rate" pattern: e.g., "Polo Shirt 5 @ 250" or "Item @ 300 x 2"
  const atRateMatch = cleaned.match(/@\s*([\d,]+(?:\.\d+)?)/);
  let explicitRate: number | null = null;
  if (atRateMatch) {
    explicitRate = parseFloat(atRateMatch[1].replace(/,/g, ''));
    cleaned = cleaned.replace(atRateMatch[0], ' ');
  }

  // Extract all numeric tokens from the line
  // Keep track of their values
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const textWords: string[] = [];
  const numbers: number[] = [];

  for (const token of tokens) {
    const cleanToken = token.replace(/[^0-9.,]/g, '');
    const num = parseFloat(cleanToken.replace(/,/g, ''));
    if (!isNaN(num) && cleanToken.length > 0 && /^\d/.test(token)) {
      numbers.push(num);
    } else {
      // It's a text word
      const word = token.replace(/[^\w\u0980-\u09FF&/()+-]/g, '').trim();
      if (word) textWords.push(word);
    }
  }

  // If there are no text words, it's just raw numbers or symbols, not an item
  if (textWords.length === 0) return null;

  const productName = textWords.join(' ');
  // Filter out if name is too short or just garbage
  if (productName.length < 2) return null;

  let qty = 1;
  let purchasePrice = 0;
  let totalAmount = 0;

  if (explicitRate !== null && explicitRate > 0) {
    purchasePrice = explicitRate;
    qty = numbers.length > 0 && numbers[0] > 0 ? numbers[0] : 1;
    totalAmount = purchasePrice * qty;
  } else if (numbers.length >= 3) {
    // Typically: Qty, Rate, Total  OR  Sl, Qty, Rate, Total
    // e.g. [12, 250, 3000] -> qty: 12, rate: 250, total: 3000
    // Check if numbers[0] * numbers[1] is close to numbers[2]
    const n0 = numbers[0];
    const n1 = numbers[1];
    const n2 = numbers[2];

    if (Math.abs(n0 * n1 - n2) < 2 || Math.abs(n0 * n1 - n2) / (n2 || 1) < 0.05) {
      qty = n0;
      purchasePrice = n1;
      totalAmount = n2;
    } else if (Math.abs(n1 * n2 - n0) < 2) {
      qty = n1;
      purchasePrice = n2;
      totalAmount = n0;
    } else {
      // Default: 1st is qty, 2nd is purchase rate, 3rd is total
      qty = n0 > 0 && n0 <= 1000 ? n0 : 1;
      purchasePrice = n1 > 0 ? n1 : 0;
      totalAmount = n2 > 0 ? n2 : purchasePrice * qty;
    }
  } else if (numbers.length === 2) {
    // e.g. [10, 450] -> qty: 10, rate: 450
    // or [450, 4500] -> qty: 10?
    const n0 = numbers[0];
    const n1 = numbers[1];
    if (n0 > 0 && n0 <= 100 && n1 > n0) {
      qty = n0;
      purchasePrice = n1;
    } else if (n1 > 0 && n1 <= 100 && n0 > n1) {
      qty = n1;
      purchasePrice = n0;
    } else {
      qty = n0;
      purchasePrice = n1;
    }
    totalAmount = purchasePrice * qty;
  } else if (numbers.length === 1) {
    // e.g. "T-Shirt 350"
    qty = 1;
    purchasePrice = numbers[0];
    totalAmount = purchasePrice;
  }

  // Sanity checks
  if (qty <= 0) qty = 1;
  if (purchasePrice < 0) purchasePrice = 0;
  if (totalAmount <= 0) totalAmount = purchasePrice * qty;

  // Suggested retail sale price with profit margin
  let suggestedSalePrice = Math.round(purchasePrice * (1 + marginPercent / 100));
  if (suggestedSalePrice <= purchasePrice && purchasePrice > 0) {
    suggestedSalePrice = Math.ceil(purchasePrice * 1.15);
  }

  // Generate smart SKU barcode encoding the purchase price
  const seed = String(Math.floor(100000 + Math.random() * 900000));
  const autoBarcode = generateAutoSkuFromName(productName, seed, purchasePrice);

  return {
    id: `item-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
    name: productName,
    qty,
    unit: unit.charAt(0).toUpperCase() + unit.slice(1),
    purchasePrice,
    totalAmount,
    suggestedSalePrice,
    category: guessCategory(productName),
    barcode: autoBarcode,
  };
}

/**
 * Intelligent category guesser based on product name keywords in English and Bengali
 */
function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (
    n.includes('shirt') ||
    n.includes('pant') ||
    n.includes('t-shirt') ||
    n.includes('tshirt') ||
    n.includes('jeans') ||
    n.includes('panjabi') ||
    n.includes('shari') ||
    n.includes('saree') ||
    n.includes('lungi') ||
    n.includes('kurti') ||
    n.includes('frock') ||
    n.includes('salwar') ||
    n.includes('cloth') ||
    n.includes('শার্ট') ||
    n.includes('প্যান্ট') ||
    n.includes('পাঞ্জাবি') ||
    n.includes('শাড়ি') ||
    n.includes('লুঙ্গি')
  ) {
    return 'Clothing';
  }

  if (
    n.includes('rice') ||
    n.includes('oil') ||
    n.includes('sugar') ||
    n.includes('flour') ||
    n.includes('salt') ||
    n.includes('soap') ||
    n.includes('dal') ||
    n.includes('চাল') ||
    n.includes('তেল') ||
    n.includes('চিনি') ||
    n.includes('ডাল') ||
    n.includes('সাবান')
  ) {
    return 'Grocery';
  }

  if (
    n.includes('cable') ||
    n.includes('charger') ||
    n.includes('usb') ||
    n.includes('adapter') ||
    n.includes('battery') ||
    n.includes('bulb') ||
    n.includes('light') ||
    n.includes('ফ্যান') ||
    n.includes('লাইট')
  ) {
    return 'Electronics';
  }

  return 'General';
}
