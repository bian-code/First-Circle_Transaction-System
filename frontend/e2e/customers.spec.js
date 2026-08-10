import { test, expect } from '@playwright/test'
import { addTransactionViaUi, uniqueAccountNumber, uniqueName } from './helpers.js'

test.describe('Customers', () => {
  test('groups the new transaction and shows it in the customer detail drawer', async ({ page }) => {
    const holderName = uniqueName('E2E Customer')

    await page.goto('/')
    await addTransactionViaUi(page, {
      transactionDate: '2027-01-05',
      // Unique per run: CustomersPage groups by accountNumber and keeps only the
      // first-seen holder name per account, so a fixed number here would get merged
      // into a previous run's customer record on any repeat run.
      accountNumber: uniqueAccountNumber(),
      accountHolderName: holderName,
      amount: '333',
    })
    await expect(page.getByText(holderName)).toBeVisible()

    await page.getByRole('button', { name: 'Customers' }).click()
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible()

    await page.getByPlaceholder('Search by name or account #...').fill(holderName)
    await page.getByText(holderName).click()

    const drawer = page.getByRole('dialog', { name: `${holderName} details` })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('2027-01-05')).toBeVisible()
  })
})
