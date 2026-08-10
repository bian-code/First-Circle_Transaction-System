// Shared helpers for the Playwright e2e suite (frontend/e2e/*.spec.js).

// Every spec identifies its own rows by a unique account-holder name — needed because
// specs share one backend instance and CSV file within a run (see playwright.config.js),
// even though global-setup.js wipes that file clean before each `npm run test:e2e` run.
export function uniqueName(prefix) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

// CustomersPage groups strictly by accountNumber (frontend/src/pages/CustomersPage.jsx),
// keeping only the first-seen accountHolderName per account. A spec that reuses a fixed
// account number across runs would silently get merged into a prior run's customer record
// instead of getting its own — so any spec asserting on Customers-page grouping needs a
// unique account number per run, not just a unique name.
export function uniqueAccountNumber() {
  const millis = String(Date.now()).slice(-9)
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return millis + rand
}

export async function addTransactionViaUi(page, { transactionDate, accountNumber, accountHolderName, amount }) {
  await page.getByRole('button', { name: '+ New Transaction' }).click()

  // Scoped to the dialog: getByLabel does case-insensitive substring matching, so an
  // unscoped page.getByLabel('Account Number') also matches any row's "Copy account
  // number" button once the table has at least one transaction in it.
  const modal = page.getByRole('dialog')
  await modal.getByLabel('Transaction Date').fill(transactionDate)
  await modal.getByLabel('Account Number').fill(accountNumber)
  await modal.getByLabel('Account Holder Name').fill(accountHolderName)
  await modal.getByLabel('Amount').fill(String(amount))
  await modal.getByRole('button', { name: 'Submit' }).click()
}
