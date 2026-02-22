const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

// Usage: node resolve-sourcemap.cjs [line] [column]
// Picks newest dist/assets/index-*.js.map, outputs source file + line:col + code line + import block.
const distDir = path.join(__dirname, '../dist/assets');
if (!fs.existsSync(distDir)) {
  console.error('Missing dist/assets. Run: npm run build (with build.sourcemap=true)');
  process.exit(1);
}
const mapFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.js.map'));
const newest = mapFiles
  .map((f) => ({ f, m: fs.statSync(path.join(distDir, f)).mtime.getTime() }))
  .sort((a, b) => b.m - a.m)[0];
const mapPath = newest ? path.join(distDir, newest.f) : null;
if (!mapPath) {
  console.error('No index-*.js.map in dist/assets. Enable build.sourcemap and run npm run build.');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const line = parseInt(process.argv[2] || '371', 10);
const column = parseInt(process.argv[3] || '81358', 10);

SourceMapConsumer.with(raw, null, (consumer) => {
  const pos = consumer.originalPositionFor({ line, column });
  console.log('Generated position:', { line, column });
  console.log('Original position:', pos);
  if (pos.source) {
    const content = raw.sourcesContent?.[raw.sources.indexOf(pos.source)];
    if (content) {
      const lines = content.split('\n');
      const origLine = lines[pos.line];
      console.log('Source file:', pos.source);
      console.log('Line', pos.line + 1, ':', origLine?.trim() || '(empty)');
      // Import block: lines from start until first non-import/blank/comment
      const importBlock = [];
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || /^\s*import\s/.test(lines[i]) || /^\s*export\s/.test(lines[i])) {
          importBlock.push(lines[i]);
        } else {
          break;
        }
      }
      if (importBlock.length) {
        console.log('--- Import block (top of file) ---');
        importBlock.forEach((l) => console.log(l));
      }
    }
  }
});
