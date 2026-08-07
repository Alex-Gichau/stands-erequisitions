const fs = require('fs');
let content = fs.readFileSync('src/contexts/RequisitionContext.tsx', 'utf8');

content = content.replace(
  /const onSnapshot = \(queryRef: any, callback: \(snap: any\) => void\) => \{/g,
  'const onSnapshot = (queryRef: any, callback: (snap: any) => void, errorCallback?: (err: any) => void) => {'
);

fs.writeFileSync('src/contexts/RequisitionContext.tsx', content);
