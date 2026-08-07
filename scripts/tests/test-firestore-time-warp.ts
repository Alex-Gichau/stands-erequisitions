import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Time-warp: Subtract 1 year (365 days) from Date.now() to align with real-world time
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const originalNow = Date.now;
Date.now = function() {
  return originalNow() - ONE_YEAR_MS;
};

// Also patch Date constructor
const OriginalDate = global.Date;
class PatchedDate extends OriginalDate {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(originalNow() - ONE_YEAR_MS);
    } else {
      // @ts-ignore
      super(...args);
    }
  }
}
// Keep static methods
(PatchedDate as any).now = Date.now;
(PatchedDate as any).UTC = OriginalDate.UTC;
(PatchedDate as any).parse = OriginalDate.parse;

global.Date = PatchedDate as any;

try {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  console.log("Using Env Email:", email);
  console.log("Current Warp Time:", new Date().toISOString());

  const app = initializeApp({
    credential: cert({
      clientEmail: email,
      privateKey: privateKey,
      projectId: "ai-studio-4557280f-c588-4a23-9ac4-307fc42213b4"
    }),
    projectId: "ai-studio-4557280f-c588-4a23-9ac4-307fc42213b4"
  }, "test-warp-app-" + Date.now());

  const db = getFirestore(app);
  
  async function run() {
    console.log("📡 Attempting Firestore collection listing...");
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
