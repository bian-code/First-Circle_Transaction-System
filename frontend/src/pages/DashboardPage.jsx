import { useMemo } from 'react'
import '../pages/DashboardPage.css'

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

function statusClass(s) {
  switch (s?.toLowerCase()) {
    case 'pending': return 'status-pending'
    case 'settled': return 'status-settled'
    case 'failed':  return 'status-failed'
    default: return ''
  }
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, subColor, alert }) {
  return (
    <div className={`dash-stat-card${alert ? ' dash-stat-card--alert' : ''}`}>
      <div className="dash-stat-label">{label}</div>
      <div className={`dash-stat-value${alert ? ' dash-stat-value--alert' : ''}`}>{value}</div>
      {sub && <div className="dash-stat-sub" style={subColor ? { color: subColor } : {}}>{sub}</div>}
    </div>
  )
}

// ─── MiniBarChart ─────────────────────────────────────────────────────────────

function MiniBarChart({ data }) {
  // data: [{ label, value }]
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="mini-bar-chart">
      {data.map((d) => (
        <div key={d.label} className="mini-bar-col">
          <div className="mini-bar-track">
            <div
              className="mini-bar-fill"
              style={{ height: `${Math.round((d.value / max) * 100)}%` }}
              title={formatCurrency(d.value)}
            />
          </div>
          <span className="mini-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

const DONUT_COLORS = {
  Settled: '#10b981',
  Pending: '#f59e0b',
  Failed:  '#ef4444',
}

function DonutChart({ segments }) {
  // segments: [{ label, value, color }]
  const total = segments.reduce((s, g) => s + g.value, 0)
  if (total === 0) return <div className="donut-empty">No data</div>

  const r = 54, cx = 64, cy = 64
  const circumference = 2 * Math.PI * r
  let offset = 0

  const arcs = segments.map((seg) => {
    const pct = seg.value / total
    const dash = pct * circumference
    const arc = { ...seg, dash, offset, pct }
    offset += dash
    return arc
  })

  return (
    <div className="donut-wrapper">
      <svg viewBox="0 0 128 128" className="donut-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="18" />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="18"
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '64px 64px' }}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="donut-center-num">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="donut-center-label">total</text>
      </svg>
      <div className="donut-legend">
        {segments.map((seg) => (
          <div key={seg.label} className="donut-legend-row">
            <span className="donut-legend-dot" style={{ background: seg.color }} />
            <span className="donut-legend-name">{seg.label}</span>
            <span className="donut-legend-val">{seg.value}</span>
            <span className="donut-legend-pct">{total > 0 ? Math.round((seg.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── RecentTransactions ───────────────────────────────────────────────────────

function RecentTransactions({ transactions, onNavigate }) {
  const recent = [...transactions]
    .sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1))
    .slice(0, 8)

  if (recent.length === 0) {
    return <div className="dash-empty">No transactions yet.</div>
  }

  return (
    <div className="recent-table-wrapper">
      <table className="recent-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Account Holder</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((tx) => (
            <tr key={tx.id}>
              <td className="recent-date">{tx.transactionDate}</td>
              <td>
                <div className="recent-holder">
                  <div className="avatar-sm" style={{ background: avatarColor(tx.accountHolderName) }}>
                    {getInitials(tx.accountHolderName)}
                  </div>
                  <span>{tx.accountHolderName}</span>
                </div>
              </td>
              <td className="recent-amount">{formatCurrency(tx.amount)}</td>
              <td>
                <span className={`status-badge ${statusClass(tx.status)}`}>{tx.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="dash-view-all" onClick={() => onNavigate('transactions')}>
        View all transactions →
      </button>
    </div>
  )
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage({ transactions, loading, onNavigate }) {
  const stats = useMemo(() => {
    const total   = transactions.reduce((s, tx) => s + (tx.amount || 0), 0)
    const settled = transactions.filter(tx => tx.status === 'Settled')
    const pending = transactions.filter(tx => tx.status === 'Pending')
    const failed  = transactions.filter(tx => tx.status === 'Failed')
    return { total, settled, pending, failed, count: transactions.length }
  }, [transactions])

  // Monthly volume for bar chart — last 6 months
  const monthlyData = useMemo(() => {
    const map = {}
    transactions.forEach(tx => {
      const [year, month] = tx.transactionDate.split('-')
      const key = `${year}-${month}`
      map[key] = (map[key] || 0) + (tx.amount || 0)
    })
    const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    const last6  = sorted.slice(-6)
    return last6.map(([key, value]) => ({
      label: new Date(key + '-01').toLocaleString('default', { month: 'short' }),
      value,
    }))
  }, [transactions])

  const donutSegments = useMemo(() => [
    { label: 'Settled', value: stats.settled.length, color: DONUT_COLORS.Settled },
    { label: 'Pending', value: stats.pending.length, color: DONUT_COLORS.Pending },
    { label: 'Failed',  value: stats.failed.length,  color: DONUT_COLORS.Failed  },
  ], [stats])

  // Top 5 customers by volume
  const topCustomers = useMemo(() => {
    const map = {}
    transactions.forEach(tx => {
      if (!map[tx.accountHolderName]) map[tx.accountHolderName] = { name: tx.accountHolderName, total: 0, count: 0 }
      map[tx.accountHolderName].total += tx.amount || 0
      map[tx.accountHolderName].count += 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [transactions])

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-spinner" />
        <span>Loading dashboard…</span>
      </div>
    )
  }

  return (
    <div className="dash-page">
      {/* ── Stat cards ── */}
      <div className="dash-stats-row">
        <StatCard
          label="Total Volume"
          value={formatCurrency(stats.total)}
          sub={`${stats.count} transaction${stats.count !== 1 ? 's' : ''}`}
          subColor="#16a34a"
        />
        <StatCard
          label="Settled"
          value={formatCurrency(stats.settled.reduce((s, tx) => s + tx.amount, 0))}
          sub={`${stats.settled.length} transactions`}
        />
        <StatCard
          label="Pending"
          value={formatCurrency(stats.pending.reduce((s, tx) => s + tx.amount, 0))}
          sub={`${stats.pending.length} transactions`}
        />
        <StatCard
          label="Failed"
          value={String(stats.failed.length)}
          sub={`${stats.failed.length} failed`}
          alert
        />
      </div>

      {/* ── Charts row ── */}
      <div className="dash-charts-row">
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Monthly Volume</h2>
            <span className="dash-card-sub">Last {monthlyData.length} months</span>
          </div>
          {monthlyData.length > 0
            ? <MiniBarChart data={monthlyData} />
            : <div className="dash-empty">Not enough data</div>
          }
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Status Breakdown</h2>
            <span className="dash-card-sub">All time</span>
          </div>
          <DonutChart segments={donutSegments} />
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Top Customers</h2>
            <span className="dash-card-sub">By volume</span>
          </div>
          <div className="top-customers">
            {topCustomers.length === 0 && <div className="dash-empty">No data</div>}
            {topCustomers.map((c, i) => (
              <div key={c.name} className="top-customer-row">
                <span className="top-customer-rank">#{i + 1}</span>
                <div className="avatar-sm" style={{ background: avatarColor(c.name) }}>
                  {getInitials(c.name)}
                </div>
                <div className="top-customer-info">
                  <span className="top-customer-name">{c.name}</span>
                  <span className="top-customer-count">{c.count} txn{c.count !== 1 ? 's' : ''}</span>
                </div>
                <span className="top-customer-amount">{formatCurrency(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent transactions ── */}
      <div className="dash-card dash-card--full">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Recent Transactions</h2>
          <span className="dash-card-sub">Last 8</span>
        </div>
        <RecentTransactions transactions={transactions} onNavigate={onNavigate} />
      </div>
    </div>
  )
}
