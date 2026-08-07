import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

try {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  console.log("Using Env Email:", email);
  console.log("Using Env Key Length:", privateKey ? privateKey.length : 0);

  const app = initializeApp({
    credential: cert({
      clientEmail: email,
      privateKey: privateKey,
      projectId: "ai-studio-4557280f-c588-4a23-9ac4-307fc42213b4"
    }),
    projectId: "ai-studio-4557280f-c588-4a23-9ac4-307fc42213b4"
  }, "test-env-app-" + Date.now());

  const db = getFirestore(app);
  
  async function run() {
    const collections = await db.listCollections();
    console.log("🟢 SUCCESS! Successfully authenticated to Firestore!");
    console.log("Collections list:", collections.map(c => c.id));
    
    // Check collections
    for (const col of collections) {
      const snap = await db.collection(col.id).limit(2).get();
      console.log(`- Collection '${col.id}' has ${snap.size} documents in sample.`);
    }
  }

  run();
} catch (err: any) {
  console.error("❌ ERROR during Firestore env verification:", err);
}
