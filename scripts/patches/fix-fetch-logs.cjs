const fs = require('fs');
const filePath = 'src/lib/databaseService.ts';
let content = fs.readFileSync(filePath, 'utf8');

const tables = [
  'projects', 'requisitions', 'alerts', 'fiscal_years', 'transactions',
  'forecast', 'reports', 'system_logs', 'permissions', 'thresholds',
  'church_groups', 'ledger_books', 'supplementary_budgets', 'vendors'
];

tables.forEach(table => {
  content = content.replace(
    new RegExp(`catch \\(err: any\\) \\{\\s*(?:console\\.log\\("Failed fetching ${table}[\\s\\S]*"\\);|warnings\\.push\\(\`Failed fetching ${table}[\\s\\S]*\`\\);)\\s*\\}`, 'g'),
    `catch (err: any) {
        if (!err.message?.includes("permissions")) {
          // Ignore permissions errors quietly
          console.info("Failed fetching ${table} from Firestore:", err.message);
          if (warnings) warnings.push(\`Failed fetching ${table} from Firestore: \${err.message}\`);
        }
      }`
  );
});

content = content.replace(/console\.log\(\`\[DatabaseService\] Optional table 'church_groups' write check:\`, cgErr\.message \|\| cgErr\);/g, 
  "console.info(`[DatabaseService] Optional table 'church_groups' write check:`, cgErr.message || cgErr);");

fs.writeFileSync(filePath, content);
console.log('Fixed fetching logs');
