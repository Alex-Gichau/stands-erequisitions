import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

try {
  const serviceAccount = JSON.parse(fs.readFileSync('./googleService.json', 'utf8'));
  console.log("Service Account Email:", serviceAccount.client_email);
  console.log("Service Account Project ID:", serviceAccount.project_id);

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id
  }, "test-dbid-app-" + Date.now());

  // Try different database IDs
  const dbIds = ["(default)", "ai-studio-4557280f-c588-4a23-9ac4-307fc42213b4"];
  
  async function run() {
    for (const dbId of dbIds) {
      console.log(`\n--- Testing Firestore with Database ID: '${dbId}' ---`);
      try {
        const db = getFirestore(app, dbId);
        const collections = await db.listCollections();
        console.log(`🟢 SUCCESS for DB ID '${dbId}'! Collections:`, collections.map(c => c.id));
        return; // stop on success
      } catch (err: any) {
        console.log(`❌ FAILED for DB ID '${dbId}':`, err.message || String(err));
      }
    }
  }

  run();
} catch (err: any) {
  console.error("❌ ERROR:", err);
}
