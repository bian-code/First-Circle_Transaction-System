import { test, expect } from '@playwright/test'
import { addTransactionViaUi, uniqueName } from './helpers.js'

test.describe('Dashboard', () => {
  test('reflects a newly created transaction', async ({ page }) => {
    const holderName = uniqueName('E2E Dashboard')

    await page.goto('/')
    await addTransactionViaUi(page, {
      transactionDate: '2027-01-04',
      accountNumber: '123456789099',
      accountHolderName: holderName,
      amount: '777',
    })
    await expect(page.getByText(holderName)).toBeVisible()

    await page.getByRole('button', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    // Far-future date keeps this row at/near the top of "Recent Transactions" regardless
    // of how much other e2e data has accumulated in the scratch CSV. Scoped to the
    // Recent Transactions table specifically: with only one customer in the data, the
    // same name also appears in the "Top Customers" panel, which an unscoped getByText
    // would ambiguously match too.
    await expect(page.getByRole('table').getByText(holderName)).toBeVisible()
  })
})
