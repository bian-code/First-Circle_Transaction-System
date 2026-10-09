/**
 * exportUtils.js
 *
 * Zero-dependency export helpers that work entirely in the browser.
 * Both functions accept a rows array and a filename (without extension)
 * and trigger a file download.
 *
 * Excel (.xlsx) formatting features:
 *  - Header row: indigo fill (#4F46E5), white bold text, centered, taller row (20pt)
 *  - Column widths: auto-sized to the longest value in each column
 *  - All cells: thin borders on every side
 *  - Data rows: alternating white / light-grey banding for readability
 *  - Amount column: right-aligned, "#,##0.00" number format
 *  - Status column: color-coded (Settled green / Pending amber / Failed red)
 *  - First row frozen so the header stays visible while scrolling
 */

// ─── Shared ───────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'transactionDate',   header: 'Transaction Date',    align: 'left'   },
  { key: 'accountNumber',     header: 'Account Number',      align: 'left'   },
  { key: 'accountHolderName', header: 'Account Holder Name', align: 'left'   },
  { key: 'amount',            header: 'Amount',              align: 'right'  },
  { key: 'status',            header: 'Status',              align: 'center' },
]

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

/**
 * Escapes a cell value for RFC 4180 CSV:
 * wraps in quotes if the value contains a comma, quote, or newline.
 */
function csvCell(value) {
  const str = value == null ? '' : String(value)
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function exportCsv(rows, filename = 'transactions') {
  const header = COLUMNS.map((c) => csvCell(c.header)).join(',')
  const body   = rows.map((row) =>
    COLUMNS.map((c) => csvCell(row[c.key])).join(',')
  )
  const csv  = [header, ...body].join('\r\n')
  // \uFEFF = UTF-8 BOM — makes Excel / Numbers open the file with the correct encoding
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${filename}.csv`)
}

// ─── Excel (.xlsx) ────────────────────────────────────────────────────────────
//
// An .xlsx file is a ZIP archive containing a handful of XML files.
// This implementation writes the ZIP manually using the DEFLATE-free
// "stored" method (compression type 0), which is fully valid and keeps
// this code dependency-free.
//
// Structure produced:
//   [Content_Types].xml
//   _rels/.rels
//   xl/workbook.xml
//   xl/_rels/workbook.xml.rels
//   xl/worksheets/sheet1.xml
//   xl/sharedStrings.xml
//   xl/styles.xml

// ── XML helpers ──────────────────────────────────────────────────────────────

function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Shared string table ───────────────────────────────────────────────────────

function buildSharedStrings(rows) {
  const index = new Map()
  const list  = []

  const intern = (val) => {
    const s = String(val == null ? '' : val)
    if (!index.has(s)) { index.set(s, list.length); list.push(s) }
    return index.get(s)
  }

  // Header row
  COLUMNS.forEach((c) => intern(c.header))
  // Data rows — numbers are written as numeric cells; only strings go in the table
  rows.forEach((row) => COLUMNS.forEach((c) => {
    if (c.key !== 'amount') intern(row[c.key])
  }))

  return { index, list }
}

// ── Cell address (0-based col, 0-based row → "A1" etc.) ──────────────────────

function cellAddr(col, row) {
  let c = ''
  let n = col
  do { c = String.fromCharCode(65 + (n % 26)) + c; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return `${c}${row + 1}`
}

// ── Column widths (auto-fit to the longest value in each column) ─────────────
//
// SpreadsheetML "width" is in character units of the default font.
// We measure each column's longest rendered string (header included)
// and add a small padding so text never clips.

const MIN_COL_WIDTH   = 10
const MAX_COL_WIDTH   = 50
const COL_WIDTH_PAD   = 3   // extra chars added on top of the measured length

function displayLength(key, val) {
  if (val == null || val === '') return 0
  if (key === 'amount') {
    const n = parseFloat(val)
    if (isNaN(n)) return 0
    // Simulate the "#,##0.00" format that Excel will render
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',').length
  }
  return String(val).length
}

function computeColumnWidths(rows) {
  return COLUMNS.map((c) => {
    const maxDataLen = rows.reduce(
      (max, row) => Math.max(max, displayLength(c.key, row[c.key])),
      0
    )
    const longest = Math.max(c.header.length, maxDataLen)
    return Math.min(Math.max(longest + COL_WIDTH_PAD, MIN_COL_WIDTH), MAX_COL_WIDTH)
  })
}

function buildCols(widths) {
  return `<cols>${widths.map((w, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${w}" bestFit="1" customWidth="1"/>`
  ).join('')}</cols>`
}

// ── Style indices ─────────────────────────────────────────────────────────────
//
// cellXfs entries (defined in STYLES below) — keep in sync:
//
//  0  default          — General, no border, left-align
//  1  amount-data      — "#,##0.00", thin border, right-align, white bg
//  2  header-left      — bold white on indigo, thin border, left-align
//  3  header-center    — bold white on indigo, thin border, center-align
//  4  header-right     — bold white on indigo, thin border, right-align
//  5  data-left-white  — thin border, left-align,  white fill (odd rows)
//  6  data-left-grey   — thin border, left-align,  grey  fill (even rows)
//  7  data-right-white — thin border, right-align, white fill (odd rows) — reserved
//  8  data-right-grey  — thin border, right-align, grey  fill (even rows) — reserved
//  9  status-settled-white — Settled green, thin border, center, white row
// 10  status-settled-grey  — Settled green, thin border, center, grey row
// 11  status-pending-white — Pending amber, thin border, center, white row
// 12  status-pending-grey  — Pending amber, thin border, center, grey row
// 13  status-failed-white  — Failed red,  thin border, center, white row
// 14  status-failed-grey   — Failed red,  thin border, center, grey row
// 15  amount-data-grey     — "#,##0.00", thin border, right-align, grey bg

const HEADER_STYLE_BY_ALIGN = { left: 2, center: 3, right: 4 }

// Returns the style index for a plain data cell based on alignment and row parity
function dataStyleIdx(align, isEvenRow) {
  if (align === 'right') return isEvenRow ? 8 : 7
  return isEvenRow ? 6 : 5
}

// Returns the style index for the Amount cell based on row parity
function amountStyleIdx(isEvenRow) { return isEvenRow ? 15 : 1 }

// Returns the style index for a Status cell based on value and row parity
const STATUS_STYLE_BASE = { Settled: 9, Pending: 11, Failed: 13 }
function statusStyleIdx(status, isEvenRow) {
  const base = STATUS_STYLE_BASE[status] ?? 5
  return isEvenRow ? base + 1 : base
}

// ── Sheet XML ─────────────────────────────────────────────────────────────────

function buildSheet(rows, ssIndex, colWidths) {
  const strCell = (col, rowIdx, val, styleIdx) => {
    const idx = ssIndex.get(String(val == null ? '' : val)) ?? 0
    const s = styleIdx != null ? ` s="${styleIdx}"` : ''
    return `<c r="${cellAddr(col, rowIdx)}" t="s"${s}><v>${idx}</v></c>`
  }

  const numCell = (col, rowIdx, val, styleIdx) => {
    const n = parseFloat(val)
    const s = styleIdx != null ? ` s="${styleIdx}"` : ''
    return `<c r="${cellAddr(col, rowIdx)}"${s}><v>${isNaN(n) ? 0 : n}</v></c>`
  }

  // Header row — row height 20pt, style driven by column alignment
  const headerCells = COLUMNS.map((c, ci) =>
    strCell(ci, 0, c.header, HEADER_STYLE_BY_ALIGN[c.align] ?? 2)
  ).join('')
  const headerRow = `<row r="1" ht="20" customHeight="1">${headerCells}</row>`

  // Data rows — 1-indexed in Excel (rowIdx starts at 1)
  const dataRows = rows.map((row, ri) => {
    const rowIdx   = ri + 1          // 0-based internal index (Excel row = rowIdx + 1)
    const isEven   = ri % 2 === 1    // alternate banding: row 1 (ri=0) white, row 2 (ri=1) grey…

    const cells = COLUMNS.map((c, ci) => {
      if (c.key === 'amount') {
        return numCell(ci, rowIdx, row[c.key], amountStyleIdx(isEven))
      }
      if (c.key === 'status') {
        return strCell(ci, rowIdx, row[c.key], statusStyleIdx(row[c.key], isEven))
      }
      return strCell(ci, rowIdx, row[c.key], dataStyleIdx(c.align, isEven))
    }).join('')

    return `<row r="${rowIdx + 1}">${cells}</row>`
  }).join('')

  // Freeze the first row: pane splits at row 1, bottom-left pane is active
  const freezePane = `<sheetViews>
<sheetView tabSelected="1" workbookViewId="0">
<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
<selection pane="bottomLeft"/>
</sheetView>
</sheetViews>`

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${freezePane}
${buildCols(colWidths)}
<sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`
}

// ── Static XML parts ──────────────────────────────────────────────────────────

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml"  ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml"            ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml"   ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml"       ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml"              ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Transactions" sheetId="1" r:id="rId1"/></sheets>
</workbook>`

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"     Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"        Target="styles.xml"/>
</Relationships>`

// ── Styles ────────────────────────────────────────────────────────────────────
//
// Font indices:
//  0  Calibri 11, default
//  1  Calibri 11, bold, white (#FFFFFF)  — header
//  2  Calibri 11, #065F46 (Settled)
//  3  Calibri 11, #92400E (Pending)
//  4  Calibri 11, #991B1B (Failed)
//
// Fill indices (first two are required by the spec):
//  0  none
//  1  gray125 (required)
//  2  indigo  #4F46E5 — header
//  3  #D1FAE5 — Settled, white row
//  4  #FEF3C7 — Pending, white row
//  5  #FEE2E2 — Failed,  white row
//  6  #F8F9FA — data row, even (light grey banding)
//  7  #C7F3E8 — Settled, grey row (slightly darker green tint)
//  8  #FDE68A — Pending, grey row (slightly darker amber tint)
//  9  #FECACA — Failed,  grey row (slightly darker red tint)
//
// Border indices:
//  0  no borders
//  1  thin border on all sides (#D1D5DB = Tailwind gray-300)
//
// Horizontal alignment:
//  horizontal="left"    — default text
//  horizontal="center"  — header center / status
//  horizontal="right"   — amount
//
// cellXfs (16 entries) — see "Style indices" comment above for full mapping

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="5">
  <font><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  <font><sz val="11"/><color rgb="FF065F46"/><name val="Calibri"/></font>
  <font><sz val="11"/><color rgb="FF92400E"/><name val="Calibri"/></font>
  <font><sz val="11"/><color rgb="FF991B1B"/><name val="Calibri"/></font>
</fonts>
<fills count="10">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF8F9FA"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFC7F3E8"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFDE68A"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFECACA"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border>
    <left   style="thin"><color rgb="FFD1D5DB"/></left>
    <right  style="thin"><color rgb="FFD1D5DB"/></right>
    <top    style="thin"><color rgb="FFD1D5DB"/></top>
    <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
    <diagonal/>
  </border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="16">
  <!-- 0: default -->
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <!-- 1: amount, white row — right-align, #,##0.00, thin border -->
  <xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
  <!-- 2: header left — bold white on indigo, thin border, left-align -->
  <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!-- 3: header center — bold white on indigo, thin border, center-align -->
  <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!-- 4: header right — bold white on indigo, thin border, right-align -->
  <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 5: data left, white row -->
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>
  <!-- 6: data left, grey row -->
  <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>
  <!-- 7: data right, white row -->
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
  <!-- 8: data right, grey row -->
  <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
  <!-- 9: Settled, white row -->
  <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
  <!-- 10: Settled, grey row -->
  <xf numFmtId="0" fontId="2" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
  <!-- 11: Pending, white row -->
  <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
  <!-- 12: Pending, grey row -->
  <xf numFmtId="0" fontId="3" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
  <!-- 13: Failed, white row -->
  <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
  <!-- 14: Failed, grey row -->
  <xf numFmtId="0" fontId="4" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
  <!-- 15: amount, grey row — right-align, #,##0.00, thin border, grey fill -->
  <xf numFmtId="4" fontId="0" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
</cellXfs>
</styleSheet>`

// ── Minimal ZIP writer (store / no compression) ───────────────────────────────

function strToBytes(str) {
  return new TextEncoder().encode(str)
}

function u32le(n) {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

function u16le(n) {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}

function crc32(data) {
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      t[i] = c
    }
    return t
  })())
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out   = new Uint8Array(total)
  let   off   = 0
  for (const a of arrays) { out.set(a, off); off += a.length }
  return out
}

function zipEntry(name, data) {
  const nameBytes = strToBytes(name)
  const crc       = crc32(data)
  const size      = data.length

  // Local file header
  const local = concat(
    new Uint8Array([0x50,0x4B,0x03,0x04]),  // signature
    u16le(20),                               // version needed
    u16le(0),                                // flags
    u16le(0),                                // compression: stored
    u16le(0), u16le(0),                      // mod time, mod date
    u32le(crc),
    u32le(size), u32le(size),                // compressed = uncompressed
    u16le(nameBytes.length),
    u16le(0),                                // extra field length
    nameBytes,
    data,
  )

  // Central directory entry
  const central = concat(
    new Uint8Array([0x50,0x4B,0x01,0x02]),  // signature
    u16le(20), u16le(20),                    // version made by, needed
    u16le(0), u16le(0),                      // flags, compression
    u16le(0), u16le(0),                      // mod time, date
    u32le(crc),
    u32le(size), u32le(size),
    u16le(nameBytes.length),
    u16le(0), u16le(0),                      // extra, comment lengths
    u16le(0),                                // disk start
    u16le(0), u32le(0),                      // internal/external attrs
    u32le(0),                                // local header offset (filled below)
    nameBytes,
  )

  return { local, central, nameBytes }
}

function buildZip(files) {
  // files: Array of { name: string, content: string | Uint8Array }
  const entries  = files.map(({ name, content }) =>
    zipEntry(name, typeof content === 'string' ? strToBytes(content) : content)
  )
  let   offset   = 0
  const locals   = []
  const centrals = []

  for (const e of entries) {
    // Patch the local header offset into the central directory entry (at byte 42)
    new DataView(e.central.buffer).setUint32(42, offset, true)
    locals.push(e.local)
    centrals.push(e.central)
    offset += e.local.length
  }

  const cdSize   = centrals.reduce((s, c) => s + c.length, 0)
  const cdOffset = offset

  // End of central directory record
  const eocd = concat(
    new Uint8Array([0x50,0x4B,0x05,0x06]),  // signature
    u16le(0), u16le(0),                      // disk numbers
    u16le(entries.length), u16le(entries.length),
    u32le(cdSize),
    u32le(cdOffset),
    u16le(0),                                // comment length
  )

  return concat(...locals, ...centrals, eocd)
}

// ── Public export function ────────────────────────────────────────────────────

export function exportXlsx(rows, filename = 'transactions') {
  const { index: ssIndex, list: ssList } = buildSharedStrings(rows)
  const colWidths = computeColumnWidths(rows)

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ssList.length}" uniqueCount="${ssList.length}">
${ssList.map((s) => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('')}
</sst>`

  const files = [
    { name: '[Content_Types].xml',          content: CONTENT_TYPES    },
    { name: '_rels/.rels',                  content: RELS              },
    { name: 'xl/workbook.xml',              content: WORKBOOK          },
    { name: 'xl/_rels/workbook.xml.rels',   content: WORKBOOK_RELS     },
    { name: 'xl/worksheets/sheet1.xml',     content: buildSheet(rows, ssIndex, colWidths) },
    { name: 'xl/sharedStrings.xml',         content: sharedStringsXml },
    { name: 'xl/styles.xml',                content: STYLES            },
  ]

  const blob = new Blob(
    [buildZip(files)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  )
  triggerDownload(blob, `${filename}.xlsx`)
}
