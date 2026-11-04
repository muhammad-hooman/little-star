import test from 'node:test'
import assert from 'node:assert/strict'
import { businessDate, calculateFinancialSummary, netItemSales } from '../src/admin/businessMetrics.js'
import { getDataSourceOrderColumn } from '../src/admin/businessData.js'
import { buildCsv } from '../src/admin/exportCsv.js'

const records = [
  {
    id: 'delivered-cod', created_at: '2026-10-20T10:00:00Z', status: 'delivered',
    payment_method: 'cod', payment_status: 'pending', subtotal: 100, discount_total: 10, total: 95
  },
  {
    id: 'paid', created_at: '2026-10-20T12:00:00Z', status: 'processing',
    payment_method: 'cod', payment_status: 'paid', subtotal: 50, discount_total: 0, total: 50
  },
  {
    id: 'refunded', created_at: '2026-10-20T13:00:00Z', status: 'refunded',
    payment_method: 'cod', payment_status: 'refunded', subtotal: 60, discount_total: 10, total: 55
  },
  {
    id: 'cancelled', created_at: '2026-10-20T14:00:00Z', status: 'cancelled',
    payment_method: 'cod', payment_status: 'pending', subtotal: 200, discount_total: 0, total: 200
  },
  {
    id: 'pending', created_at: '2026-10-20T15:00:00Z', status: 'pending',
    payment_method: 'cod', payment_status: 'pending', subtotal: 80, discount_total: 0, total: 80
  },
  {
    id: 'unpaid', created_at: '2026-10-20T16:00:00Z', status: 'pending',
    payment_method: 'cod', payment_status: 'unpaid', subtotal: 20, discount_total: 0, total: 20
  },
  {
    id: 'outside-range', created_at: '2026-10-19T15:00:00Z', status: 'delivered',
    payment_method: 'cod', payment_status: 'paid', subtotal: 1000, discount_total: 0, total: 1000
  }
]

test('financial summary filters dates and separates sales, discounts, refunds, collections, and COD', () => {
  const summary = calculateFinancialSummary(records, '2026-10-20', '2026-10-20')

  assert.deepEqual(summary.ordersInRange.map((order) => order.id), [
    'delivered-cod', 'paid', 'refunded', 'cancelled', 'pending', 'unpaid'
  ])
  assert.deepEqual(summary.recognized.map((order) => order.id), ['delivered-cod', 'paid'])
  assert.equal(summary.gross, 210)
  assert.equal(summary.discounts, 20)
  assert.equal(summary.refundedAmount, 50)
  assert.equal(summary.net, 140)
  assert.equal(summary.collected, 50)
  assert.equal(summary.outstandingCod, 195)
})

test('order timestamps are grouped by the Pakistan business date, not their UTC calendar day', () => {
  const order = {
    id: 'pakistan-midnight', created_at: '2026-10-19T20:00:00Z', status: 'delivered',
    payment_method: 'cod', payment_status: 'paid', subtotal: 100, discount_total: 0, total: 100
  }
  assert.equal(businessDate(order.created_at), '2026-10-20')
  assert.equal(calculateFinancialSummary([order], '2026-10-20', '2026-10-20').recognized.length, 1)
})

test('item-level sales allocate order discounts proportionally', () => {
  const order = { subtotal: 100, discount_total: 10 }
  assert.equal(netItemSales({ line_total: 60 }, order), 54)
  assert.equal(netItemSales({ line_total: 40 }, order), 36)
})

test('paged dashboard queries order cost tables by their actual primary keys', () => {
  assert.equal(getDataSourceOrderColumn('order_item_costs'), 'order_item_id')
  assert.equal(getDataSourceOrderColumn('product_variant_costs'), 'variant_id')
  assert.equal(getDataSourceOrderColumn('orders'), 'id')
})

test('CSV output keeps report columns, quotes values, and neutralizes spreadsheet formulas', () => {
  assert.equal(buildCsv([]), '')
  const csv = buildCsv([{ recipient: 'A "Shop"', amount: 10, notes: '=SUM(A1:A2)' }])
  assert.equal(csv, '\uFEFF"recipient","amount","notes"\r\n"A ""Shop""","10","\'=SUM(A1:A2)"')
})
