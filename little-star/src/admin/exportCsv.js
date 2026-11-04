export function buildCsv(rows) {
  if (!rows.length) return ''
  const makeCell = (value) => {
    let text = value == null ? '' : String(value)
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const columns = Object.keys(rows[0])
  const content = [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((row) => row.map(makeCell).join(',')).join('\r\n')
  return `\uFEFF${content}`
}

export function exportCsv(filename, rows) {
  const content = buildCsv(rows)
  if (!content) return
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
