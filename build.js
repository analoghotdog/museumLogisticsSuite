// Collection Logistics Suite — standalone build.
// Inlines clm-core.js + clm-library.js into copies of the apps under dist/,
// so the distributed single files carry the shared engines themselves.
// (CDN deps — three.js, PapaParse, jsPDF, fonts — stay external.)
//
// Usage: node collection-logistics-suite/build.js
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const core = fs.readFileSync(path.join(DIR, 'clm-core.js'), 'utf8');
const lib = fs.readFileSync(path.join(DIR, 'clm-library.js'), 'utf8');

if (core.includes('</script') || lib.includes('</script')) {
  console.error('Refusing to inline: shared file contains "</script"');
  process.exit(1);
}

fs.mkdirSync(path.join(DIR, 'dist'), { recursive: true });

const apps = ['suite.html', 'capackybara.html', 'stick-it-on-a-shelf.html', 'otter-fit.html'];
for (const f of apps) {
  let s = fs.readFileSync(path.join(DIR, f), 'utf8');
  const before = s;
  s = s.replace('<script src="clm-core.js"></script>',
    '<script>\n/* ==== INLINED clm-core.js (standalone build — do not edit) ==== */\n' + core + '\n</script>');
  s = s.replace('<script src="clm-library.js"></script>',
    '<script>\n/* ==== INLINED clm-library.js (standalone build — do not edit) ==== */\n' + lib + '\n</script>');
  if (s === before) {
    console.error(`✗ ${f}: no clm-core.js/clm-library.js includes found`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(DIR, 'dist', f), s);
  console.log(`✓ dist/${f} (${Math.round(s.length / 1024)} KB)`);
}
console.log('done — dist/ apps are standalone apart from CDN scripts');
