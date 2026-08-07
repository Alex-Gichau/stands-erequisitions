const cp = require('child_process');
cp.execSync('git checkout src/lib/databaseService.ts');
console.log('Restored');
