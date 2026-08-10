import { test, expect } from '@playwright/test'
import { uniqueName } from './helpers.js'

test.describe('Account number validation', () => {
  test('strips non-digits, caps at 12 characters, blocks submit until 12 digits, and persists the valid value', async ({ page }) => {
    const holderName = uniqueName('E2E Validation')

    await page.goto('/')
    await page.getByRole('button', { name: '+ New Transaction' }).click()

    // Scoped to the dialog: getByLabel does case-insensitive substring matching, so an
    // unscoped page.getByLabel('Account Number') also matches any row's "Copy account
    // number" button once the table has at least one transaction in it.
    const modal = page.getByRole('dialog')
    const accountNumberInput = modal.getByLabel('Account Number')
    const submitButton = modal.getByRole('button', { name: 'Submit' })

    // Typing more than 12 characters (with separators) is stripped to digits and capped at 12.
    await accountNumberInput.fill('9988-7766-55443-333')
    await expect(accountNumberInput).toHaveValue('998877665544')

    await modal.getByLabel('Transaction Date').fill('2027-01-03')
    await modal.getByLabel('Account Holder Name').fill(holderName)
    await modal.getByLabel('Amount').fill('42')

    // A too-short account number disables Submit.
    await accountNumberInput.fill('12345')
    await expect(submitButton).toBeDisabled()

    // Exactly 12 digits re-enables it and saves successfully.
    await accountNumberInput.fill('999888777666')
    await expect(submitButton).toBeEnabled()
    await submitButton.click()

    await expect(page.getByText(holderName)).toBeVisible()
    await page.reload()
    await expect(page.getByText(holderName)).toBeVisible()
  })
})
