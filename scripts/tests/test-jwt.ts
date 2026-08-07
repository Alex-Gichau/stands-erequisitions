import { google } from 'googleapis';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./googleService.json', 'utf8'));
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

const authClient = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

async function run() {
  try {
    const token = await authClient.getAccessToken();
    console.log("Token acquired successfully!");
    console.log("Token length:", token.token?.length);
    console.log("Expiration:", token.res?.data);
  } catch (err) {
    console.error("JWT Error:", err);
  }
}

run();
