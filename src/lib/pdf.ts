import { createRequire } from "module";

type PDFResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function extractPDFText(buffer: Buffer): Promise<PDFResult> {
  try {
    // pdf-parse v1 uses CommonJS and expects a default function export.
    // Turbopack/Next.js ESM bundling can break `require`, so we use
    // Node's native createRequire to load it reliably.
    // pdf-parse v1's index.js tries to read a test PDF on require().
    // Import the actual library file directly to bypass that.
    const require = createRequire(import.meta.url);
    const pdfParse = require("pdf-parse/lib/pdf-parse");
    const data = await pdfParse(buffer);
    return { ok: true, text: data.text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[pdf] extraction failed:", msg);
    return { ok: false, error: `Failed to parse PDF: ${msg}` };
  }
}
