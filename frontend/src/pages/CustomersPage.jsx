import { useMemo, useState } from 'react'
import '../pages/CustomersPage.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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

function maskAccount(acct) {
  if (!acct) return ''
  const last4 = acct.replace(/[^0-9]/g, '').slice(-4)
  return `•••• ${last4}`
}

function statusClass(s) {
  switch (s?.toLowerCase()) {
    case 'pending': return 'status-pending'
    case 'settled': return 'status-settled'
    case 'failed':  return 'status-failed'
    default: return ''
  }
}

// ─── Build customers from transactions ───────────────────────────────────────

function buildCustomers(transactions) {
  const map = {}
  transactions.forEach(tx => {
    const key = tx.accountNumber // group by account number (one account per holder)
    if (!map[key]) {
      map[key] = {
        accountNumber:     tx.accountNumber,
        accountHolderName: tx.accountHolderName,
        totalVolume:       0,
        txCount:           0,
        settledCount:      0,
        pendingCount:      0,
        failedCount:       0,
        lastDate:          tx.transactionDate,
        transactions:      [],
      }
    }
    map[key].totalVolume  += tx.amount || 0
    map[key].txCount      += 1
    map[key].lastDate      = map[key].lastDate > tx.transactionDate ? map[key].lastDate : tx.transactionDate
    map[key].transactions.push(tx)
    if (tx.status === 'Settled') map[key].settledCount++
    if (tx.status === 'Pending') map[key].pendingCount++
    if (tx.status === 'Failed')  map[key].failedCount++
  })
  return Object.values(map)
}

// ─── CustomerDrawer ───────────────────────────────────────────────────────────

function CustomerDrawer({ customer, onClose }) {
  const sorted = [...customer.transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))

  return (
    <div className="drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={`${customer.accountHolderName} details`}>
        <div className="drawer-header">
          <div className="drawer-title-row">
            <div className="avatar-lg" style={{ background: avatarColor(customer.accountHolderName) }}>
              {getInitials(customer.accountHolderName)}
            </div>
            <div>
              <h2 className="drawer-name">{customer.accountHolderName}</h2>
              <span className="drawer-acct">{maskAccount(customer.accountNumber)}</span>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-stats">
          <div className="drawer-stat">
            <span className="drawer-stat-label">Total Volume</span>
            <span className="drawer-stat-value">{formatCurrency(customer.totalVolume)}</span>
          </div>
          <div className="drawer-stat">
            <span className="drawer-stat-label">Transactions</span>
            <span className="drawer-stat-value">{customer.txCount}</span>
          </div>
          <div className="drawer-stat">
            <span className="drawer-stat-label">Settled</span>
            <span className="drawer-stat-value" style={{ color: '#10b981' }}>{customer.settledCount}</span>
          </div>
          <div className="drawer-stat">
            <span className="drawer-stat-label">Pending</span>
            <span className="drawer-stat-value" style={{ color: '#f59e0b' }}>{customer.pendingCount}</span>
          </div>
          <div className="drawer-stat">
            <span className="drawer-stat-label">Failed</span>
            <span className="drawer-stat-value" style={{ color: '#ef4444' }}>{customer.failedCount}</span>
          </div>
        </div>

        <div className="drawer-section-label">Transaction History</div>
        <div className="drawer-tx-list">
          {sorted.map(tx => (
            <div key={tx.id} className="drawer-tx-row">
              <div className="drawer-tx-left">
                <span className="drawer-tx-date">{tx.transactionDate}</span>
                <span className={`status-badge ${statusClass(tx.status)}`}>{tx.status}</span>
              </div>
              <span className="drawer-tx-amount">{formatCurrency(tx.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── CustomersPage ────────────────────────────────────────────────────────────

export default function CustomersPage({ transactions, loading }) {
  const [search, setSearch]           = useState('')
  const [sortKey, setSortKey]         = useState('totalVolume')
  const [sortDir, setSortDir]         = useState('desc')
  const [selectedCustomer, setSelected] = useState(null)

  const customers = useMemo(() => buildCustomers(transactions), [transactions])

  const visible = useMemo(() => {
    let rows = customers
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(c =>
        c.accountHolderName.toLowerCase().includes(q) ||
        c.accountNumber.includes(q)
      )
    }
    return [...rows].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'accountHolderName') cmp = a.accountHolderName.localeCompare(b.accountHolderName)
      else if (sortKey === 'totalVolume')  cmp = a.totalVolume - b.totalVolume
      else if (sortKey === 'txCount')      cmp = a.txCount - b.txCount
      else if (sortKey === 'lastDate')     cmp = a.lastDate.localeCompare(b.lastDate)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [customers, search, sortKey, sortDir])

  const totalCustomers = customers.length
  const totalVolume    = customers.reduce((s, c) => s + c.totalVolume, 0)
  const avgSpend       = totalCustomers > 0 ? totalVolume / totalCustomers : 0

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortBtn = ({ col, label }) => {
    const active = sortKey === col
    return (
      <button className={`cust-th-btn ${active ? 'active' : ''}`} onClick={() => handleSort(col)}>
        {label}
        <span className="cust-th-arrow">{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
      </button>
    )
  }

  if (loading) {
    return (
      <div className="cust-loading">
        <div className="dash-spinner" />
        <span>Loading customers…</span>
      </div>
    )
  }

  return (
    <div className="cust-page">
      {/* ── Summary cards ── */}
      <div className="cust-stats-row">
        <div className="cust-stat-card">
          <div className="cust-stat-label">Total Customers</div>
          <div className="cust-stat-value">{totalCustomers}</div>
          <div className="cust-stat-sub">Unique account holders</div>
        </div>
        <div className="cust-stat-card">
          <div className="cust-stat-label">Total Volume</div>
          <div className="cust-stat-value">{formatCurrency(totalVolume)}</div>
          <div className="cust-stat-sub">Across all customers</div>
        </div>
        <div className="cust-stat-card">
          <div className="cust-stat-label">Avg. Spend / Customer</div>
          <div className="cust-stat-value">{formatCurrency(avgSpend)}</div>
          <div className="cust-stat-sub">Average lifetime value</div>
        </div>
        <div className="cust-stat-card">
          <div className="cust-stat-label">Top Customer</div>
          <div className="cust-stat-value cust-stat-value--name">
            {customers.length > 0
              ? customers.sort((a, b) => b.totalVolume - a.totalVolume)[0].accountHolderName.split(' ')[0]
              : '—'}
          </div>
          <div className="cust-stat-sub">Highest volume</div>
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="cust-card">
        {/* toolbar */}
        <div className="cust-toolbar">
          <div className="cust-search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cust-search-icon">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="cust-search-input"
              type="text"
              placeholder="Search by name or account #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="cust-count">{visible.length} customer{visible.length !== 1 ? 's' : ''}</span>
        </div>

        {/* table */}
        {visible.length === 0 ? (
          <div className="cust-empty">
            {search ? 'No customers match your search.' : 'No customers found.'}
          </div>
        ) : (
          <div className="cust-table-wrapper">
            <table className="cust-table">
              <thead>
                <tr>
                  <th><SortBtn col="accountHolderName" label="Customer" /></th>
                  <th>Account</th>
                  <th><SortBtn col="txCount" label="Transactions" /></th>
                  <th><SortBtn col="totalVolume" label="Total Volume" /></th>
                  <th>Breakdown</th>
                  <th><SortBtn col="lastDate" label="Last Activity" /></th>
                  <th className="cust-col-action">Details</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(c => (
                  <tr key={c.accountNumber} onClick={() => setSelected(c)} className="cust-row">
                    <td>
                      <div className="cust-holder-cell">
                        <div className="avatar-md" style={{ background: avatarColor(c.accountHolderName) }}>
                          {getInitials(c.accountHolderName)}
                        </div>
                        <span className="cust-holder-name">{c.accountHolderName}</span>
                      </div>
                    </td>
                    <td className="cust-acct-num">{maskAccount(c.accountNumber)}</td>
                    <td className="cust-center">{c.txCount}</td>
                    <td className="cust-amount">{formatCurrency(c.totalVolume)}</td>
                    <td>
                      <div className="cust-breakdown">
                        <span className="cust-bdg cust-bdg--settled" title="Settled">{c.settledCount}S</span>
                        <span className="cust-bdg cust-bdg--pending" title="Pending">{c.pendingCount}P</span>
                        <span className="cust-bdg cust-bdg--failed"  title="Failed">{c.failedCount}F</span>
                      </div>
                    </td>
                    <td className="cust-date">{c.lastDate}</td>
                    <td className="cust-col-action">
                      <button
                        className="cust-view-btn"
                        onClick={e => { e.stopPropagation(); setSelected(c) }}
                        aria-label={`View ${c.accountHolderName}`}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedCustomer && (
        <CustomerDrawer customer={selectedCustomer} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
