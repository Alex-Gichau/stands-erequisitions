import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://178.104.122.211:27017/stands_finance_db";

async function testMongo() {
  try {
    console.log("Connecting to:", mongoUri);
    await mongoose.connect(mongoUri, { connectTimeoutMS: 5000 });
    console.log("Connected successfully. State:", mongoose.connection.readyState);
    
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log("Collections:");
      for (const col of collections) {
        const count = await mongoose.connection.db.collection(col.name).countDocuments();
        console.log(`- ${col.name}: ${count} documents`);
      }
    } else {
      console.log("No connection database object.");
    }
    
    await mongoose.disconnect();
  } catch (err: any) {
    console.error("Connection failed:", err.message);
  }
}

testMongo();
