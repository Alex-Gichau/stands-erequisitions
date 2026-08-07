import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

try {
  console.log("🔄 Initializing Firebase Admin using Application Default Credentials (ADC)...");
  const app = initializeApp({
    projectId: "ai-studio-4557280f-c588-4a23-9ac4-307fc42213b4"
  }, "test-adc-" + Date.now());
  const db = getFirestore(app);

  async function run() {
    try {
      console.log("🔄 Listing collections...");
      const collections = await db.listCollections();
      console.log("🟢 SUCCESS! Collections found:", collections.map(c => c.id));
      
      // Let's print document counts for key collections
      for (const col of collections) {
        const snap = await db.collection(col.id).limit(5).get();
        console.log(`- Collection '${col.id}' has at least ${snap.size} documents.`);
      }
    } catch (err: any) {
      console.error("❌ FAILED to list collections via ADC:", err.message || String(err));
      console.error("Error details:", err);
    }
  }

  run();
} catch (err: any) {
  console.error("❌ App initialization failed:", err);
}
