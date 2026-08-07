import crypto from 'crypto';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./googleService.json', 'utf8'));
const key = serviceAccount.private_key.replace(/\\n/g, '\n');

try {
  const sign = crypto.createSign('SHA256');
  sign.update('hello');
  const signature = sign.sign(key, 'base64');
  console.log("Signature successful! Signature length:", signature.length);
} catch (err: any) {
  console.error("Signing failed:", err.message);
}
