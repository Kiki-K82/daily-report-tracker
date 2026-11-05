// Builds the daily report PDF inside the app, so it looks the same on every device
import { jsPDF } from "jspdf";

// Colors (same as the app), as [red, green, blue]
const TEAL_DARK = [19, 78, 74];   // #134e4a
const SLATE_900 = [15, 23, 42];
const SLATE_700 = [51, 65, 85];
const SLATE_500 = [100, 116, 139];
const BORDER = [226, 232, 240];
const BOX = [248, 250, 252];

// US Letter page, measured in points (72 points = 1 inch)
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP_LATER_PAGES = 56;   // where content starts on pages 2+ (below the small header)
const BOTTOM = PAGE_H - 50;   // keep content clear of the page number

function toDisplayDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// Shrink a photo for the PDF and measure it, so the file stays small
function preparePhoto(url, maxSize = 1200, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // white background behind see-through images
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ data: canvas.toDataURL("image/jpeg", quality), w: canvas.width, h: canvas.height });
    };
    img.onerror = () => reject(new Error("Could not read photo"));
    img.src = url;
  });
}

export async function buildReportPdf({ report, project, profile }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const projectName = (project?.name || "").toUpperCase();
  let y = MARGIN; // current position down the page

  // Start a new page with the small header (pages 2+)
  const newPage = () => {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEAL_DARK);
    doc.text(`DAILY REPORT · ${projectName}`, MARGIN, 30);
    doc.setTextColor(...SLATE_900);
    doc.text(report.date, PAGE_W - MARGIN, 30, { align: "right" });
    y = TOP_LATER_PAGES;
  };

  // If something of this height won't fit, continue on a new page
  const ensureSpace = (height) => {
    if (y + height > BOTTOM) newPage();
  };

  // Section heading with a line under it
  const heading = (title) => {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...SLATE_900);
    doc.text(title, MARGIN, y);
    y += 6;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 18;
  };

  // ---------- Page 1 header ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...SLATE_900);
  doc.text("DAILY REPORT", MARGIN, y + 18);
  doc.setFontSize(11);
  doc.text(report.date, PAGE_W - MARGIN, y + 14, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(...TEAL_DARK);
  doc.text(projectName, MARGIN, y + 34);
  y += 46;
  doc.setDrawColor(...TEAL_DARK);
  doc.setLineWidth(1.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 18;

  // ---------- Info box ----------
  const items = [
    ["Contractor:", profile?.company],
    ["Prepared By:", report.prepBy || profile?.name],
    ["Weather:", report.weather],
    ["Project Code:", project?.code],
  ];
  if (project?.startDate) items.push(["Start Date:", toDisplayDate(project.startDate)]);
  if (project?.endDate) items.push(["End Date:", toDisplayDate(project.endDate)]);

  const rowH = 34;
  const boxH = Math.ceil(items.length / 2) * rowH + 16;
  doc.setFillColor(...BOX);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.75);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 8, 8, "FD");
  items.forEach(([label, value], i) => {
    const x = MARGIN + 16 + (i % 2) * (CONTENT_W / 2);
    const top = y + 22 + Math.floor(i / 2) * rowH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_500);
    doc.text(label, x, top);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...SLATE_900);
    doc.text(String(value || "-"), x, top + 13);
  });
  y += boxH + 28;

  // ---------- Field notes ----------
  heading("Field Notes");
  const lineH = 16;
  const notes = (report.bullets || "").split("\n").filter((l) => l.trim());
  for (const note of notes) {
    const text = note.replace(/^\s*•\s*/, "").trim();
    const wrapped = doc.splitTextToSize(text, CONTENT_W - 24);
    wrapped.forEach((part, i) => {
      ensureSpace(lineH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...SLATE_700);
      if (i === 0) doc.text("•", MARGIN + 6, y); // bullet only on the first line
      doc.text(part, MARGIN + 18, y);
      y += lineH;
    });
  }

  // ---------- Photos: 3 per row, never split across pages ----------
  const photos = report.photos || [];
  if (photos.length > 0) {
    y += 14;
    heading("Photo Documentation");
    const cols = 3;
    const gap = 12;
    const cellW = (CONTENT_W - gap * (cols - 1)) / cols;
    const imgH = 150;
    const cellH = imgH + 34;

    for (let i = 0; i < photos.length; i += cols) {
      ensureSpace(cellH); // the whole row must fit, or it moves to the next page
      const row = photos.slice(i, i + cols);
      for (let c = 0; c < row.length; c++) {
        const photo = row[c];
        const x = MARGIN + c * (cellW + gap);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.75);
        doc.roundedRect(x, y, cellW, cellH, 6, 6, "FD");

        if (photo.url) {
          try {
            const img = await preparePhoto(photo.url);
            const boxW = cellW - 12;
            const scale = Math.min(boxW / img.w, imgH / img.h); // fit the whole photo, no cropping
            const w = img.w * scale;
            const h = img.h * scale;
            doc.addImage(img.data, "JPEG", x + 6 + (boxW - w) / 2, y + 6 + (imgH - h) / 2, w, h);
          } catch (err) {
            console.error(err);
          }
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...SLATE_900);
        const caption = doc.splitTextToSize(photo.caption || "", cellW - 12)[0] || "";
        doc.text(caption, x + cellW / 2, y + imgH + 22, { align: "center" });
      }
      y += cellH + gap;
    }
  }

  // ---------- Page numbers on every page ----------
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_500);
    doc.text(`Page ${p} of ${total}`, PAGE_W / 2, PAGE_H - 24, { align: "center" });
  }

  return doc.output("blob");
}