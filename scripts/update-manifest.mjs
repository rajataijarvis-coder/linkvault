import fs from 'fs';
import path from 'path';

const linksDir = path.resolve('public/links');
const manifestPath = path.join(linksDir, 'manifest.json');

const files = fs
  .readdirSync(linksDir)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
  .sort();

fs.writeFileSync(manifestPath, JSON.stringify(files, null, 0));
console.log(`Updated manifest with ${files.length} date files.`);
