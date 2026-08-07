const fs = require('fs');
const data = JSON.parse(fs.readFileSync('server/data/permissions_export.json', 'utf8'));
const formatted = data.map(p => ({
  ...p,
  access: typeof p.access === 'string' ? JSON.parse(p.access) : p.access,
  actions: typeof p.actions === 'string' ? JSON.parse(p.actions) : p.actions
}));
fs.writeFileSync('server/data/permissions_export.json', JSON.stringify(formatted, null, 2), 'utf8');
console.log("Re-formatted permissions_export.json to use actual objects.");
