const fs = require('fs');
const path = require('path');

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

// Let's test parse on each of the target files to verify line counts and integrity
const restoreMap = {
  'index.html': 44,
  'src/index.css': 47,
  'src/App.jsx': 2,
  'src/components/AnnouncementBar.jsx': 3,
  'src/components/Header.jsx': 4,
  'src/components/StorePages.jsx': 5,
  'src/components/CategoryShowcase.jsx': 16,
  'src/components/HeroBanner.jsx': 20,
  'src/components/FeaturedProducts.jsx': 21,
  'src/components/EditorialBanners.jsx': 22,
  'src/components/FlashSales.jsx': 23,
  'src/components/OccasionWear.jsx': 24,
  'src/components/JournalSection.jsx': 25,
  'src/components/InstagramGallery.jsx': 26,
  'src/components/Footer.jsx': 27
};

for (const [relPath, readIndex] of Object.entries(restoreMap)) {
  const readEntry = allReads[readIndex];
  if (!readEntry) {
    console.error(`Missing read entry at index ${readIndex} for ${relPath}`);
    continue;
  }
  const restoredContent = parse(readEntry.output);
  const lineCount = restoredContent.split('\n').length;
  console.log(`${relPath}: readIndex ${readIndex}, path ${readEntry.path}, lines ${lineCount}`);
}
