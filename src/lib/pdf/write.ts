/**
 * Minimal text-only PDF writer used to generate the built-in sample documents.
 * Produces a valid PDF 1.4 file with Helvetica text that any PDF reader can open.
 */

const ESCAPES: Record<string, string> = { "\\": "\\\\", "(": "\\(", ")": "\\)" };

function pdfEscape(line: string): string {
  return line.replace(/[^\x20-\x7E]/g, " ").replace(/[\\()]/g, (c) => ESCAPES[c]);
}

export function createTextPdf(pages: string[][]): Buffer {
  const pageCount = pages.length;
  if (pageCount === 0) throw new Error("createTextPdf requires at least one page");
  const fontNum = 3 + pageCount * 2;
  const objects: string[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  pages.forEach((lines, i) => {
    const pageNum = 3 + i * 2;
    const contentNum = pageNum + 1;
    let content = "BT\n/F1 11 Tf\n16 TL\n72 740 Td\n";
    if (lines.length === 0) content += "( ) Tj\n";
    lines.forEach((line, li) => {
      content += `(${pdfEscape(line)}) Tj${li < lines.length - 1 ? " T*" : ""}\n`;
    });
    content += "ET\n";
    objects[pageNum] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNum} 0 R >>`;
    objects[contentNum] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`;
  });

  objects[fontNum] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = Buffer.byteLength(out, "latin1");
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(out, "latin1");
  const size = objects.length;
  out += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let n = 1; n < size; n++) out += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
