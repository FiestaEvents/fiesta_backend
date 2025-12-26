import puppeteer from "puppeteer";
import { pdfTranslations } from "./invoicePdfTranslations.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- HELPERS ---

const getImageDataUri = async (src) => {
  if (!src) return null;
  try {
    if (src.startsWith("data:")) return src;
    let buffer,
      mimeType = "image/png";

    if (src.startsWith("http")) {
      const response = await axios.get(src, {
        responseType: "arraybuffer",
        timeout: 5000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      buffer = Buffer.from(response.data);
      if (response.headers["content-type"])
        mimeType = response.headers["content-type"];
    } else {
      const projectRoot = path.resolve(__dirname, "../../");
      const cleanPath = src.startsWith("/") ? src.slice(1) : src;
      const localPath = path.join(projectRoot, cleanPath);
      if (fs.existsSync(localPath)) {
        buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).slice(1);
        if (ext) mimeType = `image/${ext === "svg" ? "svg+xml" : ext}`;
      }
    }
    if (buffer) return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("⚠️ PDF Logo Error:", err.message);
  }
  return null;
};

const formatCurrency = (amount, currency = "TND") =>
  new Intl.NumberFormat("fr-TN", {
    style: "decimal",
    minimumFractionDigits: 3,
  }).format(amount) +
  " " +
  currency;
const formatDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");

/**
 * ✅ FIX: Robust Address Formatter
 * Prevents "{}" from appearing by checking for empty objects/strings
 */
const formatAddress = (addr) => {
  if (!addr) return "";

  // Handle Mongoose empty objects or explicit empty object strings
  if (typeof addr === "object" && Object.keys(addr).length === 0) return "";
  if (String(addr).trim() === "{}") return "";

  // If it's a valid object, extract fields
  if (typeof addr === "object") {
    const parts = [
      addr.street,
      [addr.city, addr.zipCode].filter(Boolean).join(" "), // City + Zip
      addr.state,
      addr.country,
    ];
    // Filter undefined/null/empty and join
    return parts.filter((p) => p && String(p).trim() !== "").join("<br>");
  }

  // If it's a string, just handle newlines
  return String(addr).replace(/\n/g, "<br>");
};

/**
 * GENERATE PDF
 */
export const generateInvoicePDF = async (
  invoice,
  business,
  language = "fr",
  settings = null
) => {
  const t = pdfTranslations[language] || pdfTranslations.fr;

  const s = {
    colors: settings?.branding?.colors || {
      primary: "#F18237",
      secondary: "#374151",
      text: "#1F2937",
    },
    fonts: settings?.branding?.fonts || { size: 10 },
    labels: settings?.labels || {},
    logoUrl: settings?.branding?.logo?.url,
    paymentTerms: settings?.paymentTerms || {},
    table: settings?.table || {
      headerColor: "#F18237",
      striped: false,
      rounded: true,
    },
    sections: settings?.layout?.sections || [],
  };

  const logoDataUri = await getImageDataUri(s.logoUrl);

  // 2. Define HTML Snippets
  const sectionHtml = {
    header: `
      <div class="header">
        <div>
          ${
            logoDataUri
              ? `<img src="${logoDataUri}" class="logo-img" />`
              : `<h2 style="color:${s.colors.primary}; margin:0; font-size: 28px;">${business.name}</h2>`
          }
        </div>
        <div class="title-wrapper">
          <h1 class="invoice-title">${s.labels.invoiceTitle || t.invoice}</h1>
          <div class="invoice-number"># ${invoice.invoiceNumber}</div>
        </div>
      </div>
    `,
    details: `
      <div class="details-container">
        <!-- FROM SECTION -->
        <div style="width: 45%">
          <span class="label">${s.labels.from || "FROM"}</span>
          <div class="company-name">${business.name}</div>
          <div class="address-text">
            ${formatAddress(business.address)}
            ${
              settings?.companyInfo?.matriculeFiscale
                ? `<br><br>MF: ${settings.companyInfo.matriculeFiscale}`
                : ""
            }
          </div>
        </div>

        <!-- TO SECTION -->
        <div style="width: 45%; text-align: right;">
          <span class="label">${s.labels.to || "BILL TO"}</span>
          <div class="company-name">${invoice.recipientName || "Unknown"}</div>
          <div class="address-text">
            ${invoice.recipientCompany ? `${invoice.recipientCompany}<br>` : ""}
            ${formatAddress(invoice.recipientAddress)}
            ${invoice.recipientEmail ? `<br>${invoice.recipientEmail}` : ""}
          </div>
        </div>
      </div>
      
      <!-- DATES -->
      <div class="dates-row">
        <div class="date-item"><span>DATE:</span> ${formatDate(
          invoice.issueDate
        )}</div>
        <div class="date-item"><span>DUE:</span> ${formatDate(
          invoice.dueDate
        )}</div>
      </div>
    `,
    items: `
      <table>
        <thead>
          <tr>
            ${
              s.table.columns?.description !== false
                ? `<th width="50%">${s.labels.item || "Description"}</th>`
                : ""
            }
            ${
              s.table.columns?.quantity !== false
                ? `<th width="10%" class="text-center">${
                    s.labels.quantity || "Qty"
                  }</th>`
                : ""
            }
            ${
              s.table.columns?.rate !== false
                ? `<th width="20%" class="text-right">${
                    s.labels.rate || "Price"
                  }</th>`
                : ""
            }
            ${
              s.table.columns?.total !== false
                ? `<th width="20%" class="text-right">${
                    s.labels.total || "Total"
                  }</th>`
                : ""
            }
          </tr>
        </thead>
        <tbody>
          ${invoice.items
            .map(
              (item, idx) => `
            <tr class="${s.table.striped && idx % 2 !== 0 ? "striped" : ""}">
              ${
                s.table.columns?.description !== false
                  ? `<td>${item.description}</td>`
                  : ""
              }
              ${
                s.table.columns?.quantity !== false
                  ? `<td class="text-center">${item.quantity}</td>`
                  : ""
              }
              ${
                s.table.columns?.rate !== false
                  ? `<td class="text-right">${formatCurrency(item.rate)}</td>`
                  : ""
              }
              ${
                s.table.columns?.total !== false
                  ? `<td class="text-right"><strong>${formatCurrency(
                      item.amount
                    )}</strong></td>`
                  : ""
              }
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `,
    totals: `
      <div class="totals-container">
        <div class="totals-box">
          <div class="totals-row"><span>${
            t.subtotal
          }:</span> <span>${formatCurrency(invoice.subtotal)}</span></div>
          ${
            invoice.taxAmount > 0
              ? `<div class="totals-row"><span>${t.tax} (${
                  invoice.taxRate
                }%):</span> <span>${formatCurrency(
                  invoice.taxAmount
                )}</span></div>`
              : ""
          }
          ${
            invoice.discount > 0
              ? `<div class="totals-row" style="color:#ef4444;"><span>Discount:</span> <span>-${formatCurrency(
                  invoice.discount
                )}</span></div>`
              : ""
          }
          <div class="totals-row grand-total"><span>${
            s.labels.total || "Total"
          }</span> <span>${formatCurrency(invoice.totalAmount)}</span></div>
        </div>
      </div>
    `,
    footer: `
      <div class="footer">
        ${
          s.labels.paymentInstructions || s.paymentTerms?.bankDetails
            ? `
          <div class="instructions-title">${
            s.labels.paymentInstructions || "Payment Instructions"
          }</div>
          <div class="instructions-text">${
            s.paymentTerms.bankDetails || ""
          }</div>
        `
            : ""
        }
      </div>
    `,
  };

  // 3. Construct Body based on Order
  const dynamicBodyContent = s.sections
    .filter((sec) => sec.visible)
    .sort((a, b) => a.order - b.order)
    .map((sec) => sectionHtml[sec.id] || "")
    .join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; font-size: ${
          s.fonts.size
        }px; color: ${
    s.colors.text
  }; line-height: 1.4; margin: 0; padding: 40px; }
        
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .logo-img { height: 80px; max-width: 200px; object-fit: contain; }
        .title-wrapper { text-align: right; }
        .invoice-title { font-size: 32px; font-weight: 800; color: ${
          s.colors.primary
        }; text-transform: uppercase; margin: 0; }
        .invoice-number { font-size: 14px; color: ${
          s.colors.secondary
        }; font-weight: 600; margin-top: 5px; }

        .details-container { display: flex; justify-content: space-between; margin-bottom: 30px; border-top: 1px solid #eee; padding-top: 20px; }
        .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${
          s.colors.secondary
        }; margin-bottom: 5px; display: block; }
        .company-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; color: #111; }
        .address-text { font-size: 11px; color: ${
          s.colors.secondary
        }; line-height: 1.5; white-space: pre-line; }

        .dates-row { margin-bottom: 30px; display: flex; gap: 40px; }
        .date-item span { font-weight: 700; color: ${
          s.colors.secondary
        }; margin-right: 8px; font-size: 11px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; margin-top: 20px; }
        th { background: ${
          s.table.headerColor || s.colors.primary
        }; color: #fff; padding: 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        th:first-child { border-top-left-radius: ${
          s.table.rounded ? "6px" : "0"
        }; }
        th:last-child { border-top-right-radius: ${
          s.table.rounded ? "6px" : "0"
        }; }
        td { padding: 10px; border-bottom: 1px solid #eee; font-size: 11px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        tr.striped { background-color: #F9FAFB; }

        .totals-container { display: flex; justify-content: flex-end; margin-bottom: 40px; page-break-inside: avoid; }
        .totals-box { width: 300px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 11px; }
        .grand-total { background: ${
          s.colors.primary
        }; color: white; padding: 10px; border-radius: 6px; margin-top: 10px; font-weight: 700; font-size: 14px; border: none; }

        .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #eee; page-break-inside: avoid; }
        .instructions-title { font-size: 10px; font-weight: 700; color: ${
          s.colors.secondary
        }; text-transform: uppercase; margin-bottom: 4px; }
        .instructions-text { font-size: 11px; color: ${
          s.colors.text
        }; white-space: pre-line; }
      </style>
    </head>
    <body>
      <div style="height: 10px; background: ${
        s.colors.primary
      }; position: absolute; top:0; left:0; width: 100%;"></div>
      ${dynamicBodyContent}
    </body>
    </html>
  `;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "40px", bottom: "40px", left: "40px", right: "40px" },
    });
    await browser.close();
    return pdfBuffer;
  } catch (err) {
    if (browser) await browser.close();
    throw new Error("PDF Gen Failed");
  }
};
