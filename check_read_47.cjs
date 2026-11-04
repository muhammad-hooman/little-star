const fs = require('fs');
const allReads = JSON.parse(fs.readFileSync('all_reads.json', 'utf-8'));

function parse(output) {
  const lines = output.replace(/\r/g, '').split('\n');
  const codeLines = [];
  for (const line of lines) {
    const idx = line.indexOf(': ');
    if (idx !== -1 && /^\d+$/.test(line.slice(0, idx))) {
      codeLines.push(line.slice(idx + 2));
    } else if (/^\d+:$/.test(line)) {
      codeLines.push('');
    }
  }
  return codeLines.join('\n');
}

console.log('--- Read 47 (src/index.css) ---');
console.log(parse(allReads[47].output).slice(0, 500));
