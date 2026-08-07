import fs from 'fs';
import path from 'path';

function findJsonFiles(dir: string, results: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findJsonFiles(fullPath, results);
    } else if (file.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsonFiles = findJsonFiles('.');
console.log("JSON Files found in workspace:");
jsonFiles.forEach(f => {
  const size = fs.statSync(f).size;
  console.log(`- ${f} (${size} bytes)`);
});
