import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportCsv, exportXlsx } from './exportUtils'

const rows = [
  { transactionDate: '2025-01-01', accountNumber: '111-222', accountHolderName: 'Alice, A.', amount: 100.5, status: 'Settled' },
  { transactionDate: '2025-01-02', accountNumber: '333-444', accountHolderName: 'Bob "The Builder"', amount: 200, status: 'Pending' },
  { transactionDate: '2025-01-03', accountNumber: '555-666', accountHolderName: 'Carol Diaz', amount: 75, status: 'Failed' },
]

// Minimal reader for our own "stored" (uncompressed) zip entries: walks local file
// headers by their fixed-size fields and returns the named entry's raw bytes as text.
function extractZipEntry(bytes, targetName) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  let offset = 0

  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLen = view.getUint16(offset + 26, true)
    const extraLen = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLen))
    const dataStart = nameStart + nameLen + extraLen

    if (name === targetName) {
      return decoder.decode(bytes.subarray(dataStart, dataStart + compressedSize))
    }
    offset = dataStart + compressedSize
  }

  throw new Error(`Zip entry not found: ${targetName}`)
}

describe('exportUtils', () => {
  let downloads
  let originalCreateObjectURL
  let originalRevokeObjectURL
  let originalClick

  beforeEach(() => {
    downloads = []
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    originalClick = HTMLAnchorElement.prototype.click

    URL.createObjectURL = vi.fn((blob) => {
      downloads.push({ blob })
      return 'blob:mock-url'
    })
    URL.revokeObjectURL = vi.fn()
    HTMLAnchorElement.prototype.click = function () {
      const entry = downloads[downloads.length - 1]
      if (entry) entry.filename = this.download
    }
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    HTMLAnchorElement.prototype.click = originalClick
  })

  describe('exportCsv', () => {
    it('triggers a download with the expected filename', () => {
      exportCsv(rows, 'my-export')

      expect(downloads).toHaveLength(1)
      expect(downloads[0].filename).toBe('my-export.csv')
    })

    it('produces CSV content with a header row, RFC 4180 quoting, and a UTF-8 BOM', async () => {
      exportCsv(rows, 'my-export')

      const blob = downloads[0].blob
      expect(blob.type).toContain('text/csv')

      // The BOM is present in the raw bytes; TextDecoder (used by blob.text()) strips it
      // automatically, so check for it at the byte level rather than in the decoded string.
      const bytes = new Uint8Array(await blob.arrayBuffer())
      expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xEF, 0xBB, 0xBF])

      const lines = (await blob.text()).split('\r\n')
      expect(lines[0]).toBe('Transaction Date,Account Number,Account Holder Name,Amount,Status')
      expect(lines[1]).toContain('"Alice, A."') // comma inside value gets quoted
      expect(lines[2]).toContain('"Bob ""The Builder"""') // embedded quotes get doubled
    })
  })

  describe('exportXlsx', () => {
    it('triggers a download with the expected filename', () => {
      exportXlsx(rows, 'my-export')

      expect(downloads).toHaveLength(1)
      expect(downloads[0].filename).toBe('my-export.xlsx')
    })

    it('produces a byte stream starting with the ZIP local-file-header signature', async () => {
      exportXlsx(rows, 'my-export')

      const blob = downloads[0].blob
      const bytes = new Uint8Array(await blob.arrayBuffer())

      expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04])
    })

    it('auto-fits column widths to the longest value in each column', async () => {
      exportXlsx(rows, 'my-export')

      const bytes = new Uint8Array(await downloads[0].blob.arrayBuffer())
      const sheetXml = extractZipEntry(bytes, 'xl/worksheets/sheet1.xml')

      // <cols> must precede <sheetData> per the OOXML worksheet schema.
      expect(sheetXml.indexOf('<cols>')).toBeGreaterThan(-1)
      expect(sheetXml.indexOf('<cols>')).toBeLessThan(sheetXml.indexOf('<sheetData>'))

      // Column C (Account Holder Name) must widen to fit 'Bob "The Builder"' (18 chars).
      const colMatch = sheetXml.match(/<col min="3" max="3" width="(\d+)" customWidth="1"\/>/)
      expect(colMatch).not.toBeNull()
      expect(Number(colMatch[1])).toBeGreaterThanOrEqual(18)

      // A short column (Status) should be clamped to the configured minimum, not 0.
      const statusColMatch = sheetXml.match(/<col min="5" max="5" width="(\d+)" customWidth="1"\/>/)
      expect(Number(statusColMatch[1])).toBeGreaterThanOrEqual(8)
    })

    it('applies a numeric format to Amount cells and bolds the header row', async () => {
      exportXlsx(rows, 'my-export')

      const bytes = new Uint8Array(await downloads[0].blob.arrayBuffer())
      const sheetXml = extractZipEntry(bytes, 'xl/worksheets/sheet1.xml')
      const stylesXml = extractZipEntry(bytes, 'xl/styles.xml')

      // Column D is Amount; row 2 is the first data row.
      expect(sheetXml).toMatch(/<c r="D2"[^>]* s="1"[^>]*>/)
      // Row 1 is the header; column A is Transaction Date.
      expect(sheetXml).toMatch(/<c r="A1"[^>]* s="2"[^>]*>/)

      expect(stylesXml).toContain('numFmtId="4"') // built-in "#,##0.00"
      expect(stylesXml).toMatch(/<xf[^>]*fontId="1"[^>]*applyFont="1"/) // bold header style
    })

    it("color-codes status cells to match the app's status badge colors", async () => {
      exportXlsx(rows, 'my-export')

      const bytes = new Uint8Array(await downloads[0].blob.arrayBuffer())
      const sheetXml = extractZipEntry(bytes, 'xl/worksheets/sheet1.xml')
      const stylesXml = extractZipEntry(bytes, 'xl/styles.xml')

      // Column E is Status; rows 2-4 are Settled, Pending, Failed respectively.
      expect(sheetXml).toMatch(/<c r="E2"[^>]* s="3"[^>]*>/) // Settled
      expect(sheetXml).toMatch(/<c r="E3"[^>]* s="4"[^>]*>/) // Pending
      expect(sheetXml).toMatch(/<c r="E4"[^>]* s="5"[^>]*>/) // Failed

      // Fill colors match App.css's .status-badge background colors exactly.
      expect(stylesXml).toContain('FFD1FAE5') // Settled background
      expect(stylesXml).toContain('FFFEF3C7') // Pending background
      expect(stylesXml).toContain('FFFEE2E2') // Failed background
    })

    it('highlights the header row with a solid fill', async () => {
      exportXlsx(rows, 'my-export')

      const bytes = new Uint8Array(await downloads[0].blob.arrayBuffer())
      const stylesXml = extractZipEntry(bytes, 'xl/styles.xml')

      expect(stylesXml).toContain('FF4F46E5') // brand indigo header fill
      expect(stylesXml).toMatch(/<xf[^>]*fillId="2"[^>]*applyFill="1"/)
    })
  })
})
