import { writeFileSync } from "node:fs";
import { mkdir as mkdirAsync, writeFile as writeFileAsync } from "node:fs/promises";
import path from "node:path";
import { TICKET_OWNER_COLUMNS, toTicketOwnerWorkbookRows } from "./ticket-fields.mjs";

const WORKSHEET_NAME = "Ticket ownership";
const WORKBOOK_FILE_NAME = "Ticket ownership.xlsx";

export async function persistTicketOwnerStatisticsArtifacts(deps, result) {
  if (!deps?.artifactsDir) {
    throw new Error("ticket-owner-statistics artifact dependency is missing: artifactsDir");
  }
  if (!deps?.xlsx?.utils || typeof deps.xlsx.writeFile !== "function") {
    throw new Error("ticket-owner-statistics artifact dependency is missing: xlsx");
  }

  await mkdirAsync(deps.artifactsDir, { recursive: true });

  const runId = createRunId("ticket-owner-statistics");
  const resultJsonName = `${runId}-ticket-ownership.json`;
  const resultExcelName = `${runId}-ticket-ownership.xlsx`;
  const latestJsonName = "last-ticket-ownership.json";
  const latestExcelName = "last-ticket-ownership.xlsx";
  const resultJsonPath = path.join(deps.artifactsDir, resultJsonName);
  const resultExcelPath = path.join(deps.artifactsDir, resultExcelName);
  const latestResultJsonPath = path.join(deps.artifactsDir, latestJsonName);
  const latestResultExcelPath = path.join(deps.artifactsDir, latestExcelName);

  const payload = {
    ...result,
    generatedWorkbookName: WORKBOOK_FILE_NAME,
  };
  await writeFileAsync(resultJsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFileAsync(latestResultJsonPath, JSON.stringify(payload, null, 2), "utf8");
  writeTicketOwnerWorkbook(deps.xlsx, resultExcelPath, result.rows);
  writeTicketOwnerWorkbook(deps.xlsx, latestResultExcelPath, result.rows);

  return {
    runId,
    resultJsonPath,
    resultExcelPath,
    latestResultJsonPath,
    latestResultExcelPath,
    rowCount: Array.isArray(result.rows) ? result.rows.length : 0,
    workbookFileName: WORKBOOK_FILE_NAME,
    downloadUrls: {
      resultJsonUrl: `/artifacts/${resultJsonName}`,
      resultExcelUrl: `/artifacts/${resultExcelName}`,
      latestResultJsonUrl: `/artifacts/${latestJsonName}`,
      latestResultExcelUrl: `/artifacts/${latestExcelName}`,
    },
  };
}

export function writeTicketOwnerWorkbook(xlsx, outputXlsxPath, rows) {
  const workbookRows = toTicketOwnerWorkbookRows(rows);
  writeStyledTicketOwnerWorkbook(outputXlsxPath, workbookRows);
}

function writeStyledTicketOwnerWorkbook(outputXlsxPath, workbookRows) {
  const maxRow = Math.max(workbookRows.length + 1, 1);
  const tableRef = `A1:G${maxRow}`;
  const files = new Map([
    ["[Content_Types].xml", buildContentTypesXml()],
    ["_rels/.rels", buildRootRelsXml()],
    ["docProps/app.xml", buildAppXml()],
    ["docProps/core.xml", buildCoreXml()],
    ["xl/workbook.xml", buildWorkbookXml()],
    ["xl/_rels/workbook.xml.rels", buildWorkbookRelsXml()],
    ["xl/styles.xml", buildStylesXml()],
    ["xl/worksheets/sheet1.xml", buildWorksheetXml(workbookRows, tableRef)],
    ["xl/worksheets/_rels/sheet1.xml.rels", buildSheetRelsXml()],
    ["xl/tables/table1.xml", buildTableXml(tableRef)],
  ]);
  writeFileSync(outputXlsxPath, buildZip(files));
}

function buildWorksheetXml(rows, tableRef) {
  const allRows = [
    TICKET_OWNER_COLUMNS,
    ...rows.map((row) => TICKET_OWNER_COLUMNS.map((column) => row[column] ?? "")),
  ];
  const sheetRows = allRows.map((values, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const styleIndex = rowIndex === 0 ? 1 : (rowIndex % 2 === 1 ? 2 : 3);
    const cells = values.map((value, columnIndex) => {
      const cellRef = `${columnName(columnIndex + 1)}${rowNumber}`;
      return `<c r="${cellRef}" t="inlineStr" s="${styleIndex}"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowNumber}" spans="1:7">${cells}</row>`;
  }).join("");

  return xmlDocument(`
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${tableRef}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <selection activeCell="A1" sqref="A1"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>
    <col min="2" max="2" width="30" customWidth="1"/>
    <col min="3" max="3" width="34" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
    <col min="5" max="5" width="22" customWidth="1"/>
    <col min="6" max="6" width="16" customWidth="1"/>
    <col min="7" max="7" width="16" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="${tableRef}"/>
  <tableParts count="1"><tablePart r:id="rId1"/></tableParts>
</worksheet>`);
}

function buildTableXml(ref) {
  const tableColumns = TICKET_OWNER_COLUMNS.map((name, index) => (
    `<tableColumn id="${index + 1}" name="${xmlEscape(name)}"/>`
  )).join("");
  return xmlDocument(`
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="TicketOwnership" displayName="TicketOwnership" ref="${ref}" totalsRowShown="0">
  <autoFilter ref="${ref}"/>
  <tableColumns count="${TICKET_OWNER_COLUMNS.length}">${tableColumns}</tableColumns>
  <tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`);
}

function buildStylesXml() {
  return xmlDocument(`
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF5B9BD5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF000000"/></left>
      <right style="thin"><color rgb="FF000000"/></right>
      <top style="thin"><color rgb="FF000000"/></top>
      <bottom style="thin"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`);
}

function buildContentTypesXml() {
  return xmlDocument(`
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>
</Types>`);
}

function buildRootRelsXml() {
  return xmlDocument(`
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
}

function buildWorkbookRelsXml() {
  return xmlDocument(`
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
}

function buildSheetRelsXml() {
  return xmlDocument(`
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
</Relationships>`);
}

function buildWorkbookXml() {
  return xmlDocument(`
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="16000" windowHeight="9000"/></bookViews>
  <sheets><sheet name="${xmlEscape(WORKSHEET_NAME)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
}

function buildAppXml() {
  return xmlDocument(`
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>TOS Automation</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${xmlEscape(WORKSHEET_NAME)}</vt:lpstr></vt:vector></TitlesOfParts>
</Properties>`);
}

function buildCoreXml() {
  const now = new Date().toISOString();
  return xmlDocument(`
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>TOS Automation</dc:creator>
  <cp:lastModifiedBy>TOS Automation</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`);
}

function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function columnName(index) {
  let value = index;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function xmlDocument(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body.trim()}`;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createRunId(prefix) {
  const safePrefix = sanitizeFileSegment(prefix || "run");
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${safePrefix}-${Date.now().toString(36)}-${randomPart}`;
}

function sanitizeFileSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "run";
}
