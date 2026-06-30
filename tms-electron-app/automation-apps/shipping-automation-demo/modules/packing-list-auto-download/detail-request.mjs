import { writeFile } from "node:fs/promises";

const PACKING_MANIFEST_PDF_WAIT_MS = 30000;

export async function downloadPackingManifestPdfByDetailRequest(options) {
  const {
    context,
    detailUrl,
    fileName,
    filePath,
    linkInfo = null,
    referer = "",
  } = options;
  const detailRequestResult = await resolvePackingManifestPdfUrlFromDetailRequest({
    context,
    detailUrl,
    referer,
  });
  if (!detailRequestResult?.pdfUrl) {
    return null;
  }

  const requestFetchResult = await fetchAndSavePackingManifestPdfUrl({
    context,
    fileName,
    filePath,
    pdfUrl: detailRequestResult.pdfUrl,
    referer: detailRequestResult.detailUrl || detailUrl,
    source: "packing-manifest-detail-request",
  });
  if (!requestFetchResult) {
    return null;
  }

  return {
    ...requestFetchResult,
    detailUrl: detailRequestResult.detailUrl || detailUrl,
    detailSource: detailRequestResult.source,
    linkInfo,
  };
}

async function resolvePackingManifestPdfUrlFromDetailRequest(options) {
  const {
    context,
    detailUrl,
    referer = "",
  } = options;
  const absoluteDetailUrl = String(detailUrl || "").trim();
  if (!absoluteDetailUrl) {
    return null;
  }

  const response = await context.request.get(absoluteDetailUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(referer ? { Referer: referer } : {}),
    },
    timeout: Math.min(PACKING_MANIFEST_PDF_WAIT_MS, 12000),
  }).catch(() => null);
  if (!response || !response.ok()) {
    return null;
  }

  const html = await response.text().catch(() => "");
  const pdfUrl = extractPackingManifestPdfUrlFromDetailHtml(html, response.url());
  if (!pdfUrl) {
    return null;
  }
  return {
    detailUrl: response.url() || absoluteDetailUrl,
    pdfUrl,
    source: "page-resolver-html",
  };
}

function extractPackingManifestPdfUrlFromDetailHtml(html, baseUrl) {
  const variants = [
    String(html || ""),
    htmlDecode(String(html || "")),
    safeDecodeURIComponent(String(html || "")),
    htmlDecode(safeDecodeURIComponent(String(html || ""))),
  ].filter(Boolean);

  for (const text of variants) {
    const directUrlMatch = text.match(/PackingManifestPDF\.jsp\?[^"'<>\\\s]*/i);
    if (directUrlMatch?.[0]) {
      return new URL(cleanExtractedHref(directUrlMatch[0]), baseUrl).toString();
    }

    const documentPdfMatch = text.match(/loadDocumentPDF\s*\(\s*["']PackingManifest["']\s*,\s*["']?(\d{6,})["']?\s*\)/i);
    if (documentPdfMatch?.[1]) {
      return new URL(
        `PackingManifestPDF.jsp?key=${documentPdfMatch[1]}&OrderAssignment=&OrderAssignmentTYPE=`,
        baseUrl,
      ).toString();
    }
  }
  return "";
}

async function fetchAndSavePackingManifestPdfUrl(options) {
  const {
    context,
    fileName,
    filePath,
    pdfUrl,
    referer = "",
    source,
  } = options;
  const response = await context.request.get(pdfUrl, {
    headers: {
      Accept: "application/pdf,application/octet-stream,*/*",
      ...(referer ? { Referer: referer } : {}),
    },
    timeout: PACKING_MANIFEST_PDF_WAIT_MS,
  }).catch(() => null);
  if (!response) {
    return null;
  }
  const buffer = await response.body();
  if (!isPdfBuffer(buffer)) {
    return null;
  }
  await writeFile(filePath, buffer);
  return {
    fileName,
    filePath,
    downloadSource: source,
    pdfUrl,
    size: buffer.length,
  };
}

function isPdfBuffer(buffer) {
  return Buffer.from(buffer || []).subarray(0, 4).toString("utf8") === "%PDF";
}

function cleanExtractedHref(value) {
  return htmlDecode(String(value || ""))
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, "\"")
    .replace(/\\'/g, "'")
    .trim()
    .replace(/\\+$/g, "")
    .replace(/["']+$/g, "")
    .trim();
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
