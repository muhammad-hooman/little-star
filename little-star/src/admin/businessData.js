const DATA_SOURCE_ORDER_COLUMNS = {
  order_item_costs: 'order_item_id',
  product_variant_costs: 'variant_id'
}

export function getDataSourceOrderColumn(table) {
  return DATA_SOURCE_ORDER_COLUMNS[table] || 'id'
}
