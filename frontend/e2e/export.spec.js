import { test, expect } from '@playwright/test'
import { addTransactionViaUi, uniqueName } from './helpers.js'

// Deep file-content checks (CSV quoting, XLSX cell/style structure) already live in
// frontend/src/exportUtils.test.js. This suite only proves the real button -> download wiring.
test.describe('Export', () => {
  test('downloads a CSV file', async ({ page }) => {
    await page.goto('/')
    await addTransactionViaUi(page, {
      transactionDate: '2027-01-06',
      accountNumber: '246813579246',
      accountHolderName: uniqueName('E2E Export CSV'),
      amount: '55',
    })

    await page.getByRole('button', { name: 'Export' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Download CSV' }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/^transactions-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  test('downloads an Excel file', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Export' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Download Excel (.xlsx)' }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/^transactions-\d{4}-\d{2}-\d{2}\.xlsx$/)
  })
})
