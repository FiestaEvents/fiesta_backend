import PDFDocument from "pdfkit";
// Ensure fetch is available in Node environment (Node 18+ has native fetch)
// If older node, you might need: import fetch from 'node-fetch';

// Helper: Format Currency
const formatCurrency = (amount, currency = 'TND') => {
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency', currency: currency, minimumFractionDigits: 3
  }).format(amount || 0);
};

// Helper: Format Date
const formatDate = (date) => {
  if (!date) return "...";
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

/**
 * Generate Contract PDF
 * @param {Object} contract - The contract data model
 * @param {Object} business - The business data model (formerly venue)
 * @param {Object} settings - The pdf/contract settings object
 */
export const generateContractPDF = async (contract, business, settings) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // --- 1. SETTINGS RESOLUTION ---
      // Branding and Labels adapted for Chameleon Architecture
      const BRAND = {
        primary: settings?.branding?.colors?.primary || "#F18237",
        text: settings?.branding?.colors?.text || "#1F2937",
        logo: settings?.branding?.logo?.url || null // S3 or Public URL
      };

      // Determine labels based on business category if not explicitly set
      let defaultTitle = "CONTRAT DE PRESTATION";
      if (business.category === 'photography') defaultTitle = "CONTRAT DE CESSION DE DROITS";
      if (business.category === 'catering') defaultTitle = "CONTRAT TRAITEUR";

      const LABELS = {
        title: contract.contractType === 'partner' 
          ? (settings?.labels?.partnerContractTitle || "ACCORD DE PARTENARIAT") 
          : (settings?.labels?.contractTitle || defaultTitle),
        
        party2: contract.contractType === 'partner' 
          ? (settings?.labels?.partnerLabel || "Le Partenaire") 
          : (settings?.labels?.clientLabel || "Le Client"),
          
        signatures: settings?.labels?.signaturesTitle || "SIGNATURES",
        
        providerLabel: settings?.labels?.serviceProvider || (business.name || "Le Prestataire")
      };

      // --- 2. HEADER ---
      // Logo
      if (BRAND.logo) {
        try {
          const response = await fetch(BRAND.logo);
          if(response.ok) {
             const arrayBuffer = await response.arrayBuffer();
             doc.image(Buffer.from(arrayBuffer), 50, 45, { height: 50 });
          }
        } catch (e) { console.warn("Logo load failed", e); }
      }

      // Business Info (Left)
      // Uses generic business fields (name, address)
      const textStartY = BRAND.logo ? 105 : 50;
      doc.fillColor(BRAND.primary).fontSize(14).font("Helvetica-Bold")
         .text(settings?.companyInfo?.displayName || business.name, 50, textStartY);
         
      doc.fillColor("#666").fontSize(9).font("Helvetica")
         .text(settings?.companyInfo?.legalName || business.name)
         .text(settings?.companyInfo?.address || business.address || "")
         .text(`MF: ${settings?.companyInfo?.matriculeFiscale || business.settings?.taxId || "N/A"}`)
         .text(`Tél: ${business.contact?.phone || ""}`);

      // Contract Info (Right)
      doc.fillColor(BRAND.primary).fontSize(16).font("Helvetica-Bold")
         .text(LABELS.title, 300, 50, { align: "right" });
      
      doc.fillColor(BRAND.text).fontSize(10).font("Helvetica")
         .text(`Réf: ${contract.contractNumber}`, 300, 75, { align: "right" })
         .text(`Date: ${formatDate(contract.createdAt)}`, 300, 90, { align: "right" });

      // Divider
      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).strokeColor(BRAND.primary).stroke();

      // --- 3. PARTIES ---
      doc.moveDown(2);
      doc.fillColor(BRAND.text).text("ENTRE :", 50, doc.y, { underline: true });
      doc.moveDown(0.5);
      
      // Business (Provider)
      doc.font("Helvetica-Bold").text(settings?.companyInfo?.legalName || business.name, { continued: true });
      doc.font("Helvetica").text(`, MF: ${settings?.companyInfo?.matriculeFiscale || business.settings?.taxId || "N/A"}, Adresse: ${settings?.companyInfo?.address || business.address || ""}`);
      doc.text(`(Ci-après dénommé "${LABELS.providerLabel}")`);
      
      doc.moveDown();
      
      // Other Party (Client or Partner)
      // contract.party is a generic object populated from Client/Partner models
      doc.font("Helvetica-Bold").text(contract.party.name, { continued: true });
      if(contract.party.identifier) doc.font("Helvetica").text(`, ID/CIN: ${contract.party.identifier}`);
      doc.text(`Adresse: ${contract.party.address || "Non spécifiée"}`);
      if(contract.contractType === 'partner' && contract.party.category) {
          doc.text(`Catégorie: ${contract.party.category.toUpperCase()}`);
      }
      doc.text(`(Ci-après dénommé "${LABELS.party2}")`);

      // --- 4. DETAILS ---
      doc.moveDown(2);
      drawSectionTitle(doc, "DÉTAILS DE LA PRESTATION", BRAND.primary);
      doc.fontSize(10).fillColor(BRAND.text)
         .text(`Titre: ${contract.title}`)
         .text(`Dates: Du ${formatDate(contract.logistics.startDate)} au ${formatDate(contract.logistics.endDate)}`);
         
      // Conditional details based on vertical
      if (business.category === 'venue') {
         doc.text(`Horaires: ${contract.logistics.checkInTime || "N/A"} - ${contract.logistics.checkOutTime || "N/A"}`);
      }

      // --- 5. FINANCIALS (Logic Split) ---
      doc.moveDown(2);
      drawSectionTitle(doc, "CONDITIONS FINANCIÈRES", BRAND.primary);
      doc.moveDown(0.5);

      const isPartner = contract.contractType === 'partner';

      if (isPartner) {
        // Simple list for partners
        if (contract.services && contract.services.length > 0) {
            contract.services.forEach(s => {
            doc.text(`• ${s.description} : ${formatCurrency(s.amount, business.settings?.currency)}`);
            });
        }
        doc.moveDown();
        doc.font("Helvetica-Bold").text(`TOTAL À PAYER AU PARTENAIRE : ${formatCurrency(contract.financials.totalTTC, business.settings?.currency)}`);
      } else {
        // Full table for Clients
        const startY = doc.y;
        doc.rect(50, startY, 495, 20).fill("#f3f4f6");
        doc.fillColor("#000").font("Helvetica-Bold").fontSize(9);
        doc.text("Description", 60, startY + 6);
        doc.text("Total", 450, startY + 6, { width: 90, align: "right" });
        
        let y = startY + 25;
        if (contract.services && contract.services.length > 0) {
            contract.services.forEach(s => {
            doc.font("Helvetica").fillColor(BRAND.text).text(s.description, 60, y);
            doc.text(formatCurrency(s.amount, business.settings?.currency), 450, y, { width: 90, align: "right" });
            y += 20;
            });
        }

        // Totals
        y += 10;
        doc.text(`Total HT: ${formatCurrency(contract.financials.amountHT, business.settings?.currency)}`, 350, y, { align: "right", width: 190 });
        y += 15;
        doc.text(`TVA (${contract.financials.vatRate}%): ${formatCurrency(contract.financials.taxAmount, business.settings?.currency)}`, 350, y, { align: "right", width: 190 });
        y += 15;
        doc.text(`Timbre: ${formatCurrency(contract.financials.stampDuty, business.settings?.currency)}`, 350, y, { align: "right", width: 190 });
        y += 20;
        doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.primary)
           .text(`NET À PAYER: ${formatCurrency(contract.financials.totalTTC, business.settings?.currency)}`, 350, y, { align: "right", width: 190 });
      }

      // --- 6. SIGNATURES ---
      doc.moveDown(4);
      // Avoid page break inside signature block if possible
      if(doc.y > 650) doc.addPage();
      
      const sigY = doc.y;
      doc.fontSize(10).fillColor(BRAND.text);
      
      // Left Box (Business)
      doc.text(`POUR ${LABELS.providerLabel.toUpperCase()}`, 50, sigY);
      doc.rect(50, sigY + 15, 200, 80).strokeColor("#ddd").stroke();
      
      // Right Box (Client/Partner)
      doc.text(`POUR ${LABELS.party2.toUpperCase()}`, 300, sigY);
      doc.rect(300, sigY + 15, 200, 80).strokeColor("#ddd").stroke();
      
      // Footer text for legal validity
      doc.fontSize(8).fillColor("#999").text("Ce document est généré électroniquement par la plateforme Fiesta.", 50, 780, { align: "center", width: 500 });

      doc.end();

    } catch (err) { reject(err); }
  });
};

function drawSectionTitle(doc, text, color) {
  doc.fontSize(11).font("Helvetica-Bold").fillColor(color).text(text, 50, doc.y);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor(color).stroke();
  doc.moveDown(0.5);
}