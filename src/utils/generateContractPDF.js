import PDFDocument from "pdfkit";

// Helper: Format Currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency', currency: 'TND', minimumFractionDigits: 3
  }).format(amount || 0);
};

// Helper: Format Date
const formatDate = (date) => {
  if (!date) return "...";
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const generateContractPDF = async (contract, venue, settings) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // --- 1. SETTINGS RESOLUTION (Fixing the bug) ---
      // We explicitly check if values exist in the DB settings object
      const BRAND = {
        primary: settings?.branding?.colors?.primary || "#F18237",
        text: settings?.branding?.colors?.text || "#1F2937",
        logo: settings?.branding?.logo?.url || null
      };

      const LABELS = {
        title: contract.contractType === 'partner' 
          ? (settings?.labels?.partnerContractTitle || "ACCORD DE PARTENARIAT") 
          : (settings?.labels?.contractTitle || "CONTRAT DE PRESTATION"),
        
        party2: contract.contractType === 'partner' 
          ? (settings?.labels?.partnerLabel || "Le Partenaire") 
          : (settings?.labels?.clientLabel || "Le Client"),
          
        signatures: settings?.labels?.signaturesTitle || "SIGNATURES"
      };

      // --- 2. HEADER ---
      // Logo
      if (BRAND.logo) {
        try {
          const response = await fetch(BRAND.logo);
          const arrayBuffer = await response.arrayBuffer();
          doc.image(Buffer.from(arrayBuffer), 50, 45, { height: 50 });
        } catch (e) { console.warn("Logo load failed", e); }
      }

      // Company Info (Left)
      const textStartY = BRAND.logo ? 105 : 50;
      doc.fillColor(BRAND.primary).fontSize(14).font("Helvetica-Bold")
         .text(settings?.companyInfo?.displayName || venue.name, 50, textStartY);
         
      doc.fillColor("#666").fontSize(9).font("Helvetica")
         .text(settings?.companyInfo?.legalName || venue.name)
         .text(settings?.companyInfo?.address || venue.address)
         .text(`MF: ${settings?.companyInfo?.matriculeFiscale || "N/A"}`);

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
      
      // Venue
      doc.font("Helvetica-Bold").text(settings?.companyInfo?.legalName || venue.name, { continued: true });
      doc.font("Helvetica").text(`, MF: ${settings?.companyInfo?.matriculeFiscale}, Adresse: ${settings?.companyInfo?.address}`);
      doc.text(`(Ci-après dénommé "${settings?.labels?.serviceProvider || "La Société"}")`);
      
      doc.moveDown();
      
      // Other Party
      doc.font("Helvetica-Bold").text(contract.party.name, { continued: true });
      doc.font("Helvetica").text(`, ID: ${contract.party.identifier}`);
      doc.text(`Adresse: ${contract.party.address}`);
      if(contract.contractType === 'partner') doc.text(`Catégorie: ${contract.party.category.toUpperCase()}`);
      doc.text(`(Ci-après dénommé "${LABELS.party2}")`);

      // --- 4. DETAILS ---
      doc.moveDown(2);
      drawSectionTitle(doc, "DÉTAILS DE L'ÉVÉNEMENT", BRAND.primary);
      doc.fontSize(10).fillColor(BRAND.text)
         .text(`Événement: ${contract.title}`)
         .text(`Dates: Du ${formatDate(contract.logistics.startDate)} au ${formatDate(contract.logistics.endDate)}`)
         .text(`Horaires: ${contract.logistics.checkInTime || "N/A"} - ${contract.logistics.checkOutTime || "N/A"}`);

      // --- 5. FINANCIALS (Logic Split) ---
      doc.moveDown(2);
      drawSectionTitle(doc, "CONDITIONS FINANCIÈRES", BRAND.primary);
      doc.moveDown(0.5);

      const isPartner = contract.contractType === 'partner';

      if (isPartner) {
        // Simple list for partners
        contract.services.forEach(s => {
          doc.text(`• ${s.description} : ${formatCurrency(s.amount)}`);
        });
        doc.moveDown();
        doc.font("Helvetica-Bold").text(`TOTAL À PAYER AU PARTENAIRE : ${formatCurrency(contract.financials.totalTTC)}`);
      } else {
        // Full table for Clients
        const startY = doc.y;
        doc.rect(50, startY, 495, 20).fill("#f3f4f6");
        doc.fillColor("#000").font("Helvetica-Bold").fontSize(9);
        doc.text("Description", 60, startY + 6);
        doc.text("Total", 450, startY + 6, { width: 90, align: "right" });
        
        let y = startY + 25;
        contract.services.forEach(s => {
          doc.font("Helvetica").fillColor(BRAND.text).text(s.description, 60, y);
          doc.text(formatCurrency(s.amount), 450, y, { width: 90, align: "right" });
          y += 20;
        });

        // Totals
        y += 10;
        doc.text(`Total HT: ${formatCurrency(contract.financials.amountHT)}`, 350, y, { align: "right", width: 190 });
        y += 15;
        doc.text(`TVA (${contract.financials.vatRate}%): ${formatCurrency(contract.financials.taxAmount)}`, 350, y, { align: "right", width: 190 });
        y += 15;
        doc.text(`Timbre: ${formatCurrency(contract.financials.stampDuty)}`, 350, y, { align: "right", width: 190 });
        y += 20;
        doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.primary)
           .text(`NET À PAYER: ${formatCurrency(contract.financials.totalTTC)}`, 350, y, { align: "right", width: 190 });
      }

      // --- 6. SIGNATURES ---
      doc.moveDown(4);
      if(doc.y > 650) doc.addPage();
      
      const sigY = doc.y;
      doc.fontSize(10).fillColor(BRAND.text);
      
      // Left Box
      doc.text("POUR LA SOCIÉTÉ", 50, sigY);
      doc.rect(50, sigY + 15, 200, 80).strokeColor("#ddd").stroke();
      
      // Right Box
      doc.text(`POUR ${LABELS.party2.toUpperCase()}`, 300, sigY);
      doc.rect(300, sigY + 15, 200, 80).strokeColor("#ddd").stroke();

      doc.end();

    } catch (err) { reject(err); }
  });
};

function drawSectionTitle(doc, text, color) {
  doc.fontSize(11).font("Helvetica-Bold").fillColor(color).text(text, 50, doc.y);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor(color).stroke();
  doc.moveDown(0.5);
}