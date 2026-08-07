import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./googleService.json', 'utf8'));
const envPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
const envKeyFixed = envPrivateKey ? envPrivateKey.replace(/\\n/g, '\n') : "";

console.log("Length of fixed env key:", envKeyFixed.length);
console.log("Is fixed env key identical to serviceAccount key?", envKeyFixed === serviceAccount.private_key);
