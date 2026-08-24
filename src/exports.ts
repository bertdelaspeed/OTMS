import type { CellHookData } from "jspdf-autotable";
import type { EventKind, Person, StatusKey } from "./types";
import { toISO, todayISO } from "./dates";

/* Heavy libraries (xlsx, jspdf) are loaded on demand so the app opens instantly. */

/* ================= Excel template ================= */

export async function downloadPeopleTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const header = ["Name *", "Role", "Email", "Phone", "Joined (YYYY-MM-DD)", "Teams (; separated)"];
  const rows = [
    ["Awa Cissé", "Office assistant", "awa.cisse@company.co", "+221 77 555 01 02", "2025-03-10", "Back Office; Field Ops"],
    ["Karim Haddad", "Archivist", "karim.haddad@company.co", "+212 661 22 33 44", "2024-11-02", "Back Office"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 30 }];

  const ws2 = XLSX.utils.aoa_to_sheet([
    ["ROLLCALL — PEOPLE IMPORT / IMPORT DE PERSONNEL"],
    [""],
    ["EN"],
    ["• One person per row. Only the Name column is required."],
    ["• Joined accepts YYYY-MM-DD, DD/MM/YYYY or an Excel date cell."],
    ["• Teams: separate several team names with ; or ,  — they must already exist in the app."],
    ["• Headers are flexible: English or French, accents and upper/lower case are ignored."],
    ["• Delete the sample rows before importing (they would create Awa and Karim)."],
    [""],
    ["FR"],
    ["• Une personne par ligne. Seule la colonne Name (Nom) est obligatoire."],
    ["• La date d’entrée accepte AAAA-MM-JJ, JJ/MM/AAAA ou une cellule de date Excel."],
    ["• Équipes : séparez plusieurs noms par ; ou , — elles doivent déjà exister dans l’application."],
    ["• Les en-têtes sont flexibles : français ou anglais, accents et casse ignorés."],
    ["• Supprimez les lignes d’exemple avant l’import (sinon Awa et Karim seront créés)."],
  ]);
  ws2["!cols"] = [{ wch: 96 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "People");
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions");
  XLSX.writeFile(wb, "rollcall-people-template.xlsx");
}

/* ================= Excel parsing ================= */

export interface ParsedRow {
  name: string;
  role: string;
  email: string;
  phone: string;
  joinedAt: string | null;
  teamNames: string[];
  /** line number in the sheet (header = 1) */
  sheetRow: number;
}

export type ImportWarning =
  | { kind: "noName"; row: number }
  | { kind: "badDate"; row: number }
  | { kind: "unknownTeam"; row: number; team: string }
  | { kind: "dupInFile"; row: number; name: string };

const normHeader = (s: string) =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

const HEADER_MAP: Record<string, string[]> = {
  name: ["name", "fullname", "employeename", "employe", "agent", "nom", "nomcomplet"],
  role: ["role", "position", "jobtitle", "job", "title", "poste", "fonction", "titre"],
  email: ["email", "emailaddress", "mail", "courriel"],
  phone: ["phone", "telephone", "tel", "mobile", "portable", "numero"],
  joined: [
    "joined",
    "joinedat",
    "joindate",
    "startdate",
    "hiredate",
    "hiredon",
    "embauche",
    "datedembauche",
    "dateembauche",
    "entree",
    "dateentree",
    "datedentree",
  ],
  teams: ["teams", "team", "equipes", "equipe", "groupes", "groupe", "services", "service"],
};

function parseDateValue(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return toISO(v);
  if (typeof v === "number" && isFinite(v)) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d.getTime()) ? null : toISO(d);
  }
  if (typeof v === "string") {
    const s = v.trim();
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      const m = +iso[2];
      const d = +iso[3];
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31)
        return `${iso[1]}-${`${m}`.padStart(2, "0")}-${`${d}`.padStart(2, "0")}`;
      return null;
    }
    const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
    if (dmy) {
      let a = +dmy[1];
      let b = +dmy[2];
      let y = +dmy[3];
      if (y < 100) y += 2000;
      if (a > 12 && b <= 12) [a, b] = [b, a]; // assume DD/MM, flip if needed
      if (a >= 1 && a <= 12 && b >= 1 && b <= 31)
        return `${y}-${`${a}`.padStart(2, "0")}-${`${b}`.padStart(2, "0")}`;
      return null;
    }
  }
  return null;
}

export async function parsePeopleExcel(
  file: File
): Promise<{ rows: ParsedRow[]; warnings: ImportWarning[] }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("empty workbook");
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const colFor: Record<string, string | undefined> = {};
  for (const key of Object.keys(HEADER_MAP)) {
    colFor[key] = Object.keys(raw[0] ?? {}).find((h) => HEADER_MAP[key].includes(normHeader(h)));
  }
  // no header match for name at all → maybe there are no headers? Require at least a name column.
  if (!colFor.name) throw new Error("no name column");

  const rows: ParsedRow[] = [];
  const warnings: ImportWarning[] = [];
  const seen = new Set<string>();

  raw.forEach((r, i) => {
    const sheetRow = i + 2;
    const get = (k: string) => (colFor[k] ? String(r[colFor[k]!] ?? "").trim() : "");
    const name = get("name");
    if (!name) {
      // skip fully empty rows silently
      const allEmpty = Object.values(r).every((v) => String(v).trim() === "");
      if (!allEmpty) warnings.push({ kind: "noName", row: sheetRow });
      return;
    }
    const joinedRaw = colFor.joined ? r[colFor.joined] : "";
    const joinedAt = joinedRaw === "" ? null : parseDateValue(joinedRaw);
    if (joinedRaw !== "" && joinedAt === null) warnings.push({ kind: "badDate", row: sheetRow });

    const teamNames = get("teams")
      .split(/[;,|]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const key = name.toLowerCase();
    if (seen.has(key)) warnings.push({ kind: "dupInFile", row: sheetRow, name });
    seen.add(key);

    rows.push({
      name,
      role: get("role"),
      email: get("email"),
      phone: get("phone"),
      joinedAt,
      teamNames,
      sheetRow,
    });
  });

  return { rows, warnings };
}

/* ================= PDF record ================= */

type RGB = [number, number, number];

const PAPER: RGB = [252, 253, 251];
const INK: RGB = [27, 38, 31];
const MUT: RGB = [104, 121, 109];
const BAND: RGB = [17, 26, 20];
const MINT: RGB = [111, 207, 151];
const LINE: RGB = [222, 228, 222];

const KIND_PDF_COLOR: Record<EventKind, RGB> = {
  commendation: [176, 119, 30],
  misconduct: [196, 74, 58],
  absence: [190, 72, 110],
  sick: [20, 140, 140],
  leave: [45, 110, 180],
  permission: [150, 90, 170],
  task: [22, 128, 77],
  observation: [110, 130, 110],
};

const STATUS_PDF_COLOR: Record<StatusKey, RGB> = {
  available: [22, 128, 77],
  "on-task": [176, 119, 30],
  errand: [150, 90, 170],
  absent: [190, 72, 110],
  sick: [20, 140, 140],
  leave: [45, 110, 180],
};

export interface PdfSummaryRow {
  label: string;
  entries: number;
  days: number | null;
}

export interface PdfEventRow {
  date: string;
  kind: EventKind;
  typeLabel: string;
  title: string;
  note: string;
}

export interface PdfLabels {
  brand: string;
  title: string;
  generated: string;
  contact: string;
  position: string;
  history: string;
  role: string;
  teams: string;
  joined: string;
  tenure: string;
  email: string;
  phone: string;
  none: string;
  summary: string;
  events: string;
  category: string;
  entries: string;
  days: string;
  date: string;
  type: string;
  description: string;
  note: string;
  page: (a: number, b: number) => string;
}

export async function exportPersonPdf(input: {
  person: Person;
  statusLabel: string;
  status: StatusKey;
  teamNames: string[];
  joinedText: string;
  tenureText: string;
  summary: PdfSummaryRow[];
  events: PdfEventRow[];
  labels: PdfLabels;
}): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { person, labels } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = 595.28;
  const M = 42;

  doc.setFillColor(...PAPER);
  doc.rect(0, 0, W, 841.89, "F");

  /* header band */
  doc.setFillColor(...BAND);
  doc.rect(0, 0, W, 92, "F");
  doc.setFillColor(...MINT);
  doc.rect(0, 92, W, 3, "F");
  doc.setTextColor(...MINT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(labels.brand.toUpperCase(), M, 40, { charSpace: 2.2 });
  doc.setTextColor(168, 185, 172);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(labels.title.toUpperCase(), M, 58, { charSpace: 1.6 });
  doc.setFontSize(8.5);
  doc.text(labels.generated, W - M, 40, { align: "right" });

  /* name + status */
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.text(person.name, M, 136);

  const statusColor = STATUS_PDF_COLOR[input.status];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const sw = doc.getTextWidth(input.statusLabel.toUpperCase()) + 22;
  doc.setDrawColor(...statusColor);
  doc.setTextColor(...statusColor);
  doc.setLineWidth(1);
  doc.roundedRect(M, 148, sw, 20, 10, 10, "S");
  doc.text(input.statusLabel.toUpperCase(), M + 11, 161, { charSpace: 0.8 });

  /* meta block */
  const metaY = 196;
  const col = (x: number, title: string, lines: [string, string][]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUT);
    doc.text(title.toUpperCase(), x, metaY, { charSpace: 1.4 });
    let y = metaY + 16;
    lines.forEach(([k, v]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUT);
      doc.text(k.toUpperCase(), x, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(v || "—", x, y + 12);
      y += 36;
    });
  };
  col(M, labels.contact, [
    [labels.email, person.email],
    [labels.phone, person.phone],
  ]);
  col(230, labels.position, [
    [labels.role, person.role],
    [labels.teams, input.teamNames.join(", ") || labels.none],
  ]);
  col(415, labels.history, [
    [labels.joined, input.joinedText],
    [labels.tenure, input.tenureText],
  ]);

  doc.setDrawColor(...LINE);
  doc.setLineWidth(1);
  doc.line(M, 268, W - M, 268);

  /* summary table */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(labels.summary, M, 292);

  autoTable(doc, {
    startY: 302,
    margin: { left: M, right: M },
    head: [[labels.category, labels.entries, labels.days]],
    body: input.summary.map((s) => [s.label, String(s.entries), s.days === null ? "—" : String(s.days)]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6.5,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.6,
    },
    headStyles: { fillColor: BAND, textColor: [233, 240, 232], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [244, 247, 243] },
    columnStyles: { 1: { halign: "center", cellWidth: 70 }, 2: { halign: "center", cellWidth: 70 } },
  });

  /* events table */
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  if (y > 700) {
    doc.addPage();
    doc.setFillColor(...PAPER);
    doc.rect(0, 0, W, 841.89, "F");
    y = 60;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(labels.events, M, y);

  autoTable(doc, {
    startY: y + 10,
    margin: { left: M, right: M },
    head: [[labels.date, labels.type, labels.description, labels.note]],
    body: input.events.map((e) => [e.date, e.typeLabel, e.title, e.note || "—"]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 6,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.6,
      valign: "top",
    },
    headStyles: { fillColor: BAND, textColor: [233, 240, 232], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [244, 247, 243] },
    columnStyles: {
      0: { cellWidth: 92 },
      1: { cellWidth: 78, fontStyle: "bold" },
      2: { cellWidth: 175 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const ev = input.events[data.row.index];
        if (ev) data.cell.styles.textColor = KIND_PDF_COLOR[ev.kind];
      }
    },
  });

  /* footer on every page */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(M, 806, W - M, 806);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUT);
    doc.text(`${labels.brand} · ${person.name}`, M, 820);
    doc.text(labels.page(i, pages), W - M, 820, { align: "right" });
  }

  const slug = person.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`rollcall-${slug}-${todayISO()}.pdf`);
}
