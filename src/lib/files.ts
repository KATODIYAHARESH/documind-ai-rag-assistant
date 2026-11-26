import { config } from "./config";
import { ApiError } from "./http";
import { formatBytes } from "./format";

const MAX_NAME_LENGTH = 200;

/** Strips paths and unsafe characters, keeps the .pdf extension. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document.pdf";
  const cleaned = base
    .normalize("NFKC")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  const withExt = /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned || "document"}.pdf`;
  return withExt;
}

export function cleanDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document.pdf";
  return base.replace(/[\u0000-\u001f]/g, "").slice(0, MAX_NAME_LENGTH);
}

/**
 * Validates an uploaded file on the backend: extension, MIME type, size and PDF magic bytes.
 */
export async function validatePdf(file: File): Promise<Buffer> {
  const label = `"${cleanDisplayName(file.name)}"`;
  if (!file.name || !/\.pdf$/i.test(file.name)) {
    throw new ApiError(400, `${label} is not a PDF. Only .pdf files are supported.`, "invalid_type");
  }
  if (file.type && file.type !== "application/pdf") {
    throw new ApiError(400, `${label} has an unsupported content type (${file.type}).`, "invalid_type");
  }
  if (file.size === 0) throw new ApiError(400, `${label} is empty.`, "empty_file");
  if (file.size > config.upload.maxBytes) {
    throw new ApiError(
      413,
      `${label} exceeds the ${formatBytes(config.upload.maxBytes)} upload limit.`,
      "too_large",
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ApiError(400, `${label} is not a valid PDF file.`, "invalid_pdf");
  }
  return buffer;
}
