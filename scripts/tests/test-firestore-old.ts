import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

try {
  const serviceAccount = JSON.parse(fs.readFileSync('./googleService.json', 'utf8'));
  console.log("Service Account Email:", serviceAccount.client_email);
  
  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'ai-studio-0adb409c-19ca-4d40-98cc-79864b9d3d75'
  }, "test-app-old-" + Date.now());

  const db = getFirestore(app);
  
  async function run() {
    const collections = await db.listCollections();
    console.log("🟢 SUCCESS! Successfully authenticated to Firestore on ai-studio project ID!");
    console.log("Collections list:", collections.map(c => c.id));
  }

  run();
} catch (err: any) {
  console.error("❌ ERROR during old Firestore verification:", err);
}
