const fs = require('fs');
const path = require('path');
const dataDir = process.env.DATA_DIR || path.join('server', 'data');
const targetFile = path.join(dataDir, 'permissions_export.json');
const data = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
const formatted = data.map(p => ({
  ...p,
  access: typeof p.access === 'string' ? JSON.parse(p.access) : p.access,
  actions: typeof p.actions === 'string' ? JSON.parse(p.actions) : p.actions
}));
fs.writeFileSync(targetFile, JSON.stringify(formatted, null, 2), 'utf8');
console.log("Re-formatted permissions_export.json to use actual objects.");
