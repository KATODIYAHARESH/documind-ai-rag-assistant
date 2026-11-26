import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { createTextPdf } from "./pdf/write";

interface SampleDocument {
  name: string;
  pages: string[][];
}

const WIDTH = 92;
const LINES_PER_PAGE = 38;

function wrap(text: string, width = WIDTH): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + (line ? " " : "") + word).length > width) {
      lines.push(line);
      line = word;
    } else {
      line += (line ? " " : "") + word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function paginate(title: string, paragraphs: string[]): string[][] {
  const lines: string[] = [title.toUpperCase(), ""];
  for (const paragraph of paragraphs) {
    lines.push(...wrap(paragraph), "");
  }
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
  return pages;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    name: "Atlas Platform - Technical Overview.pdf",
    pages: paginate("Atlas Platform - Technical Overview", [
      "Nova Robotics, Inc. Internal engineering document, March 2025. Prepared by the Atlas platform team.",
      "Atlas is the document intelligence platform built by Nova Robotics. It ingests PDF documents, extracts their text, and makes the content searchable through natural-language questions.",
      "The backend is written in Python 3.12 and exposes a REST API built with FastAPI 0.115. Application metadata, users, and conversation history are stored in PostgreSQL 16. Redis 7.2 is used for rate limiting and short-lived caching.",
      "Vector storage uses ChromaDB 0.5 with a persistent storage directory mounted on the application server. Each document chunk is stored together with its document identifier, page number, filename, and chunk identifier so that answers can be traced back to the exact page.",
      "Text is extracted with PyMuPDF 1.24 page by page. Each page is split into chunks of approximately 500 tokens with a 100-token overlap. The embedding model is sentence-transformers/all-MiniLM-L6-v2, which produces 384-dimensional vectors.",
      "RETRIEVAL AND GENERATION",
      "When a question is received, Atlas embeds the query, searches ChromaDB for the five most similar chunks, and keeps only chunks above the similarity threshold of 0.35. The retrieved chunks are inserted into the prompt as numbered context blocks.",
      "Answer generation uses an OpenAI-compatible chat completions API. The model is instructed to answer strictly from the retrieved context and to cite the context blocks it used. If nothing relevant is retrieved, the assistant replies that the information could not be found in the uploaded documents instead of guessing.",
      "Users can restrict retrieval to a selected set of documents. Deleting a document removes its rows from PostgreSQL as well as its vectors from ChromaDB.",
      "OPERATIONS",
      "Atlas runs on AWS in the eu-west-1 region behind an Application Load Balancer. The production deployment consists of two API instances, one worker instance for document ingestion, and a managed PostgreSQL database.",
      "The availability target is 99.9 percent per month. Nightly database backups are retained for 30 days. Uploaded files are encrypted at rest with AES-256.",
      "The engineering team is led by Dr. Amara Chen. The platform reached general availability on March 12, 2025. Enterprise customers receive 24/7 dedicated support; the details are described in the Pricing and Plans document.",
    ]),
  },
  {
    name: "Atlas Platform - Pricing and Plans.pdf",
    pages: paginate("Atlas Platform - Pricing and Plans", [
      "Atlas is available in three plans. Starter costs $29 per month and includes 1,000 indexed pages, 2 seats, and email support with a 48-hour response time.",
      "Growth costs $99 per month and includes 10,000 indexed pages, 10 seats, API access, and priority support with an 8-hour response time.",
      "Enterprise pricing is custom and includes unlimited pages, dedicated infrastructure options, a dedicated success manager, and 24/7 support covered by a 99.9 percent uptime SLA.",
      "All plans can be billed annually with a 20 percent discount. A 14-day free trial is available for the Starter and Growth plans without a credit card.",
      "Overage pages are billed at $0.01 per page. Documents that cannot be processed, for example scanned PDFs without OCR, do not count toward the page quota.",
      "Purchases are handled through a secure checkout. Invoices are issued at the start of each billing cycle and can be downloaded from the billing portal.",
    ]),
  },
  {
    name: "Orion Research - Q3 2025 Quarterly Report.pdf",
    pages: paginate("Orion Research - Q3 2025 Quarterly Report", [
      "Orion Research closed the third quarter of 2025 with revenue of $4.2 million, an increase of 18 percent compared to the previous quarter and 61 percent year over year.",
      "Gross margin was 74 percent. Customer churn decreased to 3.1 percent, and the net promoter score improved to 47.",
      "Headcount grew to 38 people, with the largest additions in the infrastructure and customer success teams.",
      "Infrastructure costs rose 22 percent sequentially, driven by embedding compute and vector storage growth. Management expects this trend to continue as ingestion volume increases.",
      "Roadmap priorities for the next two quarters are the OCR module for scanned documents planned for Q1 2026, EU data residency, and a public API for retrieval.",
    ]),
  },
];

export interface SampleResult {
  created: string[];
  skipped: string[];
}

/** Generates the built-in sample PDFs and queues them for indexing for the given user. */
export async function createSampleDocuments(userId: string, queue: (documentId: string) => void): Promise<SampleResult> {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const sample of SAMPLE_DOCUMENTS) {
    const buffer = createTextPdf(sample.pages);
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.fileHash, fileHash)))
      .limit(1);
    if (existing) {
      skipped.push(sample.name);
      continue;
    }
    const [inserted] = await db
      .insert(documents)
      .values({
        userId,
        filename: sample.name.replace(/[^A-Za-z0-9._-]+/g, "_"),
        originalName: sample.name,
        sizeBytes: buffer.length,
        mimeType: "application/pdf",
        fileHash,
        status: "processing",
        statusMessage: "Queued for processing",
        fileData: buffer,
      })
      .returning({ id: documents.id });
    created.push(inserted.id);
    queue(inserted.id);
  }
  return { created, skipped };
}
