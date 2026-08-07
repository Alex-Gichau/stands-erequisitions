
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: "fintech-requisitions"
});

const db = getFirestore(app, "ai-studio-standrewsrequisi-4557280f-c588-4a23-9ac4-307fc42213b4");

async function checkUser() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', 'gichaumburu@gmail.com').get();
  
  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }

  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}

checkUser();
