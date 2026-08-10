import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const txAlice = {
  id: 'id-1', transactionDate: '2025-01-01', accountNumber: '111222333444',
  accountHolderName: 'Alice Adams', amount: 100, status: 'Settled',
}
const txBob = {
  id: 'id-2', transactionDate: '2025-02-01', accountNumber: '444555666777',
  accountHolderName: 'Bob Brown', amount: 200, status: 'Pending',
}

function jsonResponse(body, status = 200) {
  return Promise.resolve({ ok: true, status, json: () => Promise.resolve(body) })
}

describe('App', () => {
  let transactions

  beforeEach(() => {
    transactions = [txAlice, txBob]

    global.fetch = vi.fn((url, options = {}) => {
      const method = options.method ?? 'GET'

      if (method === 'GET') {
        return jsonResponse({ data: transactions, page: 0, size: 20, totalItems: transactions.length, totalPages: 1 })
      }
      if (method === 'POST') {
        const created = { ...JSON.parse(options.body), id: 'id-3', status: 'Settled' }
        transactions = [...transactions, created]
        return jsonResponse(created, 201)
      }
      if (method === 'PUT') {
        const id = url.split('/').pop()
        const updated = { ...JSON.parse(options.body), id, status: 'Settled' }
        transactions = transactions.map((tx) => (tx.id === id ? updated : tx))
        return jsonResponse(updated)
      }
      if (method === 'DELETE') {
        const id = url.split('/').pop()
        transactions = transactions.filter((tx) => tx.id !== id)
        return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) })
      }
      return Promise.reject(new Error(`Unhandled ${method} ${url}`))
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders transactions loaded from the API', async () => {
    render(<App />)

    expect(await screen.findByText('Alice Adams')).toBeInTheDocument()
    expect(screen.getByText('Bob Brown')).toBeInTheDocument()
  })

  it('adds a new transaction through the modal', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Alice Adams')

    await user.click(screen.getByRole('button', { name: '+ New Transaction' }))

    fireEvent.change(screen.getByLabelText('Transaction Date'), { target: { value: '2025-03-01' } })
    fireEvent.change(screen.getByLabelText('Account Number'), { target: { value: '999888777666' } })
    fireEvent.change(screen.getByLabelText('Account Holder Name'), { target: { value: 'Carol Chen' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '350' } })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Carol Chen')).toBeInTheDocument()
  })

  it('strips non-digit characters and caps the account number at 12 digits', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Alice Adams')

    await user.click(screen.getByRole('button', { name: '+ New Transaction' }))

    fireEvent.change(screen.getByLabelText('Account Number'), { target: { value: '9988-7766-55443-333' } })

    expect(screen.getByLabelText('Account Number')).toHaveValue('998877665544')
  })

  it('disables submit while the account number is not exactly 12 digits', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Alice Adams')

    await user.click(screen.getByRole('button', { name: '+ New Transaction' }))

    fireEvent.change(screen.getByLabelText('Transaction Date'), { target: { value: '2025-03-01' } })
    fireEvent.change(screen.getByLabelText('Account Number'), { target: { value: '12345' } })
    fireEvent.change(screen.getByLabelText('Account Holder Name'), { target: { value: 'Carol Chen' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '350' } })

    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('edits a transaction through the row menu', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Alice Adams')

    const row = screen.getByText('Alice Adams').closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Row actions' }))
    await user.click(within(row).getByRole('menuitem', { name: 'Edit' }))

    fireEvent.change(screen.getByLabelText('Account Holder Name'), { target: { value: 'Alice Updated' } })
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Alice Updated')).toBeInTheDocument()
    expect(screen.queryByText('Alice Adams')).not.toBeInTheDocument()
  })

  it('deletes a transaction through the row menu', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Alice Adams')

    const row = screen.getByText('Alice Adams').closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Row actions' }))
    await user.click(within(row).getByRole('menuitem', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByText('Alice Adams')).not.toBeInTheDocument())
    expect(screen.getByText('Bob Brown')).toBeInTheDocument()
  })

  it('filters visible rows by the search box', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Alice Adams')

    await user.type(screen.getByPlaceholderText('Search name, account #, or amount...'), 'Bob')

    expect(screen.queryByText('Alice Adams')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Brown')).toBeInTheDocument()
  })

  it('filters visible rows by status', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Alice Adams')

    await user.selectOptions(screen.getByDisplayValue('Status'), 'Pending')

    expect(screen.queryByText('Alice Adams')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Brown')).toBeInTheDocument()
  })

  it('toggles sort order when a sortable column header is clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await screen.findByText('Alice Adams')

    const rowOrder = () => Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.textContent)

    // Default sort is transactionDate desc, so Bob (2025-02-01) sorts before Alice (2025-01-01).
    expect(rowOrder()[0]).toContain('Bob Brown')

    await user.click(screen.getByRole('button', { name: /Sort by Date/ }))

    expect(rowOrder()[0]).toContain('Alice Adams')
  })
})
