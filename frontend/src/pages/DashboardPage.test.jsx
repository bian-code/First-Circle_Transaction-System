import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import DashboardPage from './DashboardPage'

const transactions = [
  { id: '1', transactionDate: '2025-01-01', accountNumber: '111', accountHolderName: 'Alice', amount: 100, status: 'Settled' },
  { id: '2', transactionDate: '2025-01-05', accountNumber: '111', accountHolderName: 'Alice', amount: 50, status: 'Pending' },
  { id: '3', transactionDate: '2025-02-01', accountNumber: '222', accountHolderName: 'Bob', amount: 200, status: 'Failed' },
]

describe('DashboardPage', () => {
  it('shows a loading state', () => {
    render(<DashboardPage transactions={[]} loading onNavigate={() => {}} />)

    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument()
  })

  it('renders stat cards computed from the transactions', () => {
    const { container } = render(<DashboardPage transactions={transactions} loading={false} onNavigate={() => {}} />)

    // Scoped to the stat-cards row: the same dollar amounts also appear in the
    // Recent Transactions table below, so an unscoped query would be ambiguous.
    const statsRow = within(container.querySelector('.dash-stats-row'))
    expect(statsRow.getByText('$350.00')).toBeInTheDocument() // total volume: 100 + 50 + 200
    expect(statsRow.getByText('3 transactions')).toBeInTheDocument()
    expect(statsRow.getByText('$100.00')).toBeInTheDocument() // settled volume
    expect(statsRow.getByText('$50.00')).toBeInTheDocument() // pending volume
    expect(statsRow.getByText('1 failed')).toBeInTheDocument()
  })

  it('ranks top customers by total volume, highest first', () => {
    const { container } = render(<DashboardPage transactions={transactions} loading={false} onNavigate={() => {}} />)

    const names = Array.from(container.querySelectorAll('.top-customer-name')).map((el) => el.textContent)

    // Bob: 200 total > Alice: 150 total
    expect(names).toEqual(['Bob', 'Alice'])
  })

  it('shows empty states when there is no data', () => {
    render(<DashboardPage transactions={[]} loading={false} onNavigate={() => {}} />)

    expect(screen.getByText('No transactions yet.')).toBeInTheDocument()
    expect(screen.getAllByText('No data')).toHaveLength(2) // donut chart + top customers
  })
})
