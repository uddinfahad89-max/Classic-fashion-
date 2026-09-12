/**
 * Converts a numeric amount into English words (Indian / International format suitable for Invoices)
 * Example: 1260 => "One Thousand Two Hundred and Sixty Rupees only"
 */
export function numberToWords(amount: number, currencyName: string = 'Rupees'): string {
  if (isNaN(amount) || amount === 0) {
    return `Zero ${currencyName} only`;
  }

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    const unit = n % 10;
    const ten = Math.floor(n / 10);
    return tens[ten] + (unit > 0 ? ' ' + ones[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let res = '';
    if (hundred > 0) {
      res += ones[hundred] + ' Hundred';
      if (remainder > 0) {
        res += ' and ' + convertTwoDigits(remainder);
      }
    } else {
      res += convertTwoDigits(remainder);
    }
    return res;
  }

  // Handle up to Crores (Indian numbering)
  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);

  let num = integerPart;
  let words = '';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const remainingHundreds = num;

  if (crore > 0) {
    words += (words ? ' ' : '') + convertThreeDigits(crore) + ' Crore';
  }
  if (lakh > 0) {
    words += (words ? ' ' : '') + convertThreeDigits(lakh) + ' Lakh';
  }
  if (thousand > 0) {
    words += (words ? ' ' : '') + convertThreeDigits(thousand) + ' Thousand';
  }
  if (remainingHundreds > 0) {
    words += (words ? ' ' : '') + convertThreeDigits(remainingHundreds);
  }

  if (!words.trim()) {
    words = 'Zero';
  }

  let finalStr = `${words.trim()} ${currencyName}`;

  if (decimalPart > 0) {
    const decimalWords = convertTwoDigits(decimalPart);
    finalStr += ` and ${decimalWords} Paise`;
  }

  finalStr += ' only';
  return finalStr;
}
