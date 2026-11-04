import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { exportCsv } from './exportCsv'
import { getDataSourceOrderColumn } from './businessData'
import { businessDate, calculateFinancialSummary, isFinanciallyCompleted, isRecognizedSale, netItemSales, refundValue } from './businessMetrics'

const CURRENCY = new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })
const EXPENSE_CATEGORIES = [
  'Product purchasing', 'Stitching and manufacturing', 'Packaging',
  'Courier and delivery', 'Marketing and advertisements', 'Rent and utilities', 'Other'
]
const DATA_TABLES = [
  ['orders', 'orders', 'id,order_number,user_id,status,payment_method,payment_status,subtotal,discount_total,shipping_total,total,coupon_code,created_at'],
  ['items', 'order_items', 'id,order_id,product_id,variant_id,product_name,sku,selected_size,selected_color,quantity,unit_price,line_total'],
  ['itemCosts', 'order_item_costs', 'order_item_id,unit_cost'],
  ['products', 'products', 'id,name,category_id,status,stock_quantity,price'],
  ['categories', 'categories', 'id,name'],
  ['variants', 'product_variants', 'id,product_id,size,color,stock_quantity,low_stock_threshold,is_active,products(name)'],
  ['variantCosts', 'product_variant_costs', 'variant_id,unit_cost'],
  ['profiles', 'profiles', 'id,role,created_at'],
  ['expenses', 'expenses', 'id,category,amount,expense_date,recipient,notes,receipt_path,created_at'],
  ['suppliers', 'suppliers', 'id,name,contact_name,email,phone,address,notes,is_active,created_at'],
  ['purchases', 'purchase_orders', 'id,purchase_number,supplier_id,status,notes,created_at,suppliers(name),purchase_order_items(id,variant_id,quantity,received_quantity,unit_cost,product_variants(size,color,products(name)))'],
  ['payments', 'supplier_payments', 'id,supplier_id,purchase_order_id,amount,paid_at,method,reference,notes,suppliers(name)']
]
const ALL_DATA_KEYS = DATA_TABLES.map(([key]) => key)
const EXPENSE_DATA_KEYS = ['expenses']
const SUPPLIER_DATA_KEYS = ['suppliers', 'purchases', 'payments']
const PURCHASE_DATA_KEYS = ['suppliers', 'purchases', 'payments', 'variants']
const EMPTY_DATA = Object.fromEntries(DATA_TABLES.map(([key]) => [key, []]))
const isoDate = (date) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const today = () => businessDate(new Date())
const shiftDate = (date, days) => {
  const shifted = new Date(`${date}T12:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return isoDate(shifted)
}
const monthDate = (date, monthOffset = 0) => {
  const [year, month] = date.split('-').map(Number)
  return isoDate(new Date(Date.UTC(year, month - 1 + monthOffset, 1)))
}
const money = (amount) => CURRENCY.format(Number(amount || 0))
const dateLabel = (date) => new Date(`${date}T12:00:00+05:00`).toLocaleDateString('en-PK', {
  timeZone: 'Asia/Karachi', month: 'short', day: 'numeric'
})

async function loadAll(table, selection) {
  const pageSize = 1000
  const result = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from(table).select(selection)
      .order(getDataSourceOrderColumn(table)).range(offset, offset + pageSize - 1)
    if (error) throw error
    result.push(...(data || []))
    if (!data || data.length < pageSize) return result
  }
}

function useBusinessData(keys = ALL_DATA_KEYS) {
  const [reload, setReload] = useState(0)
  const [data, setData] = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState(supabase ? '' : 'Supabase is not configured.')
  const refresh = useCallback(() => {
    setError('')
    setLoading(Boolean(supabase))
    setReload((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    Promise.all(DATA_TABLES.filter(([key]) => keys.includes(key))
      .map(async ([key, table, selection]) => [key, await loadAll(table, selection)]))
      .then((entries) => {
        if (active) setData(Object.fromEntries(entries))
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Business data could not be loaded.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [keys, reload])

  return { data, loading, error, refresh }
}

function ErrorNotice({ error }) {
  return error ? <p className="stage-two-error" role="alert">{error}</p> : null
}

function DateFilter({ range, setRange, start, setStart, end, setEnd }) {
  const applyPreset = (value) => {
    const current = today()
    setRange(value)
    if (value === 'today') {
      setStart(current)
      setEnd(current)
    } else if (value === '7days') {
      setStart(shiftDate(current, -6))
      setEnd(current)
    } else if (value === '30days') {
      setStart(shiftDate(current, -29))
      setEnd(current)
    } else if (value === 'this-month') {
      setStart(monthDate(current))
      setEnd(current)
    } else if (value === 'last-month') {
      setStart(monthDate(current, -1))
      setEnd(shiftDate(monthDate(current), -1))
    }
  }
  return (
    <div className="stage-three-date-filter">
      <label>Period<select value={range} onChange={(event) => applyPreset(event.target.value)}>
        <option value="today">Today</option><option value="7days">Last 7 days</option>
        <option value="30days">Last 30 days</option><option value="this-month">This month</option>
        <option value="last-month">Last month</option><option value="custom">Custom range</option>
      </select></label>
      {range === 'custom' && <>
        <label>From<input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} /></label>
        <label>To<input type="date" value={end} min={start} max={today()} onChange={(event) => setEnd(event.target.value)} /></label>
      </>}
    </div>
  )
}

function Metric({ title, value, note }) {
  return <article className="admin-stat-card"><div className="admin-stat-card-top"><span>{title}</span><span className="admin-stat-indicator" aria-hidden="true" /></div><strong>{value}</strong><p>{note}</p></article>
}

function BarChart({ title, rows, valueLabel = 'Sales' }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <article className="admin-chart-card stage-three-chart">
      <div><h2>{title}</h2><span>{valueLabel.toUpperCase()}</span></div>
      {rows.length ? <div className="stage-three-bars">{rows.map((row) => (
        <div className="stage-three-bar-row" key={row.label} title={`${row.label}: ${typeof row.value === 'number' && valueLabel !== 'Units' && valueLabel !== 'Orders' ? money(row.value) : row.value}`}>
          <span>{row.label}</span><div><i style={{ width: `${Math.max(2, row.value / max * 100)}%` }} /></div>
          <strong>{valueLabel === 'Units' || valueLabel === 'Orders' ? row.value : money(row.value)}</strong>
        </div>
      ))}</div> : <p className="stage-three-empty">No records in this date range.</p>}
    </article>
  )
}

function TrendChart({ title, rows, series, valueLabel }) {
  const width = 720
  const height = 205
  const padding = 18
  const values = rows.flatMap((row) => series.map((item) => Number(row[item.key] || 0)))
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const x = (index) => rows.length < 2 ? width / 2 : padding + index * (width - padding * 2) / (rows.length - 1)
  const y = (value) => height - padding - ((Number(value || 0) - min) / (max - min)) * (height - padding * 2)
  return (
    <article className="admin-chart-card stage-three-chart stage-three-trend">
      <div><h2>{title}</h2><span>{valueLabel.toUpperCase()}</span></div>
      {rows.length ? <>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          {[0, 1, 2, 3].map((line) => <line key={line} x1={padding} x2={width - padding} y1={padding + line * (height - padding * 2) / 3} y2={padding + line * (height - padding * 2) / 3} className="stage-three-gridline" />)}
          {series.map((item) => <polyline key={item.key} points={rows.map((row, index) => `${x(index)},${y(row[item.key])}`).join(' ')} className={`stage-three-line ${item.className}`} />)}
          {rows.map((row, index) => <circle key={row.label} cx={x(index)} cy={y(row[series[0].key])} r="3" className="stage-three-dot"><title>{`${row.label}: ${money(row[series[0].key])}`}</title></circle>)}
        </svg>
        <div className="stage-three-chart-labels"><span>{rows[0].label}</span><span>{rows[Math.floor(rows.length / 2)].label}</span><span>{rows[rows.length - 1].label}</span></div>
        <div className="stage-three-legend">{series.map((item) => <span key={item.key}><i className={item.className} />{item.label}</span>)}</div>
      </> : <p className="stage-three-empty">No records in this date range.</p>}
    </article>
  )
}

function summarize(data, start, end, interval = 'day') {
  const financials = calculateFinancialSummary(data.orders, start, end)
  const { ordersInRange, salesOrders, recognized } = financials
  const costByItemId = new Map(data.itemCosts.map((item) => [item.order_item_id, Number(item.unit_cost)]))
  const items = data.items.filter((item) => recognized.some((order) => order.id === item.order_id))
    .map((item) => ({ ...item, unit_cost: costByItemId.get(item.id) }))
  const expenses = data.expenses.filter((expense) => expense.expense_date >= start && expense.expense_date <= end)
  const { gross, discounts, refundedAmount: refunds, net, outstandingCod: outstanding } = financials
  const costMissing = items.some((item) => item.unit_cost == null)
  const cost = items.reduce((sum, item) => sum + Number(item.unit_cost || 0) * item.quantity, 0)
  const overhead = expenses.filter((expense) => !['Product purchasing', 'Stitching and manufacturing'].includes(expense.category))
    .reduce((sum, expense) => sum + Number(expense.amount), 0)
  const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const intervalDate = new Map()
  const bucketKey = (date) => {
    if (interval === 'month') return date.slice(0, 7)
    if (interval === 'week') {
      const day = new Date(`${date}T12:00:00Z`)
      day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
      return isoDate(day)
    }
    return date
  }
  const getBucket = (date) => {
    const key = bucketKey(date)
    if (!intervalDate.has(key)) intervalDate.set(key, { label: dateLabel(key.length === 7 ? `${key}-01` : key), sales: 0, revenue: 0, expenses: 0, cost: 0, overhead: 0, profit: 0, units: 0 })
    return intervalDate.get(key)
  }
  for (const order of recognized) {
    const bucket = getBucket(businessDate(order.created_at))
    const amount = Math.max(0, Number(order.total) - (order.status === 'refunded' ? Number(order.total) : 0))
    bucket.revenue += amount
    bucket.sales += 1
  }
  for (const item of items) {
    const order = salesOrders.find((candidate) => candidate.id === item.order_id)
    if (!order) continue
    const bucket = getBucket(businessDate(order.created_at))
    bucket.units += item.quantity
    bucket.cost += Number(item.unit_cost || 0) * item.quantity
  }
  for (const expense of expenses) {
    const bucket = getBucket(expense.expense_date)
    bucket.expenses += Number(expense.amount)
    if (!['Product purchasing', 'Stitching and manufacturing'].includes(expense.category)) bucket.overhead += Number(expense.amount)
  }
  const trend = [...intervalDate.entries()].sort(([left], [right]) => left.localeCompare(right))
  for (const [, point] of trend) point.profit = point.revenue - point.cost - point.overhead

  const itemsById = new Map(data.products.map((product) => [product.id, product]))
  const orderById = new Map(data.orders.map((order) => [order.id, order]))
  const productSales = new Map()
  const categorySales = new Map()
  const sizeSales = new Map()
  const colorSales = new Map()
  for (const item of items) {
    const product = itemsById.get(item.product_id)
    const order = orderById.get(item.order_id)
    if (!order || !isRecognizedSale(order)) continue
    const amount = netItemSales(item, order)
    const productName = product?.name || item.product_name || 'Deleted product'
    productSales.set(productName, (productSales.get(productName) || 0) + amount)
    const categoryName = data.categories.find((category) => category.id === product?.category_id)?.name || 'Uncategorized'
    categorySales.set(categoryName, (categorySales.get(categoryName) || 0) + amount)
    if (item.selected_size) sizeSales.set(item.selected_size, (sizeSales.get(item.selected_size) || 0) + item.quantity)
    if (item.selected_color) colorSales.set(item.selected_color, (colorSales.get(item.selected_color) || 0) + item.quantity)
  }
  const rank = (map, quantity = false) => [...map.entries()].map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8).map((row) => ({ ...row, value: quantity ? row.value : Math.round(row.value) }))
  const activeProducts = data.products.filter((product) => product.status === 'active')
  const activeProductIds = new Set(activeProducts.map((product) => product.id))
  const variantRows = data.variants.filter((variant) => variant.is_active && activeProductIds.has(variant.product_id))
  const lowStockVariants = variantRows.filter((variant) => variant.stock_quantity > 0 && variant.stock_quantity <= variant.low_stock_threshold)
  const outOfStockVariants = variantRows.filter((variant) => variant.stock_quantity === 0)
  const stockByProduct = new Map()
  for (const variant of variantRows) stockByProduct.set(variant.product_id, (stockByProduct.get(variant.product_id) || 0) + variant.stock_quantity)
  const statuses = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded']
    .map((status) => ({ label: status, value: ordersInRange.filter((order) => order.status === status).length }))
    .filter((item) => item.value > 0)
  return {
    start, end, ordersInRange, recognized, salesOrders, items, expenses, trend: trend.map(([, row]) => row),
    gross, discounts, refunds, net, collected: financials.collected, cost, costMissing, overhead, expensesTotal, outstanding,
    productRows: rank(productSales), categoryRows: rank(categorySales), sizeRows: rank(sizeSales, true),
    colorRows: rank(colorSales, true), statusRows: statuses,
    lowStock: new Set(lowStockVariants.map((variant) => variant.product_id)).size,
    outOfStock: activeProducts.filter((product) => (stockByProduct.get(product.id) || 0) === 0).length,
    lowStockVariants: lowStockVariants.length, outOfStockVariants: outOfStockVariants.length,
    units: items.filter((item) => isRecognizedSale(orderById.get(item.order_id))).reduce((sum, item) => sum + item.quantity, 0),
    activeProducts: activeProducts.length, customerCount: data.profiles.filter((profile) => profile.role === 'customer').length,
    outstandingAll: data.orders.filter((order) => order.payment_method === 'cod' && ['pending', 'unpaid'].includes(order.payment_status)
      && !['cancelled', 'returned', 'refunded'].includes(order.status)).reduce((sum, order) => sum + Number(order.total), 0)
  }
}

function useDates() {
  const [range, setRange] = useState('30days')
  const [start, setStart] = useState(shiftDate(today(), -29))
  const [end, setEnd] = useState(today())
  return { range, setRange, start, setStart, end, setEnd }
}

export function AdminOverview() {
  const { data, loading, error } = useBusinessData()
  const dates = useDates()
  const [interval, setInterval] = useState('day')
  const [currentDate] = useState(today)
  const [currentMonthStart] = useState(() => {
    return monthDate(today())
  })
  const report = useMemo(() => summarize(data, dates.start, dates.end, interval), [data, dates.start, dates.end, interval])
  const todayReport = useMemo(() => summarize(data, currentDate, currentDate), [data, currentDate])
  const weekReport = useMemo(() => summarize(data, shiftDate(currentDate, -6), currentDate), [data, currentDate])
  const monthReport = useMemo(() => summarize(data, currentMonthStart, currentDate), [data, currentMonthStart, currentDate])
  const eligible = data.orders.filter(isFinanciallyCompleted)
  const totalGross = eligible.reduce((sum, order) => sum + Number(order.subtotal), 0)
  const totalDiscount = eligible.reduce((sum, order) => sum + Number(order.discount_total), 0)
  const totalRefunds = data.orders.filter((order) => order.status === 'refunded' || order.payment_status === 'refunded')
    .reduce((sum, order) => sum + refundValue(order), 0)
  const allTimeNet = Math.max(0, totalGross - totalDiscount - totalRefunds)

  return (
    <section className="stage-three-workspace">
      <div className="admin-page-heading"><div><p className="admin-eyebrow">YOUR STORE AT A GLANCE</p><h1>Business overview</h1></div><span className="admin-data-state">{loading ? 'Loading live data…' : 'Live database data'}</span></div>
      <ErrorNotice error={error} />
      {!loading && !error && data.orders.length === 0 && <p className="stage-three-empty-note">No orders have been recorded yet. Live metrics will update when customers check out.</p>}
      <div className="stage-three-date-row"><DateFilter {...dates} /><label>Chart interval<select value={interval} onChange={(event) => setInterval(event.target.value)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label></div>
      <section className="admin-stat-grid stage-three-metrics" aria-label="Store metrics">
        <Metric title="Total net sales" value={money(allTimeNet)} note={`Gross ${money(totalGross)} · discounts ${money(totalDiscount)} · refunds ${money(totalRefunds)}`} />
        <Metric title="Sales in selected period" value={money(report.net)} note={`${report.recognized.length} recognized orders`} />
        <Metric title="Today's sales" value={money(todayReport.net)} note={`${todayReport.recognized.length} recognized orders`} />
        <Metric title="Last 7 days" value={money(weekReport.net)} note={`${weekReport.recognized.length} recognized orders`} />
        <Metric title="This month" value={money(monthReport.net)} note={`${monthReport.recognized.length} recognized orders`} />
        <Metric title="Total orders" value={data.orders.length.toLocaleString('en-PK')} note={`${data.orders.filter((order) => order.status === 'pending').length} pending`} />
        <Metric title="Delivered" value={data.orders.filter((order) => order.status === 'delivered').length.toLocaleString('en-PK')} note={`${data.orders.filter((order) => order.status === 'cancelled').length} cancelled`} />
        <Metric title="Customers" value={data.profiles.filter((profile) => profile.role === 'customer').length.toLocaleString('en-PK')} note="Registered customer accounts" />
        <Metric title="Active products" value={report.activeProducts.toLocaleString('en-PK')} note="Published products" />
        <Metric title="Units sold" value={report.units.toLocaleString('en-PK')} note="Recognized orders in period" />
        <Metric title="Average order value" value={money(report.recognized.length ? report.recognized.reduce((sum, order) => sum + Number(order.total), 0) / report.recognized.length : 0)} note="Average order total for paid/delivered orders" />
        <Metric title="Low-stock products" value={`${report.lowStock} low · ${report.outOfStock} out`} note={`${report.lowStockVariants} low and ${report.outOfStockVariants} out-of-stock variants`} />
        <Metric title="Outstanding COD" value={money(report.outstandingAll)} note="Unpaid COD orders, excluding cancelled/returned" />
        <Metric title="Collected payments" value={money(report.collected)} note="Orders recorded as paid in selected range" />
        <Metric title="Expenses in range" value={money(report.expensesTotal)} note={`${report.expenses.length} expense records`} />
      </section>
      {loading ? <p className="stage-two-loading">Loading analytics…</p> : !error && <>
        <div className="admin-chart-grid stage-three-chart-grid">
          <TrendChart title="Sales, revenue, expenses and estimated profit" rows={report.trend} valueLabel="PKR" series={[
            { key: 'revenue', label: 'Revenue', className: 'is-revenue' },
            { key: 'expenses', label: 'Expenses', className: 'is-expenses' },
            { key: 'profit', label: 'Estimated profit', className: 'is-profit' }
          ]} />
          <BarChart title="Order status distribution" rows={report.statusRows} valueLabel="Orders" />
          <BarChart title="Best-selling products" rows={report.productRows} />
          <BarChart title="Category-wise sales" rows={report.categoryRows} />
          <BarChart title="Sales by size" rows={report.sizeRows} valueLabel="Units" />
          <BarChart title="Sales by color" rows={report.colorRows} valueLabel="Units" />
          <BarChart title="Expenses by category" rows={[...data.expenses.filter((expense) => expense.expense_date >= dates.start && expense.expense_date <= dates.end)
            .reduce((map, expense) => map.set(expense.category, (map.get(expense.category) || 0) + Number(expense.amount)), new Map())]
            .map(([label, value]) => ({ label, value }))} />
        </div>
        <p className="stage-three-financial-note">Estimated profit is net recognized sales less recorded inventory cost and operating expenses. Product purchasing and stitching/manufacturing expenses are excluded from overhead to avoid double-counting against product cost. {report.costMissing ? 'Some order items have no recorded cost (typically older orders), so profit is incomplete.' : 'All recognized order items in this period have a recorded cost.'}</p>
      </>}
    </section>
  )
}

function WorkspaceHeader({ eyebrow, title, action }) {
  return <div className="admin-page-heading"><div><p className="admin-eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</div>
}

function TextField({ label, value, onChange, type = 'text', required = false }) {
  return <label>{label}<input type={type} value={value ?? ''} required={required} onChange={(event) => onChange(event.target.value)} /></label>
}

function ExpenseWorkspace() {
  const { data, loading, error, refresh } = useBusinessData(EXPENSE_DATA_KEYS)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [start, setStart] = useState(shiftDate(today(), -29))
  const [end, setEnd] = useState(today())
  const [receipt, setReceipt] = useState(null)
  const rows = data.expenses.filter((expense) => expense.expense_date >= start && expense.expense_date <= end)
  const beginEdit = (expense = null) => {
    setFormError('')
    setNotice('')
    setReceipt(null)
    setEditing(expense ? { ...expense } : {
      category: EXPENSE_CATEGORIES[0], amount: '', expense_date: today(), recipient: '', notes: '', receipt_path: null
    })
  }
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      let receiptPath = editing.receipt_path
      if (receipt) {
        const receiptTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
        if (!receiptTypes.includes(receipt.type)) throw new Error('Receipt must be a JPEG, PNG, WebP, GIF, or PDF.')
        if (receipt.size > 10 * 1024 * 1024) throw new Error('Receipt must be 10 MB or smaller.')
        const path = `${crypto.randomUUID()}/${receipt.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`
        const { error: uploadError } = await supabase.storage.from('expense-receipts').upload(path, receipt, { contentType: receipt.type, upsert: false })
        if (uploadError) throw uploadError
        receiptPath = path
      }
      const { error: saveError } = await supabase.rpc('admin_save_expense', {
        p_expense: { ...editing, amount: Number(editing.amount), receipt_path: receiptPath }
      })
      if (saveError) throw saveError
      setEditing(null)
      setNotice('Expense saved.')
      refresh()
    } catch (saveError) {
      setFormError(saveError.message || 'Expense could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  const openReceipt = async (expense) => {
    if (!expense.receipt_path || !supabase) return
    const { data: signed, error: signError } = await supabase.storage.from('expense-receipts').createSignedUrl(expense.receipt_path, 60)
    if (signError) setFormError(signError.message)
    else {
      const link = document.createElement('a')
      link.href = signed.signedUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
    }
  }
  return <section className="stage-three-workspace">
    <WorkspaceHeader eyebrow="FINANCE" title="Expenses" action={<button className="stage-two-button stage-two-button-primary" onClick={() => beginEdit()}>＋ Add expense</button>} />
    <div className="stage-three-date-row"><label>From<input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} /></label><label>To<input type="date" value={end} min={start} max={today()} onChange={(event) => setEnd(event.target.value)} /></label><button className="stage-two-button" onClick={() => exportCsv('little-star-expenses.csv', rows.map(({ category, amount, expense_date, recipient, notes }) => ({ category, amount, currency: 'PKR', date: expense_date, recipient, notes })))}>Export expenses CSV</button></div>
    <ErrorNotice error={error || formError} />{notice && <p className="stage-two-notice" role="status">{notice}</p>}
    {loading ? <p className="stage-two-loading">Loading expenses…</p> : <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Date</th><th>Category</th><th>Recipient</th><th>Amount</th><th>Notes / receipt</th><th /></tr></thead><tbody>
      {rows.map((expense) => <tr key={expense.id}><td>{expense.expense_date}</td><td>{expense.category}</td><td>{expense.recipient}</td><td>{money(expense.amount)}</td><td>{expense.notes || '—'}{expense.receipt_path && <button onClick={() => openReceipt(expense)}>Receipt</button>}</td><td><button onClick={() => beginEdit(expense)}>Edit</button></td></tr>)}
    </tbody></table>{!rows.length && <p className="stage-two-empty">No expenses recorded for this period.</p>}</div>}
    {editing && <div className="stage-two-modal-backdrop"><section className="stage-two-modal" role="dialog" aria-modal="true" aria-labelledby="expense-title"><header><h2 id="expense-title">{editing.id ? 'Edit expense' : 'Add expense'}</h2><button type="button" onClick={() => setEditing(null)}>×</button></header><form className="stage-two-form" onSubmit={submit}>
      <label>Category<select required value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })}>{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      <TextField label="Amount (PKR)" type="number" value={editing.amount} required onChange={(amount) => setEditing({ ...editing, amount })} />
      <label>Date<input type="date" max={today()} value={editing.expense_date} required onChange={(event) => setEditing({ ...editing, expense_date: event.target.value })} /></label>
      <TextField label="Recipient" value={editing.recipient} required onChange={(recipient) => setEditing({ ...editing, recipient })} />
      <label>Notes<textarea value={editing.notes || ''} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} /></label>
      <label>Receipt attachment <span className="stage-three-muted">(optional image or PDF, up to 10 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={(event) => setReceipt(event.target.files?.[0] || null)} /></label>
      <div className="stage-two-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="stage-two-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button></div>
    </form></section></div>}
  </section>
}

function SupplierWorkspace() {
  const { data, loading, error, refresh } = useBusinessData(SUPPLIER_DATA_KEYS)
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const editSupplier = (supplier = null) => {
    setNotice('')
    setFormError('')
    setEditing(supplier ? { ...supplier } : { name: '', contact_name: '', email: '', phone: '', address: '', notes: '', is_active: true })
  }
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const { error: saveError } = await supabase.rpc('admin_save_supplier', { p_supplier: editing })
      if (saveError) throw saveError
      setEditing(null)
      setNotice('Supplier saved.')
      refresh()
    } catch (saveError) {
      setFormError(saveError.message || 'Supplier could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  const purchaseCount = (supplierId) => data.purchases.filter((purchase) => purchase.supplier_id === supplierId).length
  const paymentSum = (supplierId) => data.payments.filter((payment) => payment.supplier_id === supplierId).reduce((sum, payment) => sum + Number(payment.amount), 0)
  return <section className="stage-three-workspace">
    <WorkspaceHeader eyebrow="SUPPLIER DIRECTORY" title="Suppliers" action={<button className="stage-two-button stage-two-button-primary" onClick={() => editSupplier()}>＋ Add supplier</button>} />
    <ErrorNotice error={error || formError} />{notice && <p className="stage-two-notice" role="status">{notice}</p>}
    {loading ? <p className="stage-two-loading">Loading suppliers…</p> : <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Supplier</th><th>Contact</th><th>Phone / email</th><th>Purchase orders</th><th>Recorded payments</th><th>Status</th><th /></tr></thead><tbody>
      {data.suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.name}</strong><small>{supplier.address || ''}</small></td><td>{supplier.contact_name || '—'}</td><td>{supplier.phone || '—'}<small>{supplier.email || ''}</small></td><td>{purchaseCount(supplier.id)}</td><td>{money(paymentSum(supplier.id))}</td><td>{supplier.is_active ? 'Active' : 'Inactive'}</td><td><button onClick={() => editSupplier(supplier)}>Edit</button></td></tr>)}
    </tbody></table>{!data.suppliers.length && <p className="stage-two-empty">No suppliers yet.</p>}</div>}
    {editing && <div className="stage-two-modal-backdrop"><section className="stage-two-modal" role="dialog" aria-modal="true"><header><h2>{editing.id ? 'Edit supplier' : 'Add supplier'}</h2><button type="button" onClick={() => setEditing(null)}>×</button></header><form className="stage-two-form" onSubmit={submit}>
      <TextField label="Business name" value={editing.name} required onChange={(name) => setEditing({ ...editing, name })} />
      <TextField label="Contact person" value={editing.contact_name} onChange={(contact_name) => setEditing({ ...editing, contact_name })} />
      <TextField label="Email" type="email" value={editing.email} onChange={(email) => setEditing({ ...editing, email })} />
      <TextField label="Phone" value={editing.phone} onChange={(phone) => setEditing({ ...editing, phone })} />
      <label>Address<textarea value={editing.address || ''} onChange={(event) => setEditing({ ...editing, address: event.target.value })} /></label>
      <label>Notes<textarea value={editing.notes || ''} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} /></label>
      <label className="stage-two-checkbox"><input type="checkbox" checked={editing.is_active} onChange={(event) => setEditing({ ...editing, is_active: event.target.checked })} />Active supplier</label>
      <div className="stage-two-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="stage-two-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save supplier'}</button></div>
    </form></section></div>}
  </section>
}

function PurchaseWorkspace() {
  const { data, loading, error, refresh } = useBusinessData(PURCHASE_DATA_KEYS)
  const [creating, setCreating] = useState(false)
  const [receiving, setReceiving] = useState(null)
  const [paying, setPaying] = useState(null)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [purchaseForm, setPurchaseForm] = useState({ supplier_id: '', notes: '', items: [{ variant_id: '', quantity: '1', unit_cost: '' }] })
  const [receiveQuantities, setReceiveQuantities] = useState({})
  const [paymentForm, setPaymentForm] = useState({ amount: '', paid_at: today(), method: 'cash', reference: '', notes: '' })
  const variants = data.variants.filter((variant) => variant.is_active)
  const startCreate = () => {
    setFormError('')
    setPurchaseForm({ supplier_id: data.suppliers.find((supplier) => supplier.is_active)?.id || '', notes: '', items: [{ variant_id: '', quantity: '1', unit_cost: '' }] })
    setCreating(true)
  }
  const createPurchase = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      const selectedVariants = purchaseForm.items.map((item) => item.variant_id).filter(Boolean)
      if (new Set(selectedVariants).size !== selectedVariants.length) {
        throw new Error('Each product variant can only appear once in a purchase order.')
      }
      const { error: createError } = await supabase.rpc('admin_create_purchase', {
        p_supplier_id: purchaseForm.supplier_id, p_notes: purchaseForm.notes,
        p_items: purchaseForm.items.map((item) => ({ ...item, quantity: Number(item.quantity), unit_cost: Number(item.unit_cost) }))
      })
      if (createError) throw createError
      setCreating(false)
      setNotice('Purchase order created. Stock will change when quantities are received.')
      refresh()
    } catch (createError) {
      setFormError(createError.message || 'Purchase order could not be created.')
    } finally {
      setBusy(false)
    }
  }
  const receivePurchase = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      const items = receiving.purchase_order_items.map((item) => ({
        item_id: item.id, quantity: Number(receiveQuantities[item.id] || 0)
      })).filter((item) => item.quantity > 0)
      const { error: receiveError } = await supabase.rpc('admin_receive_purchase', { p_purchase_id: receiving.id, p_items: items })
      if (receiveError) throw receiveError
      setReceiving(null)
      setNotice('Received quantities were recorded and inventory updated.')
      refresh()
    } catch (receiveError) {
      setFormError(receiveError.message || 'Purchase receipt could not be recorded.')
    } finally {
      setBusy(false)
    }
  }
  const recordPayment = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      const { error: paymentError } = await supabase.rpc('admin_record_supplier_payment', {
        p_supplier_id: paying.supplier_id, p_purchase_order_id: paying.id,
        p_amount: Number(paymentForm.amount), p_paid_at: paymentForm.paid_at,
        p_method: paymentForm.method, p_reference: paymentForm.reference, p_notes: paymentForm.notes
      })
      if (paymentError) throw paymentError
      setPaying(null)
      setNotice('Supplier payment recorded.')
      refresh()
    } catch (paymentError) {
      setFormError(paymentError.message || 'Supplier payment could not be recorded.')
    } finally {
      setBusy(false)
    }
  }
  const allPurchaseItems = data.purchases.flatMap((purchase) => (purchase.purchase_order_items || []).map((item) => ({
    purchase: `#${purchase.purchase_number}`, supplier: purchase.suppliers?.name || '—',
    product: item.product_variants?.products?.name || 'Deleted product',
    variant: `${item.product_variants?.size || ''} / ${item.product_variants?.color || ''}`,
    quantity: item.quantity, received: item.received_quantity, unit_cost: item.unit_cost, total: item.quantity * item.unit_cost
  })))
  return <section className="stage-three-workspace">
    <WorkspaceHeader eyebrow="PROCUREMENT & STOCK RECEIPTS" title="Purchases" action={<div className="stage-three-actions"><button className="stage-two-button" onClick={() => exportCsv('little-star-purchases.csv', allPurchaseItems)}>Export purchases CSV</button><button className="stage-two-button stage-two-button-primary" onClick={startCreate}>＋ New purchase order</button></div>} />
    <ErrorNotice error={error || formError} />{notice && <p className="stage-two-notice" role="status">{notice}</p>}
    {loading ? <p className="stage-two-loading">Loading purchases…</p> : <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Purchase</th><th>Supplier</th><th>Date</th><th>Items / total</th><th>Status</th><th>Payments</th><th>Actions</th></tr></thead><tbody>
      {data.purchases.map((purchase) => {
        const items = purchase.purchase_order_items || []
        const total = items.reduce((sum, item) => sum + item.quantity * Number(item.unit_cost), 0)
        const paid = data.payments.filter((payment) => payment.purchase_order_id === purchase.id).reduce((sum, payment) => sum + Number(payment.amount), 0)
        return <tr key={purchase.id}><td><strong>#{purchase.purchase_number}</strong><small>{purchase.notes || ''}</small></td><td>{purchase.suppliers?.name || '—'}</td><td>{businessDate(purchase.created_at)}</td><td>{items.length} line(s)<small>{money(total)}</small></td><td><span className={`stage-two-badge stage-two-${purchase.status}`}>{purchase.status.replace('_', ' ')}</span></td><td>{money(paid)} / {money(total)}</td><td className="stage-three-actions">{purchase.status !== 'received' && <button onClick={() => { setFormError(''); setReceiveQuantities({}); setReceiving(purchase) }}>Receive goods</button>}<button onClick={() => { setFormError(''); setPaymentForm({ amount: '', paid_at: today(), method: 'cash', reference: '', notes: '' }); setPaying(purchase) }}>Record payment</button></td></tr>
      })}
    </tbody></table>{!data.purchases.length && <p className="stage-two-empty">No purchase orders yet. Create an order before goods arrive; inventory changes only when you record receipt.</p>}</div>}
    {data.payments.length > 0 && <><h2 className="stage-two-section-title">Supplier payment history</h2><div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Date</th><th>Supplier</th><th>Purchase</th><th>Amount</th><th>Method / reference</th><th>Notes</th></tr></thead><tbody>{data.payments.map((payment) => <tr key={payment.id}><td>{payment.paid_at}</td><td>{payment.suppliers?.name || '—'}</td><td>{payment.purchase_order_id ? `#${data.purchases.find((purchase) => purchase.id === payment.purchase_order_id)?.purchase_number || ''}` : '—'}</td><td>{money(payment.amount)}</td><td>{payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</td><td>{payment.notes || '—'}</td></tr>)}</tbody></table></div></>}
    {creating && <div className="stage-two-modal-backdrop"><section className="stage-two-modal stage-three-wide-modal" role="dialog" aria-modal="true"><header><h2>New purchase order</h2><button type="button" onClick={() => setCreating(false)}>×</button></header><form className="stage-two-form" onSubmit={createPurchase}>
      <label>Supplier<select required value={purchaseForm.supplier_id} onChange={(event) => setPurchaseForm({ ...purchaseForm, supplier_id: event.target.value })}><option value="">Select active supplier</option>{data.suppliers.filter((supplier) => supplier.is_active).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
      <label>Notes<textarea value={purchaseForm.notes} onChange={(event) => setPurchaseForm({ ...purchaseForm, notes: event.target.value })} /></label>
      {purchaseForm.items.map((item, index) => <div className="stage-three-purchase-line" key={index}>
        <label>Product variant<select required value={item.variant_id} onChange={(event) => setPurchaseForm({ ...purchaseForm, items: purchaseForm.items.map((line, lineIndex) => lineIndex === index ? { ...line, variant_id: event.target.value } : line) })}><option value="">Select variant</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.products?.name} · {variant.size}/{variant.color}</option>)}</select></label>
        <TextField label="Quantity" type="number" required value={item.quantity} onChange={(quantity) => setPurchaseForm({ ...purchaseForm, items: purchaseForm.items.map((line, lineIndex) => lineIndex === index ? { ...line, quantity } : line) })} />
        <TextField label="Unit cost (PKR)" type="number" required value={item.unit_cost} onChange={(unit_cost) => setPurchaseForm({ ...purchaseForm, items: purchaseForm.items.map((line, lineIndex) => lineIndex === index ? { ...line, unit_cost } : line) })} />
        {purchaseForm.items.length > 1 && <button type="button" onClick={() => setPurchaseForm({ ...purchaseForm, items: purchaseForm.items.filter((_, lineIndex) => lineIndex !== index) })}>Remove</button>}
      </div>)}
      <button type="button" className="stage-two-button" onClick={() => setPurchaseForm({ ...purchaseForm, items: [...purchaseForm.items, { variant_id: '', quantity: '1', unit_cost: '' }] })}>＋ Add variant</button>
      <p className="stage-three-muted">This creates a pending order and does not change on-hand stock.</p>
      <div className="stage-two-actions"><button type="button" onClick={() => setCreating(false)}>Cancel</button><button className="stage-two-button-primary" disabled={busy}>{busy ? 'Creating…' : 'Create purchase'}</button></div>
    </form></section></div>}
    {receiving && <div className="stage-two-modal-backdrop"><section className="stage-two-modal stage-three-wide-modal" role="dialog" aria-modal="true"><header><h2>Receive purchase #{receiving.purchase_number}</h2><button type="button" onClick={() => setReceiving(null)}>×</button></header><form className="stage-two-form" onSubmit={receivePurchase}>
      {(receiving.purchase_order_items || []).map((item) => <label key={item.id}>{item.product_variants?.products?.name} · {item.product_variants?.size}/{item.product_variants?.color} — {item.received_quantity} of {item.quantity} received<input type="number" min="0" max={item.quantity - item.received_quantity} step="1" value={receiveQuantities[item.id] || ''} onChange={(event) => setReceiveQuantities({ ...receiveQuantities, [item.id]: event.target.value })} /></label>)}
      <p className="stage-three-muted">Only the quantities entered here are added to inventory and logged in stock movements.</p>
      <div className="stage-two-actions"><button type="button" onClick={() => setReceiving(null)}>Cancel</button><button className="stage-two-button-primary" disabled={busy}>{busy ? 'Recording…' : 'Record receipt'}</button></div>
    </form></section></div>}
    {paying && <div className="stage-two-modal-backdrop"><section className="stage-two-modal" role="dialog" aria-modal="true"><header><h2>Record supplier payment</h2><button type="button" onClick={() => setPaying(null)}>×</button></header><form className="stage-two-form" onSubmit={recordPayment}>
      <p>{paying.suppliers?.name} · Purchase #{paying.purchase_number}</p>
      <TextField label="Amount (PKR)" type="number" value={paymentForm.amount} required onChange={(amount) => setPaymentForm({ ...paymentForm, amount })} />
      <TextField label="Date" type="date" value={paymentForm.paid_at} required onChange={(paid_at) => setPaymentForm({ ...paymentForm, paid_at })} />
      <label>Method<select value={paymentForm.method} onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}>{['cash', 'bank transfer', 'cheque', 'other'].map((method) => <option key={method}>{method}</option>)}</select></label>
      <TextField label="Reference" value={paymentForm.reference} onChange={(reference) => setPaymentForm({ ...paymentForm, reference })} />
      <label>Notes<textarea value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} /></label>
      <div className="stage-two-actions"><button type="button" onClick={() => setPaying(null)}>Cancel</button><button className="stage-two-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Record payment'}</button></div>
    </form></section></div>}
  </section>
}

const REPORT_OPTIONS = [
  ['sales', 'Sales by date'], ['products', 'Product performance'], ['categories', 'Category performance'],
  ['slow', 'Slow-moving products'], ['inventory', 'Inventory valuation'], ['customers', 'Customer acquisition & repeat'],
  ['coupons', 'Coupon usage & discounts'], ['returns', 'Returns, refunds & cancellations'],
  ['cod', 'COD collection status'], ['expenses', 'Expenses & estimated profit']
]

function makeReportRows(key, data, summary) {
  const orderMap = new Map(data.orders.map((order) => [order.id, order]))
  if (key === 'sales') return summary.trend.map((row) => ({ date: row.label, orders: row.sales, revenue_pkr: row.revenue, expenses_pkr: row.expenses, estimated_profit_pkr: row.profit }))
  if (key === 'products' || key === 'slow') {
    const counts = new Map()
    for (const item of summary.items) {
      const order = orderMap.get(item.order_id)
      if (!order || !isRecognizedSale(order)) continue
      const name = data.products.find((product) => product.id === item.product_id)?.name || item.product_name
      const value = counts.get(name) || { units_sold: 0, net_item_sales_pkr: 0, product_cost_pkr: 0 }
      value.units_sold += item.quantity
      value.net_item_sales_pkr += netItemSales(item, order)
      if (item.unit_cost != null) value.product_cost_pkr += Number(item.unit_cost) * item.quantity
      counts.set(name, value)
    }
    const rows = data.products.map((product) => ({
      product: product.name,
      category: data.categories.find((category) => category.id === product.category_id)?.name || 'Uncategorized',
      status: product.status,
      ...(counts.get(product.name) || { units_sold: 0, net_item_sales_pkr: 0, product_cost_pkr: 0 })
    }))
    return key === 'slow' ? rows.sort((a, b) => a.units_sold - b.units_sold).slice(0, 100) : rows.sort((a, b) => b.units_sold - a.units_sold)
  }
  if (key === 'categories') {
    const rows = new Map()
    for (const item of summary.items) {
      const product = data.products.find((entry) => entry.id === item.product_id)
      const category = data.categories.find((entry) => entry.id === product?.category_id)?.name || 'Uncategorized'
      rows.set(category, (rows.get(category) || 0) + netItemSales(item, orderMap.get(item.order_id)))
    }
    return [...rows].map(([category, sales_pkr]) => ({ category, sales_pkr })).sort((a, b) => b.sales_pkr - a.sales_pkr)
  }
  if (key === 'inventory') {
    const costs = new Map(data.variantCosts.map((cost) => [cost.variant_id, Number(cost.unit_cost)]))
    return data.variants.map((variant) => {
      const unitCost = costs.get(variant.id)
      return {
        product: variant.products?.name || 'Deleted product', size: variant.size, color: variant.color,
        stock_units: variant.stock_quantity, unit_cost_pkr: unitCost ?? '',
        stock_valuation_pkr: unitCost == null ? 'Unknown cost' : variant.stock_quantity * unitCost
      }
    })
  }
  if (key === 'customers') {
    const customers = data.profiles.filter((profile) => profile.role === 'customer')
    return customers.filter((customer) => {
      const registered = customer.created_at ? businessDate(customer.created_at) : ''
      return registered >= summary.start && registered <= summary.end
    }).map((customer) => {
      const orders = data.orders.filter((order) => order.user_id === customer.id
        && businessDate(order.created_at) <= summary.end && isRecognizedSale(order))
      return { customer_id: customer.id, registered: customer.created_at ? businessDate(customer.created_at) : '', orders: orders.length, repeat_customer: orders.length > 1 }
    }).sort((a, b) => a.registered.localeCompare(b.registered))
  }
  if (key === 'coupons') {
    const grouped = new Map()
    for (const order of summary.ordersInRange.filter((candidate) => candidate.status !== 'cancelled'
      && (candidate.coupon_code || Number(candidate.discount_total) > 0))) {
      const code = order.coupon_code || 'No coupon code'
      const value = grouped.get(code) || { orders: 0, discounts_pkr: 0 }
      value.orders += 1
      value.discounts_pkr += Number(order.discount_total)
      grouped.set(code, value)
    }
    return [...grouped].map(([coupon_code, value]) => ({ coupon_code, ...value }))
  }
  if (key === 'returns') return ['returned', 'refunded', 'cancelled'].map((status) => ({
    status, orders: summary.ordersInRange.filter((order) => order.status === status).length,
    order_total_pkr: summary.ordersInRange.filter((order) => order.status === status).reduce((sum, order) => sum + Number(order.total), 0)
  }))
  if (key === 'cod') return ['pending', 'paid', 'failed'].map((payment_status) => ({
    payment_status,
    orders: summary.ordersInRange.filter((order) => order.payment_method === 'cod' && order.payment_status === payment_status && !['cancelled', 'returned', 'refunded'].includes(order.status)).length,
    order_total_pkr: summary.ordersInRange.filter((order) => order.payment_method === 'cod' && order.payment_status === payment_status && !['cancelled', 'returned', 'refunded'].includes(order.status)).reduce((sum, order) => sum + Number(order.total), 0)
  }))
  if (key === 'expenses') {
    return summary.expenses.map((expense) => ({
    date: expense.expense_date, category: expense.category, recipient: expense.recipient,
    amount_pkr: Number(expense.amount), notes: expense.notes || ''
    }))
  }
  return summary.trend.map((row) => ({
    date: row.label, sales_pkr: row.revenue, expenses_pkr: row.expenses,
    estimated_profit_pkr: row.profit
  }))
}

function ReportsWorkspace() {
  const { data, loading, error } = useBusinessData()
  const dates = useDates()
  const [selectedReport, setSelectedReport] = useState('sales')
  const summary = useMemo(() => summarize(data, dates.start, dates.end), [data, dates.start, dates.end])
  const rows = useMemo(() => makeReportRows(selectedReport, data, summary), [selectedReport, data, summary])
  const headers = rows.length ? Object.keys(rows[0]) : []
  return <section className="stage-three-workspace">
    <WorkspaceHeader eyebrow="BUSINESS INTELLIGENCE" title="Reports" action={<button className="stage-two-button" disabled={!rows.length} onClick={() => exportCsv(`little-star-${selectedReport}-report.csv`, rows)}>Export report CSV</button>} />
    <DateFilter {...dates} />
    <div className="stage-three-report-tabs" role="tablist" aria-label="Report type">{REPORT_OPTIONS.map(([key, title]) => <button role="tab" aria-selected={selectedReport === key} className={selectedReport === key ? 'is-active' : ''} key={key} onClick={() => setSelectedReport(key)}>{title}</button>)}</div>
    {selectedReport === 'expenses' && <p className="stage-three-financial-note">Estimated profit is indicative. Purchasing and manufacturing expense categories are excluded from operating overhead to avoid double-counting amounts reflected in product costs. Historical sales without cost snapshots are incomplete.</p>}
    <ErrorNotice error={error} />
    {loading ? <p className="stage-two-loading">Loading report data…</p> : <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr>{headers.map((header) => <th key={header}>{header.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>
      {rows.map((row, index) => <tr key={index}>{headers.map((header) => <td key={header}>{typeof row[header] === 'boolean' ? row[header] ? 'Yes' : 'No' : row[header] ?? '—'}</td>)}</tr>)}
    </tbody></table>{!rows.length && <p className="stage-two-empty">No report rows for this date range.</p>}</div>}
  </section>
}

export default function StageThreeWorkspace({ section }) {
  const { profile } = useAuth()
  if (profile?.role !== 'admin') return <p className="stage-two-error" role="alert">Administrator access is required.</p>
  if (section === 'expenses') return <ExpenseWorkspace />
  if (section === 'suppliers') return <SupplierWorkspace />
  if (section === 'purchases') return <PurchaseWorkspace />
  if (section === 'reports') return <ReportsWorkspace />
  return null
}
