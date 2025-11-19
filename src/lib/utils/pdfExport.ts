// PBS Admin - PDF Export Utility
// Convert HTML content to PDF for client reports

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  filename: string;
  title?: string;
  clientName?: string;
  petName?: string;
  consultationDate?: string;
}

/**
 * Export HTML element to PDF
 * @param element - HTML element to convert (typically the rendered markdown preview)
 * @param options - PDF export options
 */
export async function exportToPDF(
  element: HTMLElement,
  options: PDFExportOptions
): Promise<Blob> {
  // Capture the element as canvas
  const canvas = await html2canvas(element, {
    scale: 2, // Higher quality
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  // Calculate PDF dimensions (A4 size)
  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Create PDF
  const pdf = new jsPDF('p', 'mm', 'a4');

  // Add header if details provided
  if (options.title || options.clientName || options.petName) {
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    let y = 10;

    if (options.title) {
      pdf.text(options.title, 15, y);
      y += 5;
    }
    if (options.clientName) {
      pdf.text(`Client: ${options.clientName}`, 15, y);
      y += 5;
    }
    if (options.petName) {
      pdf.text(`Pet: ${options.petName}`, 15, y);
      y += 5;
    }
    if (options.consultationDate) {
      pdf.text(`Date: ${options.consultationDate}`, 15, y);
      y += 5;
    }

    // Add separator line
    pdf.setDrawColor(200);
    pdf.line(15, y + 2, 195, y + 2);
  }

  // Add image to PDF
  const imgData = canvas.toDataURL('image/png');
  let heightLeft = imgHeight;
  let position = options.title ? 35 : 15; // Offset if header added

  pdf.addImage(imgData, 'PNG', 15, position, imgWidth - 30, imgHeight);
  heightLeft -= pageHeight;

  // Add additional pages if content is longer than one page
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight + 15;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 15, position, imgWidth - 30, imgHeight);
    heightLeft -= pageHeight;
  }

  // Convert to blob
  return pdf.output('blob');
}

/**
 * Generate PDF filename with timestamp
 */
export function generatePDFFilename(baseName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${baseName}-${timestamp}.pdf`;
}
