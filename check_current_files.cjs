const fs = require('fs');

const files = [
  'index.html',
  'src/index.css',
  'src/components/AnnouncementBar.jsx',
  'src/components/Header.jsx',
  'src/components/HeroBanner.jsx',
  'src/components/CategoryShowcase.jsx',
  'src/components/FeaturedProducts.jsx'
];

for (const f of files) {
  const content = fs.readFileSync(`little-star/${f}`, 'utf-8');
  console.log(`=== ${f} === (${content.length} chars)`);
  console.log(content.slice(0, 200).replace(/\n/g, ' '));
  console.log('---');
}
