import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { exportCsv, exportXlsx } from './exportUtils'
import DashboardPage from './pages/DashboardPage'
import CustomersPage from './pages/CustomersPage'

// ─── Constants ───────────────────────────────────────────────────────────────

const API_URL = '/api/transactions'
const TOAST_DURATION_MS = 3000

const EMPTY_FORM = {
  transactionDate: '',
  accountNumber: '',
  accountHolderName: '',
  amount: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusClass(status) {
  switch (status?.toLowerCase()) {
    case 'pending': return 'status-pending'
    case 'settled': return 'status-settled'
    case 'failed':  return 'status-failed'
    default:        return ''
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function maskAccount(accountNumber) {
  if (!accountNumber) return ''
  const last4 = accountNumber.replace(/[^0-9]/g, '').slice(-4)
  return `•••• ${last4}`
}

const AVATAR_COLORS = [
  '#4f46e5','#0891b2','#059669','#d97706','#dc2626',
  '#7c3aed','#db2777','#0284c7','#16a34a','#ca8a04',
]

function avatarColor(name) {
  let hash = 0
  for (let i = 0; i < (name?.length ?? 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── useToast ─────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(timerRef.current)
    setToast({ message, type })
    timerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }, [])

  const dismissToast = useCallback(() => {
    clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return { toast, showToast, dismissToast }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  if (!toast) return null
  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <span className="toast-message">{toast.message}</span>
      <button className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss notification">✕</button>
    </div>
  )
}

// ─── useSort ──────────────────────────────────────────────────────────────────

function useSort(defaultKey, defaultDir = 'asc') {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir })

  const toggleSort = useCallback((key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )
  }, [])

  return { sort, toggleSort }
}

// ─── sortAndFilter ────────────────────────────────────────────────────────────

const STATUS_ORDER = { Pending: 0, Settled: 1, Failed: 2 }

function sortAndFilter(transactions, sort, statusFilter, searchQuery) {
  let rows = transactions

  if (statusFilter) {
    rows = rows.filter((tx) => tx.status === statusFilter)
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    rows = rows.filter((tx) =>
      tx.accountHolderName?.toLowerCase().includes(q) ||
      tx.accountNumber?.includes(q) ||
      String(tx.amount)?.includes(q)
    )
  }

  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case 'transactionDate':
        cmp = a.transactionDate < b.transactionDate ? -1 : a.transactionDate > b.transactionDate ? 1 : 0
        break
      case 'amount':
        cmp = a.amount - b.amount
        break
      case 'status':
        cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
        break
      case 'accountHolderName':
        cmp = a.accountHolderName.localeCompare(b.accountHolderName)
        break
      default: cmp = 0
    }
    return sort.dir === 'asc' ? cmp : -cmp
  })
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',     icon: DashboardIcon },
  { id: 'transactions',  label: 'Transactions',  icon: TransactionsIcon },
  { id: 'customers',     label: 'Customers',     icon: CustomersIcon },
]

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}
function TransactionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )
}
function CustomersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`sidebar-nav-item ${activePage === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

// ─── StatCards ───────────────────────────────────────────────────────────────

function StatCards({ transactions }) {
  const totalVolume = transactions.reduce((s, tx) => s + (tx.amount || 0), 0)
  const settled = transactions.filter((tx) => tx.status === 'Settled')
  const settledVolume = settled.reduce((s, tx) => s + (tx.amount || 0), 0)
  const pending = transactions.filter((tx) => tx.status === 'Pending')
  const pendingVolume = pending.reduce((s, tx) => s + (tx.amount || 0), 0)
  const failedCount = transactions.filter((tx) => tx.status === 'Failed').length

  return (
    <div className="stat-cards">
      <div className="stat-card">
        <div className="stat-label">Total Volume</div>
        <div className="stat-value">{formatCurrency(totalVolume)}</div>
        <div className="stat-sub stat-up">▲ {transactions.length} transactions</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Settled</div>
        <div className="stat-value">{formatCurrency(settledVolume)}</div>
        <div className="stat-sub">{settled.length} transactions</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Pending</div>
        <div className="stat-value">{formatCurrency(pendingVolume)}</div>
        <div className="stat-sub">{pending.length} transactions</div>
      </div>
      <div className="stat-card stat-card-alert">
        <div className="stat-label">Failed Rate</div>
        <div className="stat-value stat-value-alert">{failedCount}</div>
        <div className="stat-sub">{failedCount} failed</div>
      </div>
    </div>
  )
}

// ─── ExportMenu ───────────────────────────────────────────────────────────────

function ExportMenu({ rows }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const timestamp = () => new Date().toISOString().slice(0, 10)

  return (
    <div className="export-menu" ref={ref}>
      <button className="btn-toolbar" onClick={() => setOpen((v) => !v)} aria-haspopup="true" aria-expanded={open}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="export-dropdown" role="menu">
          <button role="menuitem" onClick={() => { exportCsv(rows, `transactions-${timestamp()}`); setOpen(false) }}>Download CSV</button>
          <button role="menuitem" onClick={() => { exportXlsx(rows, `transactions-${timestamp()}`); setOpen(false) }}>Download Excel (.xlsx)</button>
        </div>
      )}
    </div>
  )
}

// ─── TransactionModal ─────────────────────────────────────────────────────────

function TransactionModal({ initialData, onClose, onSuccess }) {
  const isEdit = Boolean(initialData)

  const [form, setForm] = useState(() => {
    if (isEdit) {
      return {
        transactionDate:   initialData.transactionDate ?? '',
        // Older records may have been stored with separators (e.g. "1234-5678-9012");
        // normalize to digits-only so they satisfy the current 12-digit format on save.
        accountNumber:     (initialData.accountNumber ?? '').replace(/\D/g, '').slice(0, 12),
        accountHolderName: initialData.accountHolderName ?? '',
        amount:            String(initialData.amount ?? ''),
      }
    }
    return EMPTY_FORM
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // Account numbers must be exactly 12 digits — strip anything non-numeric as the
  // user types and cap the length, rather than letting them enter it then rejecting it.
  const handleAccountNumberChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12)
    setForm((prev) => ({ ...prev, accountNumber: digitsOnly }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        transactionDate:   form.transactionDate,
        accountNumber:     form.accountNumber.trim(),
        accountHolderName: form.accountHolderName.trim(),
        amount:            parseFloat(form.amount),
      }
      const url    = isEdit ? `${API_URL}/${initialData.id}` : API_URL
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.errors?.join(', ') ?? `Server returned ${res.status}`)
      }
      onSuccess(await res.json())
    } catch (err) {
      setError(err.message || 'Failed to submit transaction.')
    } finally {
      setSubmitting(false)
    }
  }

  const isValid =
    form.transactionDate && /^\d{12}$/.test(form.accountNumber) && form.accountHolderName.trim() &&
    form.amount !== '' && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title">{isEdit ? 'Edit Transaction' : 'New Transaction'}</h2>
          <button className="btn-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="transactionDate">Transaction Date</label>
            <input id="transactionDate" type="date" name="transactionDate" value={form.transactionDate} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="accountNumber">Account Number</label>
            <input
              id="accountNumber"
              type="text"
              name="accountNumber"
              inputMode="numeric"
              placeholder="e.g. 123456789012"
              value={form.accountNumber}
              onChange={handleAccountNumberChange}
              required
            />
            <span className="field-hint">Must be exactly 12 digits, numbers only</span>
          </div>
          <div className="form-group">
            <label htmlFor="accountHolderName">Account Holder Name</label>
            <input id="accountHolderName" type="text" name="accountHolderName" placeholder="e.g. Jane Doe" value={form.accountHolderName} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="amount">Amount</label>
            <input id="amount" type="number" name="amount" placeholder="0.00" min="0.01" step="0.01" value={form.amount} onChange={handleChange} required />
          </div>
          {error && <p className="error-inline" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={!isValid || submitting}>
              {submitting ? (isEdit ? 'Saving…' : 'Submitting…') : (isEdit ? 'Save Changes' : 'Submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── KebabMenu ────────────────────────────────────────────────────────────────

function KebabMenu({ tx, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="kebab-wrapper" ref={ref}>
      <button className="btn-kebab" onClick={() => setOpen((v) => !v)} aria-label="Row actions">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div className="kebab-menu" role="menu">
          <button role="menuitem" className="kebab-item" onClick={() => { onEdit(tx); setOpen(false) }}>
            Edit
          </button>
          <button role="menuitem" className="kebab-item kebab-item-danger" onClick={() => { onDelete(tx.id); setOpen(false) }}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── BulkActionBar ────────────────────────────────────────────────────────────

function BulkActionBar({ selectedIds, onExport, onDelete, onClear }) {
  if (selectedIds.size === 0) return null
  const count = selectedIds.size

  return (
    <div className="bulk-action-bar">
      <span className="bulk-count">{count} selected</span>
      <button className="bulk-btn" onClick={onExport}>Export</button>
      <button className="bulk-btn bulk-btn-danger" onClick={onDelete}>Delete</button>
      <button className="bulk-btn-clear" onClick={onClear}>✕ Clear</button>
    </div>
  )
}

// ─── SortableHeader ───────────────────────────────────────────────────────────

function SortableHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey
  return (
    <button
      className={`th-sort-btn ${active ? 'th-sort-active' : ''}`}
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}${active ? `, currently ${sort.dir}ending` : ''}`}
    >
      {label}
      <span className="th-sort-arrows">
        {active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}
      </span>
    </button>
  )
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <button className="btn-copy" onClick={handleCopy} aria-label="Copy account number" title={copied ? 'Copied!' : 'Copy'}>
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalPages <= 1) return null

  const startItem = currentPage * pageSize + 1
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems)

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) pages.push(i)
    } else {
      pages.push(0)
      let start = Math.max(1, currentPage - 1)
      let end = Math.min(totalPages - 2, currentPage + 1)

      if (currentPage <= 2) { start = 1; end = 3 }
      if (currentPage >= totalPages - 3) { start = totalPages - 4; end = totalPages - 2 }

      if (start > 1) pages.push('...')
      for (let i = start; i <= end; i++) pages.push(i)
      if (end < totalPages - 2) pages.push('...')
      pages.push(totalPages - 1)
    }
    return pages
  }

  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing {startItem}–{endItem} of {totalItems}
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          aria-label="Previous page"
        >
          ‹
        </button>
        {getPageNumbers().map((page, idx) =>
          page === '...' ? (
            <span key={`ellipsis-${idx}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={page}
              className={`pagination-btn pagination-num ${page === currentPage ? 'pagination-active' : ''}`}
              onClick={() => onPageChange(page)}
              aria-label={`Page ${page + 1}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page + 1}
            </button>
          )
        )}
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  )
}

// ─── TransactionTable ─────────────────────────────────────────────────────────

function TransactionTable({
  transactions, loading, error,
  onEdit, onDelete, onRetry,
  sort, onSort,
  statusFilter, onStatusFilter,
  searchQuery, onSearchQuery,
  selectedIds, onToggleSelect, onToggleAll,
  onBulkExport, onBulkDelete,
}) {
  if (loading) return <div className="loading-state">Loading transactions…</div>
  if (error) {
    return (
      <div className="error-state">
        <span>⚠ {error}</span>
        <button className="btn-retry" onClick={onRetry}>Retry</button>
      </div>
    )
  }

  const visible = sortAndFilter(transactions, sort, statusFilter, searchQuery)
  const allSelected = visible.length > 0 && visible.every((tx) => selectedIds.has(tx.id))
  const someSelected = visible.some((tx) => selectedIds.has(tx.id))
  const selectedInView = visible.filter((tx) => selectedIds.has(tx.id))

  const statusCounts = { Pending: 0, Settled: 0, Failed: 0 }
  transactions.forEach((tx) => { if (statusCounts[tx.status] !== undefined) statusCounts[tx.status]++ })
  const totalStatusCount = statusCounts.Pending + statusCounts.Settled + statusCounts.Failed

  return (
    <div className="table-section">
      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search name, account #, or amount..."
            value={searchQuery}
            onChange={(e) => onSearchQuery(e.target.value)}
          />
        </div>

        <div className="toolbar-right">
          <div className="status-filter-wrapper">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            <select className="status-filter-select" value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)}>
              <option value="">Status</option>
              <option value="Pending">Pending</option>
              <option value="Settled">Settled</option>
              <option value="Failed">Failed</option>
            </select>
            {totalStatusCount > 0 && (
              <span className="filter-count-badge">{statusFilter ? (statusCounts[statusFilter] ?? 0) : totalStatusCount}</span>
            )}
          </div>

          <ExportMenu rows={visible} />
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onExport={() => onBulkExport(selectedInView)}
        onDelete={() => onBulkDelete([...selectedIds])}
        onClear={() => onToggleAll(visible, false)}
      />

      {visible.length === 0 ? (
        <div className="empty-state">
          {statusFilter || searchQuery ? 'No transactions match your filters.' : 'No transactions found. Add one to get started.'}
        </div>
      ) : (
        <div className="table-wrapper">
          <table aria-label="Transaction history">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    className="row-checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                    onChange={(e) => onToggleAll(visible, e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
                <th><SortableHeader label="Date" sortKey="transactionDate" sort={sort} onSort={onSort} /></th>
                <th>Account Holder</th>
                <th>Account Number</th>
                <th><SortableHeader label="Amount" sortKey="amount" sort={sort} onSort={onSort} /></th>
                <th><SortableHeader label="Status" sortKey="status" sort={sort} onSort={onSort} /></th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((tx) => (
                <tr key={tx.id} className={selectedIds.has(tx.id) ? 'row-selected' : ''}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      className="row-checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => onToggleSelect(tx.id)}
                      aria-label={`Select ${tx.accountHolderName}`}
                    />
                  </td>
                  <td className="col-date">{tx.transactionDate}</td>
                  <td>
                    <div className="account-holder-cell">
                      <div className="avatar" style={{ backgroundColor: avatarColor(tx.accountHolderName) }}>
                        {getInitials(tx.accountHolderName)}
                      </div>
                      <span className="holder-name">{tx.accountHolderName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="account-number-cell">
                      <span className="account-masked">{maskAccount(tx.accountNumber)}</span>
                      <CopyButton text={tx.accountNumber} />
                    </div>
                  </td>
                  <td className="amount-cell">{formatCurrency(tx.amount)}</td>
                  <td>
                    <span className={`status-badge ${statusClass(tx.status)}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="col-actions">
                    <KebabMenu tx={tx} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── App (Root Component) ─────────────────────────────────────────────────────

export default function App() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [fetchError, setFetchError]     = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedIds, setSelectedIds]   = useState(new Set())
  const [activePage, setActivePage]     = useState('transactions')
  const [modalTarget, setModalTarget]   = useState(null)
  const [currentPage, setCurrentPage]   = useState(0)
  const [totalPages, setTotalPages]     = useState(1)
  const [totalItems, setTotalItems]     = useState(0)

  const PAGE_SIZE = 10

  const { sort, toggleSort } = useSort('transactionDate', 'desc')
  const { toast, showToast, dismissToast } = useToast()

  const fetchTransactions = useCallback(async (page = 0) => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`${API_URL}?page=${page}&size=${PAGE_SIZE}`)
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const json = await res.json()
      setTransactions(json.data ?? [])
      setCurrentPage(json.page ?? 0)
      setTotalPages(json.totalPages ?? 1)
      setTotalItems(json.totalItems ?? 0)
    } catch (err) {
      setFetchError(err.message || 'Unable to fetch transactions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTransactions(currentPage) }, [fetchTransactions, currentPage])

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleTransactionAdded = (newTx) => {
    setModalTarget(null)
    showToast('Transaction added successfully.')
    fetchTransactions(currentPage)
  }

  const handleTransactionUpdated = (updated) => {
    setTransactions((prev) => prev.map((tx) => (tx.id === updated.id ? updated : tx)))
    setModalTarget(null)
    showToast('Transaction updated successfully.')
  }

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        showToast(`Delete failed: ${json?.errors?.join(', ') ?? res.status}`, 'error')
        return
      }
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s })
      showToast('Transaction deleted.')
      fetchTransactions(currentPage)
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error')
    }
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const handleToggleAll = (visibleRows, checked) => {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      visibleRows.forEach((tx) => checked ? s.add(tx.id) : s.delete(tx.id))
      return s
    })
  }

  const handleBulkExport = (rows) => {
    const timestamp = new Date().toISOString().slice(0, 10)
    exportCsv(rows, `transactions-selected-${timestamp}`)
    showToast(`Exported ${rows.length} transaction${rows.length !== 1 ? 's' : ''}.`)
  }

  const handleBulkDelete = async (ids) => {
    await Promise.all(ids.map((id) => handleDelete(id)))
    setSelectedIds(new Set())
  }

  const isModalOpen  = modalTarget !== null
  const isEditMode   = isModalOpen && modalTarget !== false
  const modalInitial = isEditMode ? modalTarget : undefined

  // ── Page titles ───────────────────────────────────────────────────────────
  const PAGE_TITLES = {
    dashboard:    'Dashboard',
    transactions: 'Transactions',
    customers:    'Customers',
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div className="main-content">
        <div className="page-header">
          <h1 className="page-title">{PAGE_TITLES[activePage] ?? 'Transactions'}</h1>
          {activePage === 'transactions' && (
            <button className="btn-add" onClick={() => setModalTarget(false)}>
              + New Transaction
            </button>
          )}
        </div>

        {activePage === 'dashboard' && (
          <DashboardPage
            transactions={transactions}
            loading={loading}
            onNavigate={setActivePage}
          />
        )}

        {activePage === 'transactions' && (
          <>
            <StatCards transactions={transactions} />
            <div className="table-card">
              <TransactionTable
                transactions={transactions}
                loading={loading}
                error={fetchError}
                onEdit={(tx) => setModalTarget(tx)}
                onDelete={handleDelete}
                onRetry={() => fetchTransactions(currentPage)}
                sort={sort}
                onSort={toggleSort}
                statusFilter={statusFilter}
                onStatusFilter={setStatusFilter}
                searchQuery={searchQuery}
                onSearchQuery={setSearchQuery}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleAll={handleToggleAll}
                onBulkExport={handleBulkExport}
                onBulkDelete={handleBulkDelete}
              />
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}

        {activePage === 'customers' && (
          <CustomersPage
            transactions={transactions}
            loading={loading}
          />
        )}

      </div>

      {isModalOpen && (
        <TransactionModal
          initialData={modalInitial}
          onClose={() => setModalTarget(null)}
          onSuccess={isEditMode ? handleTransactionUpdated : handleTransactionAdded}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
