import fs from 'fs';
console.log(fs.readFileSync('/app/applet/.env', 'utf8').replace(/./g, '*')); // just to see if it exists
