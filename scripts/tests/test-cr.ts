import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./googleService.json', 'utf8'));
const key = serviceAccount.private_key;

console.log("Contains '\\r'? ", key.includes('\r'));
console.log("Contains '\\r\\n'? ", key.includes('\r\n'));
console.log("Number of lines:", key.split('\n').length);
