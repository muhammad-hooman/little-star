const fs = require('fs');
const allReads = JSON.parse(fs.readFileSync('all_reads.json', 'utf-8'));
allReads.forEach((r, idx) => {
  if (r.path.includes('little-star')) {
    console.log(`[${idx}] line ${r.lineIndex}: ${r.path} (${r.start || 1}-${r.end || 'end'})`);
  }
});
