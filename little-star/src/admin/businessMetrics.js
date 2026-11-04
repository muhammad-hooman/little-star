const PAKISTAN_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

export function businessDate(value) {
  const parts = Object.fromEntries(PAKISTAN_DATE_FORMATTER.formatToParts(new Date(value))
    .filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const isSale = (order) => !['cancelled', 'returned', 'refunded'].includes(order.status)
  && order.payment_status !== 'refunded'
export const isRecognizedSale = (order) => isSale(order) && (order.status === 'delivered' || order.payment_status === 'paid')
export const isFinanciallyCompleted = (order) => order.status !== 'cancelled'
  && (isRecognizedSale(order) || order.status === 'refunded' || order.payment_status === 'refunded')
export const refundValue = (order) => Math.max(0, Number(order.subtotal) - Number(order.discount_total))
export const netItemSales = (item, order) => {
  const lineTotal = Number(item.line_total)
  const subtotal = Number(order.subtotal)
  const discount = Number(order.discount_total)
  return Math.max(0, lineTotal - (subtotal > 0 ? discount * lineTotal / subtotal : 0))
}

export function calculateFinancialSummary(orders, start, end) {
  const ordersInRange = orders.filter((order) => businessDate(order.created_at) >= start && businessDate(order.created_at) <= end)
  const recognized = ordersInRange.filter(isRecognizedSale)
  const salesOrders = ordersInRange.filter(isSale)
  const refunds = ordersInRange.filter((order) => order.status === 'refunded' || order.payment_status === 'refunded')
  const gross = ordersInRange.filter(isFinanciallyCompleted).reduce((sum, order) => sum + Number(order.subtotal), 0)
  const discounts = ordersInRange.filter(isFinanciallyCompleted).reduce((sum, order) => sum + Number(order.discount_total), 0)
  const refundedAmount = refunds.reduce((sum, order) => sum + refundValue(order), 0)
  const collected = ordersInRange.filter((order) => order.payment_status === 'paid')
    .reduce((sum, order) => sum + Number(order.total), 0)
  const outstandingCod = ordersInRange.filter((order) => order.payment_method === 'cod'
    && ['pending', 'unpaid'].includes(order.payment_status) && !['cancelled', 'returned', 'refunded'].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total), 0)
  return {
    ordersInRange,
    recognized,
    salesOrders,
    refunds,
    gross,
    discounts,
    refundedAmount,
    net: Math.max(0, gross - discounts - refundedAmount),
    collected,
    outstandingCod
  }
}
