import PDFDocument from "pdfkit";
import { pdfTranslations } from "./invoicePdfTranslations.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateInvoicePDF = async (invoice, venue, language = "fr", settings = null) => {
  return new Promise((resolve, reject) => {
    try {
      const t = pdfTranslations[language] || pdfTranslations.fr;
      const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // --- STYLES FROM SETTINGS ---
      const primaryColor = settings?.branding?.colors?.primary || "#F18237";
      const textColor = settings?.branding?.colors?.text || "#333333";
      const fontRegular = "Helvetica";
      const fontBold = "Helvetica-Bold";

      // --- HEADER ---
      if (settings?.branding?.logo?.url) {
        // Note: To render remote images in PDFKit, you need to fetch the buffer first.
        // For local uploads, use the file path.
        // doc.image(logoPath, 50, 45, { width: 100 });
      }

      doc.fillColor(primaryColor).fontSize(20).font(fontBold)
         .text(settings?.labels?.invoiceTitle || t.invoice, 50, 50, { align: "right" });
         
      doc.fillColor(textColor).fontSize(10).font(fontRegular)
         .text(`#${invoice.invoiceNumber}`, 50, 75, { align: "right" });

      // --- FROM / TO ---
      doc.moveDown();
      doc.fontSize(10).font(fontBold).text(venue.name, 50, 100);
      doc.font(fontRegular).text(venue.address?.city || "Tunisia");
      
      doc.font(fontBold).text(settings?.labels?.to || t.billTo, 350, 100);
      doc.font(fontRegular).text(invoice.recipientName, 350, 115);
      if(invoice.recipientEmail) doc.text(invoice.recipientEmail, 350, 130);

      // --- DATES ---
      doc.moveDown(2);
      const dateY = doc.y;
      doc.text(`${t.issued}: ${new Date(invoice.issueDate).toLocaleDateString()}`, 50, dateY);
      doc.text(`${t.due}: ${new Date(invoice.dueDate).toLocaleDateString()}`, 200, dateY);

      // --- TABLE HEADER ---
      doc.moveDown(2);
      const tableTop = doc.y;
      doc.rect(50, tableTop, 500, 20).fill(primaryColor);
      doc.fillColor("#FFFFFF").font(fontBold);
      
      doc.text(settings?.labels?.item || "Description", 60, tableTop + 5);
      doc.text(settings?.labels?.quantity || "Qty", 300, tableTop + 5);
      doc.text(settings?.labels?.rate || "Rate", 370, tableTop + 5);
      doc.text(settings?.labels?.total || "Amount", 450, tableTop + 5);

      // --- ITEMS ---
      let y = tableTop + 25;
      doc.fillColor(textColor).font(fontRegular);
      
      invoice.items.forEach((item, i) => {
        if(i % 2 !== 0) doc.rect(50, y - 5, 500, 20).fill("#F9FAFB"); // Striped rows
        doc.fillColor(textColor).text(item.description, 60, y);
        doc.text(item.quantity.toString(), 300, y);
        doc.text(item.rate.toFixed(2), 370, y);
        doc.text(item.amount.toFixed(2), 450, y);
        y += 20;
      });

      // --- TOTALS ---
      doc.moveDown();
      const totalX = 350;
      doc.font(fontRegular).text(`${t.subtotal}:`, totalX, y + 10);
      doc.text(invoice.subtotal.toFixed(2), 450, y + 10);
      
      if (invoice.taxAmount > 0) {
        y += 15;
        doc.text(`${t.tax} (${invoice.taxRate}%):`, totalX, y + 10);
        doc.text(invoice.taxAmount.toFixed(2), 450, y + 10);
      }

      y += 25;
      doc.fontSize(12).font(fontBold).fillColor(primaryColor)
         .text(`${t.total}:`, totalX, y + 10);
      doc.text(`${invoice.totalAmount.toFixed(2)} ${invoice.currency}`, 450, y + 10);

      // --- FOOTER / TERMS ---
      if (settings?.paymentTerms?.bankDetails) {
        doc.moveDown(4);
        doc.fontSize(9).fillColor("#555")
           .text("Payment Instructions:", 50);
        doc.text(settings.paymentTerms.bankDetails);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};