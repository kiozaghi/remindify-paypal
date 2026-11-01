import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export const MAX_PDF_PAGES = 30;

// Reads a text-based PDF in the browser. The file never leaves the device;
// only the extracted text is sent anywhere.
export async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const document = await loadingTask.promise;
  const pages = document.numPages;
  const readablePages = Math.min(pages, MAX_PDF_PAGES);
  const parts: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= readablePages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      parts.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" "),
      );
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return {
    pages,
    text: parts.join("\n\n").replace(/[ \t]+/g, " ").trim(),
  };
}
