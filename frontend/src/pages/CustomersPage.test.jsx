import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomersPage from './CustomersPage'

const transactions = [
  { id: '1', transactionDate: '2025-01-01', accountNumber: '111-222-3333', accountHolderName: 'Alice Adams', amount: 100, status: 'Settled' },
  { id: '2', transactionDate: '2025-01-05', accountNumber: '111-222-3333', accountHolderName: 'Alice Adams', amount: 50, status: 'Pending' },
  { id: '3', transactionDate: '2025-02-01', accountNumber: '444-555-6666', accountHolderName: 'Bob Brown', amount: 200, status: 'Failed' },
]

describe('CustomersPage', () => {
  it('shows a loading state', () => {
    render(<CustomersPage transactions={[]} loading />)

    expect(screen.getByText('Loading customers…')).toBeInTheDocument()
  })

  it('shows an empty state with no transactions', () => {
    render(<CustomersPage transactions={[]} loading={false} />)

    expect(screen.getByText('No customers found.')).toBeInTheDocument()
  })

  it('groups transactions by account number into distinct customers', () => {
    render(<CustomersPage transactions={transactions} loading={false} />)

    expect(screen.getByText('Alice Adams')).toBeInTheDocument()
    expect(screen.getByText('Bob Brown')).toBeInTheDocument()
    expect(screen.getByText('2 customers')).toBeInTheDocument()
  })

  it('shows the correct total volume and transaction count per customer', () => {
    render(<CustomersPage transactions={transactions} loading={false} />)

    const row = screen.getByText('Alice Adams').closest('tr')

    expect(within(row).getByText('$150.00')).toBeInTheDocument() // 100 + 50
    expect(within(row).getByText('2')).toBeInTheDocument() // transaction count
  })

  it('sorts customers by total volume descending by default', () => {
    const { container } = render(<CustomersPage transactions={transactions} loading={false} />)

    const rows = container.querySelectorAll('.cust-table tbody tr')

    expect(rows[0].textContent).toContain('Bob Brown') // 200 total
    expect(rows[1].textContent).toContain('Alice Adams') // 150 total
  })

  it('filters customers by search', async () => {
    const user = userEvent.setup()
    render(<CustomersPage transactions={transactions} loading={false} />)

    await user.type(screen.getByPlaceholderText('Search by name or account #...'), 'Bob')

    expect(screen.queryByText('Alice Adams')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Brown')).toBeInTheDocument()
  })

  it('opens the customer drawer with transaction history on row click', async () => {
    const user = userEvent.setup()
    render(<CustomersPage transactions={transactions} loading={false} />)

    await user.click(screen.getByText('Alice Adams'))

    const dialog = screen.getByRole('dialog', { name: 'Alice Adams details' })
    expect(within(dialog).getByText('$150.00')).toBeInTheDocument()
    expect(within(dialog).getByText('2025-01-01')).toBeInTheDocument()
    expect(within(dialog).getByText('2025-01-05')).toBeInTheDocument()
  })
})
