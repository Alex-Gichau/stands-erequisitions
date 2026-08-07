const fs = require('fs');
const filePath = 'src/lib/databaseService.ts';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/catch \(err: any\) \{\s*warnings\.push\(`Failed fetching (.*?) from Firestore: \$\{err\.message\}`\);\s*\}/g, 
  `catch (err: any) {
        if (!err.message?.includes("permissions")) {
          warnings.push(\`Failed fetching $1 from Firestore: \${err.message}\`);
        }
      }`);

content = content.replace(/catch \(err: any\) \{\s*console\.log\("Failed fetching ([^"]+)", err\.message\);\s*\}/g, 
  `catch (err: any) {
        if (!err.message?.includes("permissions")) {
          console.info("Failed fetching $1", err.message);
        }
      }`);

fs.writeFileSync(filePath, content);
console.log('Fixed fetching logs');
