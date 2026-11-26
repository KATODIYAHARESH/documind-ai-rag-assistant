import { extractText, getDocumentProxy } from "unpdf";
import { ApiError } from "../http";

export interface ExtractedPdf {
  pages: string[];
  totalPages: number;
  totalChars: number;
}

/** Extracts text page by page with pdf.js (via unpdf), preserving page boundaries. */
export async function extractPdfText(data: Uint8Array): Promise<ExtractedPdf> {
  try {
    const pdf = await getDocumentProxy(data);
    const result = await extractText(pdf, { mergePages: false });
    const raw = (result as { text: string | string[] }).text;
    const pages = (Array.isArray(raw) ? raw : [raw]).map((p) => (typeof p === "string" ? p : ""));
    const totalChars = pages.reduce((n, p) => n + p.trim().length, 0);
    return { pages, totalPages: result.totalPages ?? pages.length, totalChars };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "PasswordException") {
      throw new ApiError(422, "This PDF is password-protected and cannot be processed.", "pdf_protected");
    }
    throw new ApiError(
      422,
      "This PDF could not be read. It may be corrupted or use an unsupported structure.",
      "pdf_unreadable",
    );
  }
}
