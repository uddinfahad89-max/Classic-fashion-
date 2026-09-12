import QRCode from 'qrcode';

/**
 * Generates a QR Code as a Data URL
 * @param text The text or UPI URI to encode
 * @param width Dimension in pixels
 */
export async function generateQrDataUrl(text: string, width = 140): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}

/**
 * Builds a standard UPI payment URI
 */
export function buildUpiUri(params: {
  vpa: string;
  payeeName: string;
  amount: number;
  invoiceNo?: string;
  note?: string;
}): string {
  const cleanVpa = params.vpa.trim();
  const cleanName = encodeURIComponent(params.payeeName.trim());
  const cleanAmount = params.amount > 0 ? params.amount.toFixed(2) : '';
  const note = encodeURIComponent(params.note || `Bill #${params.invoiceNo || ''}`);

  let uri = `upi://pay?pa=${cleanVpa}&pn=${cleanName}&cu=INR`;
  if (cleanAmount) {
    uri += `&am=${cleanAmount}`;
  }
  if (note) {
    uri += `&tn=${note}`;
  }
  return uri;
}
