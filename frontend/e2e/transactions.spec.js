import { test, expect } from '@playwright/test'
import { addTransactionViaUi, uniqueName } from './helpers.js'

test.describe('Transactions', () => {
  test('adding, editing, and deleting a transaction persists across reloads', async ({ page }) => {
    const holderName = uniqueName('E2E Create')

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()

    await addTransactionViaUi(page, {
      transactionDate: '2027-01-01',
      accountNumber: '123456789012',
      accountHolderName: holderName,
      amount: '250',
    })
    await expect(page.getByText(holderName)).toBeVisible()

    // Reload to prove the row came back from the server/CSV, not just local state.
    await page.reload()
    await expect(page.getByText(holderName)).toBeVisible()

    // Edit.
    const row = page.locator('tr', { has: page.getByText(holderName) })
    await row.getByRole('button', { name: 'Row actions' }).click()
    await row.getByRole('menuitem', { name: 'Edit' }).click()

    const updatedName = `${holderName} Updated`
    await page.getByLabel('Account Holder Name').fill(updatedName)
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.getByText(updatedName)).toBeVisible()
    await page.reload()
    await expect(page.getByText(updatedName)).toBeVisible()

    // Delete.
    const updatedRow = page.locator('tr', { has: page.getByText(updatedName) })
    await updatedRow.getByRole('button', { name: 'Row actions' }).click()
    await updatedRow.getByRole('menuitem', { name: 'Delete' }).click()

    await expect(page.getByText(updatedName)).not.toBeVisible()
    await page.reload()
    await expect(page.getByText(updatedName)).not.toBeVisible()
  })

  test('search filters the visible rows', async ({ page }) => {
    const holderName = uniqueName('E2E Search')

    await page.goto('/')
    await addTransactionViaUi(page, {
      transactionDate: '2027-01-02',
      accountNumber: '123456789013',
      accountHolderName: holderName,
      amount: '10',
    })
    await expect(page.getByText(holderName)).toBeVisible()

    const search = page.getByPlaceholder('Search name, account #, or amount...')
    await search.fill('zzz-should-not-match-zzz')
    await expect(page.getByText(holderName)).not.toBeVisible()

    await search.fill(holderName)
    await expect(page.getByText(holderName)).toBeVisible()
  })
})
