import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let mongoUri = process.env.MONGODB_URI || "mongodb://178.104.122.211:27017/stands_finance_db";
if (mongoUri.includes("@") && !mongoUri.includes("authSource")) {
  if (mongoUri.includes("?")) {
    mongoUri += "&authSource=admin";
  } else {
    mongoUri += "?authSource=admin";
  }
}

async function testMongo() {
  try {
    console.log("Connecting to:", mongoUri);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected successfully. Connection state:", mongoose.connection.readyState);
    
    const db = mongoose.connection.db;
    if (db) {
      // 1. List all databases
      console.log("\n--- LISTING ALL DATABASES ---");
      const adminDb = db.admin();
      const dbList = await adminDb.listDatabases();
      console.log("Databases on server:", JSON.stringify(dbList.databases, null, 2));

      // 2. List collections in stands_finance_db
      console.log("\n--- LISTING COLLECTIONS IN stands_finance_db ---");
      const collections = await db.listCollections().toArray();
      console.log("Collections:", collections.map(c => c.name));
      for (const colInfo of collections) {
        const count = await db.collection(colInfo.name).countDocuments();
        console.log(`- Collection '${colInfo.name}': ${count} documents`);
      }

      // 3. Read Ransom note details if READ_ME_TO_RECOVER_YOUR_DATA exists
      const ransomDbExists = dbList.databases.some(d => d.name === 'READ_ME_TO_RECOVER_YOUR_DATA');
      if (ransomDbExists) {
        console.log("\n--- READ RANSOM NOTE FROM READ_ME_TO_RECOVER_YOUR_DATA ---");
        const conn = mongoose.createConnection(mongoUri.replace(/\/stands_finance_db(\?|$)/, `/READ_ME_TO_RECOVER_YOUR_DATA$1`));
        await conn.asPromise();
        if (conn.db) {
          const collectionsList = await conn.db.listCollections().toArray();
          console.log("Collections in READ_ME_TO_RECOVER_YOUR_DATA:", collectionsList.map(c => c.name));
          
          for (const col of collectionsList) {
            const docs = await conn.db.collection(col.name).find({}).toArray();
            console.log(`Documents in collection '${col.name}':`);
            console.log(JSON.stringify(docs, null, 2));
          }
        }
        await conn.close();
      } else {
        console.log("\nNo READ_ME_TO_RECOVER_YOUR_DATA database found on this server.");
      }
    } else {
      console.log("No db instance on mongoose connection.");
    }
    
    await mongoose.disconnect();
  } catch (err: any) {
    console.error("Connection failed:", err.message);
  }
}

testMongo();

