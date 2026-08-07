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
  }, "test-app-" + Date.now());

  const db = getFirestore(app);
  
  async function run() {
    const collections = await db.listCollections();
    console.log("🟢 SUCCESS! Successfully authenticated to Firestore!");
    console.log("Collections list:", collections.map(c => c.id));
    
    // Let's count users
    const usersSnap = await db.collection("users").limit(3).get();
    console.log(`Successfully read 'users' collection. Count in sample: ${usersSnap.size}`);
    usersSnap.forEach(doc => {
      console.log(`- User: ${doc.id} => Name: ${doc.data().name || doc.data().displayName}`);
    });
  }

  run();
} catch (err: any) {
  console.error("❌ ERROR during Firestore verification:", err);
}
