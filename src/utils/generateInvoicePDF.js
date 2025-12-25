import PDFDocument from "pdfkit";
import { pdfTranslations } from "./invoicePdfTranslations.js";
import axios from "axios";

// Helper to fetch image buffer from URL or Base64
const fetchImageBuffer = async (src) => {
  if (!src) return null;
  try {
    // Handle Base64
    if (src.startsWith("data:")) {
      const base64Data = src.split(";base64,").pop();
      return Buffer.from(base64Data, "base64");
    }
    // Handle Remote URL
    if (src.startsWith("http")) {
      const response = await axios.get(src, { responseType: "arraybuffer" });
      return Buffer.from(response.data);
    }
    return null;
  } catch (err) {
    console.error("Error fetching logo for PDF:", err.message);
    return null; // Fail gracefully, don't crash PDF generation
  }
};

/**
 * Generate Invoice PDF
 * @param {Object} invoice - Invoice data model
 * @param {Object} business - Business data model (formerly venue)
 * @param {String} language - Language code ('fr', 'en', 'ar')
 * @param {Object} settings - PDF configuration settings
 */
export const generateInvoicePDF = async (invoice, business, language = "fr", settings = null) => {
  // 1. Prepare Data & Defaults
  const t = pdfTranslations[language] || pdfTranslations.fr;
  const s = {
    colors: settings?.branding?.colors || { primary: "#F18237", text: "#1F2937", secondary: "#374151" },
    fonts: settings?.branding?.fonts || { size: 10 },
    layout: settings?.layout || { sections: [] }, // If empty, uses default order
    table: settings?.table || { columns: {}, headerColor: "#F18237" },
    labels: settings?.labels || {},
    logoUrl: settings?.branding?.logo?.url
  };

  // 2. Fetch Logo Buffer (Async operation before PDF generation)
  const logoBuffer = await fetchImageBuffer(s.logoUrl);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // --- STYLING CONSTANTS ---
      const fontRegular = "Helvetica";
      const fontBold = "Helvetica-Bold";
      const primaryColor = s.colors.primary;
      const secondaryColor = s.colors.secondary;
      const textColor = s.colors.text;
      const baseFontSize = s.fonts.size || 10;
      
      // Helper: Draw a Section
      const renderers = {
        
        // --- 1. HEADER (Logo + Title) ---
        header: () => {
          const startY = doc.y;
          
          // Logo (Left)
          if (logoBuffer) {
            try {
              // Fit logo within 150x60 box
              doc.image(logoBuffer, 50, startY, { height: 60, fit: [150, 60], align: 'left' });
            } catch (e) { console.error("PDF Image Error", e); }
          } else {
            // Fallback text logo if no image
            doc.fillColor(primaryColor).fontSize(16).font(fontBold).text(business.name, 50, startY);
          }

          // Title (Right)
          doc.fillColor(primaryColor).fontSize(24).font(fontBold)
             .text(s.labels.invoiceTitle || t.invoice, 50, startY + 10, { align: "right" });
          
          doc.fillColor(secondaryColor).fontSize(10).font(fontRegular)
             .text(`# ${invoice.invoiceNumber}`, 50, startY + 40, { align: "right" });

          // Move cursor down safely (account for logo height)
          doc.y = Math.max(startY + 80, doc.y + 20);
        },

        // --- 2. DETAILS (From / To / Dates) ---
        details: () => {
          doc.moveDown(1);
          const startY = doc.y;
          const leftColX = 50;
          const rightColX = 350;

          // FROM (Left) - Business Details
          doc.fillColor(secondaryColor).fontSize(8).font(fontBold).text((s.labels.from || "FROM").toUpperCase(), leftColX, startY);
          doc.moveDown(0.5);
          doc.fillColor(textColor).fontSize(11).font(fontBold).text(business.name);
          doc.fontSize(baseFontSize).font(fontRegular).fillColor(secondaryColor);
          if (business.address) doc.text(business.address); // Generic address field
          // Check both nested companyInfo and generic settings for tax ID
          const taxId = settings?.companyInfo?.matriculeFiscale || business.settings?.taxId;
          if (taxId) doc.text(`MF: ${taxId}`);

          // TO (Right) - Client Details
          doc.text((s.labels.to || "BILL TO").toUpperCase(), rightColX, startY);
          doc.moveDown(0.5);
          doc.fillColor(textColor).fontSize(11).font(fontBold).text(invoice.recipientName, rightColX);
          doc.fontSize(baseFontSize).font(fontRegular).fillColor(secondaryColor);
          if (invoice.recipientCompany) doc.text(invoice.recipientCompany, rightColX);
          if (invoice.recipientEmail) doc.text(invoice.recipientEmail, rightColX);

          // Dates Row
          doc.moveDown(2);
          const dateY = doc.y;
          doc.fillColor(secondaryColor).font(fontBold).text("DATE:", leftColX, dateY);
          doc.font(fontRegular).text(new Date(invoice.issueDate).toLocaleDateString(), leftColX + 40, dateY);
          
          doc.font(fontBold).text("DUE:", leftColX + 150, dateY);
          doc.font(fontRegular).text(new Date(invoice.dueDate).toLocaleDateString(), leftColX + 180, dateY);

          doc.moveDown(2);
        },

        // --- 3. ITEMS TABLE ---
        items: () => {
          doc.moveDown(0.5);
          const tableTop = doc.y;
          const tableWidth = 500;
          
          // Determine visible columns based on settings (or default to all)
          const cols = s.table.columns || { description: true, quantity: true, rate: true, total: true };
          
          // Dynamic Layout Calculations
          let xPositions = { desc: 60 };
          
          // Adjust positions based on active columns logic (Simplified for readability)
          // Default layout: Desc (Left) | Qty (Center) | Rate (Right) | Total (Right)
          xPositions.qty = 310;
          xPositions.rate = 390;
          xPositions.total = 450;

          // Header Background
          doc.rect(50, tableTop, tableWidth, 25).fill(s.table.headerColor || primaryColor);
          doc.fillColor("#FFFFFF").fontSize(9).font(fontBold);

          // Header Text
          if (cols.description !== false) doc.text(s.labels.item || "Item", xPositions.desc, tableTop + 8);
          if (cols.quantity !== false) doc.text(s.labels.quantity || "Qty", xPositions.qty, tableTop + 8, { width: 40, align: 'center' });
          if (cols.rate !== false) doc.text(s.labels.rate || "Price", xPositions.rate, tableTop + 8, { width: 70, align: 'right' });
          if (cols.total !== false) doc.text(s.labels.total || "Total", xPositions.total, tableTop + 8, { width: 90, align: 'right' });

          // Items Loop
          let y = tableTop + 30;
          doc.font(fontRegular).fontSize(baseFontSize);

          invoice.items.forEach((item, i) => {
            // Striped Rows
            if (s.table.striped && i % 2 !== 0) {
              doc.rect(50, y - 5, tableWidth, 20).fill("#F9FAFB");
            }

            doc.fillColor(textColor);
            
            // Render Columns
            if (cols.description !== false) doc.text(item.description, xPositions.desc, y, { width: 240 });
            if (cols.quantity !== false) doc.text(item.quantity.toString(), xPositions.qty, y, { width: 40, align: 'center' });
            if (cols.rate !== false) doc.text(item.rate.toFixed(2), xPositions.rate, y, { width: 70, align: 'right' });
            if (cols.total !== false) doc.text(item.amount.toFixed(2), xPositions.total, y, { width: 90, align: 'right' });

            y += 20; // Row Height
            
            // Page Break Handling
            if (y > 750) {
              doc.addPage();
              y = 50;
            }
          });

          doc.y = y + 10; // Update cursor
        },

        // --- 4. TOTALS ---
        totals: () => {
          doc.moveDown(1);
          const startY = doc.y;
          const labelX = 300;
          const valueX = 450;
          const valueWidth = 90;

          const currency = invoice.currency || business.settings?.currency || 'DT';

          const drawRow = (label, value, isBold = false, color = textColor, fontSize = baseFontSize) => {
             doc.font(isBold ? fontBold : fontRegular).fontSize(fontSize).fillColor(color);
             doc.text(label, labelX, doc.y, { width: 140, align: 'right' });
             doc.text(value, valueX, doc.y, { width: valueWidth, align: 'right' });
             doc.moveDown(0.5);
          };

          drawRow(`${t.subtotal}:`, invoice.subtotal.toFixed(2));
          
          if (invoice.taxAmount > 0) {
             drawRow(`${t.tax} (${invoice.taxRate}%):`, invoice.taxAmount.toFixed(2));
          }

          if (invoice.discount > 0) {
             drawRow("Discount:", `-${invoice.discount.toFixed(2)}`, false, "#ef4444");
          }

          doc.moveDown(0.5);
          // Grand Total Box
          doc.rect(labelX, doc.y - 5, 250, 25).fill(primaryColor);
          doc.y += 5; // center text vertically
          drawRow(s.labels.total || "Total", `${invoice.totalAmount.toFixed(2)} ${currency}`, true, "#FFFFFF", 12);
          
          doc.moveDown(2);
        },

        // --- 5. FOOTER / TERMS ---
        footer: () => {
          // Push to bottom if desired, or just render where cursor is
          // Check if space is low, add page
          if (doc.y > 650) doc.addPage();
          
          // Separator
          doc.strokeColor("#E5E7EB").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(2);

          // Payment Instructions
          if (s.labels.paymentInstructions || settings?.paymentTerms?.bankDetails) {
            doc.font(fontBold).fontSize(9).fillColor(secondaryColor).text((s.labels.paymentInstructions || "PAYMENT INFO").toUpperCase());
            doc.moveDown(0.5);
            doc.font(fontRegular).text(settings?.paymentTerms?.bankDetails || "");
          }

          // Page Numbers (Centered Bottom)
          const range = doc.bufferedPageRange();
          for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor("#9CA3AF").text(
              `Page ${i + 1} / ${range.count}`,
              50,
              doc.page.height - 50,
              { align: "center", width: 500 }
            );
          }
        }
      };

      // --- MAIN EXECUTION LOOP ---
      // 1. Get Sections Order from Settings
      const sections = s.layout.sections.length > 0 
          ? s.layout.sections.sort((a, b) => a.order - b.order) 
          : []; // If empty, we trigger fallback below

      // 2. Render Loop
      if (sections.length > 0) {
          for (const section of sections) {
            if (!section.visible) continue; // Skip hidden sections
            const renderer = renderers[section.id];
            if (renderer) renderer();
          }
      } else {
        // Fallback: Standard Invoice Order
        renderers.header();
        renderers.details();
        renderers.items();
        renderers.totals();
        renderers.footer();
      }

      doc.end();

    } catch (err) {
      console.error("PDF Generation Error:", err);
      reject(err);
    }
  });
};