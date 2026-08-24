/**
 * Standalone Script: Sync & Warm Up All MongoDB Collections Directly into Valkey (Redis)
 *
 * Covers all 18 collections:
 *   1. alert / alerts
 *   2. church_groups
 *   3. fiscal_years
 *   4. forecast
 *   5. ledger_books
 *   6. notificationstates / notification_states
 *   7. permissions
 *   8. projects
 *   9. reports
 *  10. requisitions
 *  11. settings
 *  12. supplementary_budgets
 *  13. system_logs (live / exempt)
 *  14. thresholds
 *  15. transactions
 *  16. user_reaction_histories
 *  17. users
 *  18. vendors
 *
 * Usage:
 *   npx tsx scripts/sync-mongo-to-valkey.ts
 */

import mongoose from 'mongoose';
import Redis from 'ioredis';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stands_finance_db';
const VALKEY_URL = process.env.VALKEY_URL || 'redis://127.0.0.1:6379';

// Target list of standard known collections
const defaultCollections = [
  "alert", "alerts", "church_groups", "fiscal_years", "forecast",
  "ledger_books", "notificationstates", "notification_states",
  "permissions", "projects", "reports", "requisitions",
  "settings", "supplementary_budgets", "thresholds",
  "transactions", "user_reaction_histories", "users", "vendors"
];

function isPlainObject(item: any): boolean {
  return typeof item === 'object' && item !== null && !(item instanceof Date) && !(item instanceof RegExp) && !Array.isArray(item);
}

function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => toSnakeCase(v));
  } else if (isPlainObject(obj)) {
    return Object.keys(obj).reduce((result: any, key: string) => {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      result[snakeKey] = toSnakeCase(obj[key]);
      return result;
    }, {});
  }
  return obj;
}

async function run() {
  console.log('====================================================');
  console.log('🚀 PCEA eRequisitions — MongoDB to Valkey Synchronizer');
  console.log('====================================================');
  console.log(`[1/4] Connecting to MongoDB: ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI, { connectTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database handle is undefined');
  }
  console.log(`✅ Connected to MongoDB database: ${db.databaseName}`);

  console.log(`[2/4] Connecting to Valkey/Redis: ${VALKEY_URL}`);
  const redis = new Redis(VALKEY_URL, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000
  });

  await new Promise<void>((resolve, reject) => {
    redis.on('connect', () => {
      console.log('✅ Connected to Valkey successfully!');
      resolve();
    });
    redis.on('error', (err) => {
      console.error('❌ Valkey connection error:', err.message);
      reject(err);
    });
  });

  console.log('[3/4] Discovering all collections in MongoDB...');
  const mongoCollections = await db.listCollections().toArray();
  const foundNames = new Set(mongoCollections.map(c => c.name));
  console.log(`   Found ${foundNames.size} physical collections in MongoDB: [${Array.from(foundNames).join(', ')}]`);

  // Merge discovered collections with standard catalog (excluding audit_logs from cache)
  const allTargetCollections = new Set<string>();
  for (const name of foundNames) {
    if (name !== 'system_logs' && name !== 'audit_logs') {
      allTargetCollections.add(name);
    }
  }
  for (const name of defaultCollections) {
    allTargetCollections.add(name);
  }

  const dataMap: Record<string, any[]> = {};
  const statsSummary: Record<string, { count: number; source: string; status: string }> = {};

  for (const colName of allTargetCollections) {
    try {
      const rawDocs = await db.collection(colName).find({}).toArray();
      const cleanedDocs = rawDocs.map((doc: any) => {
        const { _id, __v, ...rest } = doc;
        const snake = toSnakeCase(rest);
        return { id: snake.id || String(_id), ...snake };
      });

      dataMap[colName] = cleanedDocs;
      statsSummary[colName] = {
        count: cleanedDocs.length,
        source: foundNames.has(colName) ? 'MongoDB (Physical)' : 'Virtual / Alias',
        status: 'CACHED IN VALKEY'
      };

      // Cache individual collection key in Valkey (TTL 1 hour)
      await redis.set(`col:${colName}`, JSON.stringify(cleanedDocs), 'EX', 3600);

      // Handle standard cross-alias keys
      if (colName === 'notificationstates') {
        await redis.set('col:notification_states', JSON.stringify(cleanedDocs), 'EX', 3600);
      } else if (colName === 'notification_states') {
        await redis.set('col:notificationstates', JSON.stringify(cleanedDocs), 'EX', 3600);
      }
      if (colName === 'alert') {
        await redis.set('col:alerts', JSON.stringify(cleanedDocs), 'EX', 3600);
      } else if (colName === 'alerts') {
        await redis.set('col:alert', JSON.stringify(cleanedDocs), 'EX', 3600);
      }

      console.log(`   📦 Cached col:${colName.padEnd(24)} (${cleanedDocs.length} documents)`);
    } catch (e: any) {
      console.warn(`   ⚠️ Warning querying collection ${colName}:`, e.message);
      dataMap[colName] = [];
      statsSummary[colName] = { count: 0, source: 'Error', status: 'FAILED' };
    }
  }

  // Ensure audit logs are exempted from Valkey cache (always fetched live from DB)
  await redis.del('col:audit_logs', 'col:system_logs');
  console.log('   🛡️ Verified: col:system_logs & col:audit_logs are exempted from Valkey (live DB mode)');

  // Cache master aggregated snapshot for instant portal bootstrapping
  console.log('[4/4] Writing master snapshot to Valkey key: col:db-all...');
  await redis.set('col:db-all', JSON.stringify(dataMap), 'EX', 3600);
  console.log('✅ Successfully cached col:db-all (Master Snapshot)');

  // Cache individual church groups
  const churchGroups = dataMap['church_groups'] || [];
  if (Array.isArray(churchGroups)) {
    for (const g of churchGroups) {
      const gId = g.id || g.group_id;
      if (gId) {
        await redis.set(`col:church_groups:${gId}`, JSON.stringify(g), 'EX', 3600);
      }
    }
    console.log(`✅ Cached ${churchGroups.length} individual church groups under col:church_groups:<id>`);
  }

  // Cache individual requisitions
  const requisitions = dataMap['requisitions'] || [];
  if (Array.isArray(requisitions)) {
    for (const r of requisitions) {
      const rId = r.id || r.document_id;
      if (rId) {
        await redis.set(`col:requisitions:${rId}`, JSON.stringify(r), 'EX', 3600);
      }
    }
    console.log(`✅ Cached ${requisitions.length} individual requisitions under col:requisitions:<id>`);
  }

  console.log('====================================================');
  console.log('🎉 SYNC COMPLETE! All 18 Collections Synced to Valkey:');
  console.table(statsSummary);
  console.log('====================================================');

  await redis.quit();
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal Error running sync:', err);
  process.exit(1);
});
