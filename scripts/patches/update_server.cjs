const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');

const seedMappingsStr = `
const fileMappings: { [key: string]: string } = {
  "users": "users_export.json",
  "requisitions": "requisitions_export.json",
  "transactions": "transactions_export.json",
  "ledger_books": "ledger_books_export.json",
  "audit_logs": "activity_history.json",
  "alerts": "alerts_export.json",
  "fiscal_years": "fiscal_years_export.json",
  "projects": "projects_export.json",
  "reports": "reports_export.json",
  "settings": "settings_export.json",
  "thresholds": "thresholds_export.json",
  "vendors": "vendors_export.json",
  "forecast": "forecast_export.json",
  "permissions": "permissions_export.json",
  "church_groups": "church_groups.json",
  "supplementary_budgets": "supplementary_budgets.json"
};
function getFilePath(collection) {
  const fileName = fileMappings[collection] || (collection + ".json");
  return path.join(process.cwd(), "server", "data", fileName);
}
`;

// Insert the mappings and helper after imports
content = content.replace(/import { google } from "googleapis";/, 'import { google } from "googleapis";\n' + seedMappingsStr);

// Replace path.join(process.cwd(), `${collection}.json`) with getFilePath(collection)
content = content.replace(/path\.join\(process\.cwd\(\),\s*`\$\{collection\}\.json`\)/g, 'getFilePath(collection)');
content = content.replace(/path\.join\(process\.cwd\(\),\s*`\$\{col\}\.json`\)/g, 'getFilePath(col)');
content = content.replace(/path\.join\(process\.cwd\(\),\s*"users\.json"\)/g, 'getFilePath("users")');
content = content.replace(/path\.join\(process\.cwd\(\),\s*"requisitions\.json"\)/g, 'getFilePath("requisitions")');


fs.writeFileSync('server.ts', content, 'utf-8');
console.log("Updated server.ts successfully.");
