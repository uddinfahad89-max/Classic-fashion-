import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Exports an HTML element as a clean, high-resolution A4 PDF document
 */
export async function exportElementAsPdf(
  element: HTMLElement,
  filename: string = 'Invoice.pdf'
): Promise<boolean> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2.5, // High resolution for crisp text and lines
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Calculate A4 dimensions (210 x 297 mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Scale canvas to fit A4 width with comfortable margin
    const margin = 10; // 10mm margins
    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    if (contentHeight <= pdfHeight - margin * 2) {
      // Single page document
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    } else {
      // Multi-page document handling if list is very long
      let heightLeft = contentHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - contentHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= pdfHeight;
      }
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return true;
  } catch (error) {
    console.error('Failed to export PDF:', error);
    return false;
  }
}

/**
 * Exports an HTML element as a crisp PNG image
 */
export async function exportElementAsImage(
  element: HTMLElement,
  filename: string = 'Invoice.png'
): Promise<boolean> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Failed to export image:', error);
    return false;
  }
}
