/**
 * exportUtils.js
 *
 * Zero-dependency export helpers that work entirely in the browser.
 * Both functions accept a rows array and a filename (without extension)
 * and trigger a file download.
 */

// ─── Shared ───────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'transactionDate',   header: 'Transaction Date'   },
  { key: 'accountNumber',     header: 'Account Number'     },
  { key: 'accountHolderName', header: 'Account Holder Name'},
  { key: 'amount',            header: 'Amount'             },
  { key: 'status',            header: 'Status'             },
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
 * wrap in quotes if the value contains a comma, quote, or newline.
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
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  // \uFEFF = UTF-8 BOM — makes Excel open the file with the correct encoding
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
  // Data rows
  rows.forEach((row) => COLUMNS.forEach((c) => {
    // Numbers are written as numeric cells; only strings need the table
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
// SpreadsheetML column "width" is in character units of the default font.
// There's no way to ask Excel to auto-fit for us in raw XML, so we measure
// each column's longest rendered value (header included) ourselves.

const MIN_COL_WIDTH = 8
const MAX_COL_WIDTH = 60
const COL_WIDTH_PADDING = 2

function displayLength(key, val) {
  if (val == null || val === '') return 0
  if (key === 'amount') {
    const n = parseFloat(val)
    if (isNaN(n)) return 0
    // Matches the "#,##0.00" number format applied to these cells (see STYLES).
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',').length
  }
  return String(val).length
}

function computeColumnWidths(rows) {
  return COLUMNS.map((c) => {
    const longest = rows.reduce((max, row) => Math.max(max, displayLength(c.key, row[c.key])), c.header.length)
    return Math.min(Math.max(longest + COL_WIDTH_PADDING, MIN_COL_WIDTH), MAX_COL_WIDTH)
  })
}

function buildCols(widths) {
  const colEntries = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('')
  return `<cols>${colEntries}</cols>`
}

// ── Sheet XML ─────────────────────────────────────────────────────────────────
//
// Style indices reference the cellXfs entries defined in STYLES below:
// 0 = default, 1 = "#,##0.00" number format (Amount column), 2 = header highlight,
// 3/4/5 = Settled/Pending/Failed status color coding (see STYLES for the mapping).

const HEADER_STYLE = 2
const AMOUNT_STYLE = 1
const STATUS_STYLES = { Settled: 3, Pending: 4, Failed: 5 }

function buildSheet(rows, ssIndex, colWidths) {
  const strCell = (col, rowIdx, val, styleIdx = 0) => {
    const idx = ssIndex.get(String(val == null ? '' : val)) ?? 0
    const s = styleIdx ? ` s="${styleIdx}"` : ''
    return `<c r="${cellAddr(col, rowIdx)}" t="s"${s}><v>${idx}</v></c>`
  }

  const numCell = (col, rowIdx, val, styleIdx = 0) => {
    const n = parseFloat(val)
    const s = styleIdx ? ` s="${styleIdx}"` : ''
    return `<c r="${cellAddr(col, rowIdx)}"${s}><v>${isNaN(n) ? 0 : n}</v></c>`
  }

  // Header row — Excel row 1 (rowIdx 0), bold white text on a highlighted fill
  const headerCells = COLUMNS.map((c, ci) => strCell(ci, 0, c.header, HEADER_STYLE)).join('')
  const headerRow   = `<row r="1">${headerCells}</row>`

  // Data rows — Excel rows 2..N (rowIdx 1..N)
  const dataRows = rows.map((row, ri) => {
    const rowIdx = ri + 1
    const cells  = COLUMNS.map((c, ci) => {
      if (c.key === 'amount') return numCell(ci, rowIdx, row[c.key], AMOUNT_STYLE)
      if (c.key === 'status') return strCell(ci, rowIdx, row[c.key], STATUS_STYLES[row[c.key]] ?? 0)
      return strCell(ci, rowIdx, row[c.key])
    }).join('')
    return `<row r="${rowIdx + 1}">${cells}</row>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
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

// cellXfs indices below must line up with HEADER_STYLE / AMOUNT_STYLE / STATUS_STYLES above:
//   0 = default (General format, regular weight)
//   1 = numFmtId 4 = built-in "#,##0.00" — used for the Amount column
//   2 = bold white on indigo fill — used for the header row (matches the app's brand accent, #4f46e5)
//   3 = Settled — matches .status-badge.status-settled in App.css (#065f46 on #d1fae5)
//   4 = Pending — matches .status-badge.status-pending in App.css (#92400e on #fef3c7)
//   5 = Failed  — matches .status-badge.status-failed  in App.css (#991b1b on #fee2e2)
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF065F46"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF92400E"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF991B1B"/><name val="Calibri"/></font>
</fonts>
<fills>
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="4" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
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
  // files: Array of { name: string, content: string }
  const entries  = files.map(({ name, content }) => zipEntry(name, strToBytes(content)))
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
    { name: '[Content_Types].xml',          content: CONTENT_TYPES     },
    { name: '_rels/.rels',                  content: RELS               },
    { name: 'xl/workbook.xml',              content: WORKBOOK           },
    { name: 'xl/_rels/workbook.xml.rels',   content: WORKBOOK_RELS      },
    { name: 'xl/worksheets/sheet1.xml',     content: buildSheet(rows, ssIndex, colWidths) },
    { name: 'xl/sharedStrings.xml',         content: sharedStringsXml  },
    { name: 'xl/styles.xml',               content: STYLES             },
  ]

  const blob = new Blob(
    [buildZip(files)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  )
  triggerDownload(blob, `${filename}.xlsx`)
}
