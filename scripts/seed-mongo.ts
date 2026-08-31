import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  User,
  Project,
  Requisition,
  AuditLog,
  Alert,
  FiscalYear,
  Transaction,
  Forecast,
  Report,
  Permission,
  Threshold,
  ChurchGroup,
  LedgerBook,
  SupplementaryBudget,
  Vendor,
} from '../src/models/index.ts';

dotenv.config();

let MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:41282/stands_finance_db";
if (MONGODB_URI.includes("@") && !MONGODB_URI.includes("authSource")) {
  if (MONGODB_URI.includes("?")) {
    MONGODB_URI += "&authSource=admin";
  } else {
    MONGODB_URI += "?authSource=admin";
  }
}

const mappings = [
  { model: User, file: 'users_export.json', name: 'User' },
  { model: Project, file: 'projects_export.json', name: 'Project' },
  { model: Requisition, file: 'requisitions_export.json', name: 'Requisition' },
  { model: AuditLog, file: 'activity_history.json', name: 'AuditLog' },
  { model: Alert, file: 'alerts_export.json', name: 'Alert' },
  { model: FiscalYear, file: 'fiscal_years_export.json', name: 'FiscalYear' },
  { model: Transaction, file: 'transactions_export.json', name: 'Transaction' },
  { model: Forecast, file: 'forecast_export.json', name: 'Forecast' },
  { model: Report, file: 'reports_export.json', name: 'Report' },
  { model: Permission, file: 'permissions_export.json', name: 'Permission' },
  { model: Threshold, file: 'thresholds_export.json', name: 'Threshold' },
  { model: ChurchGroup, file: 'church_groups.json', name: 'ChurchGroup' },
  { model: LedgerBook, file: 'ledger_books_export.json', name: 'LedgerBook' },
  { model: SupplementaryBudget, file: 'supplementary_budgets.json', name: 'SupplementaryBudget' },
  { model: Vendor, file: 'vendors_export.json', name: 'Vendor' },
];

/**
 * Seeds the database with data from JSON export files.
 */
export async function seedDatabase() {
  console.log(`[MongoDB Seeder] Checking/seeding database...`);
  
  for (const { model, file, name } of mappings) {
    try {
      const count = await model.countDocuments();
      if (count > 0) {
        console.log(`[MongoDB Seeder] Collection "${name}" already has ${count} records. Skipping.`);
        continue;
      }

      const dataDirVal = process.env.DATA_DIR?.trim() || path.join('server', 'data');
      const resolvedDataDir = path.isAbsolute(dataDirVal) ? dataDirVal : path.resolve(process.cwd(), dataDirVal);
      let filePath = path.join(resolvedDataDir, file);
      if (!fs.existsSync(filePath)) {
        const fallbackPath = path.join(process.cwd(), file);
        if (fs.existsSync(fallbackPath)) {
          filePath = fallbackPath;
        } else if (file === 'users_export.json' && fs.existsSync(path.join(process.cwd(), 'users.json'))) {
          filePath = path.join(process.cwd(), 'users.json');
        } else {
          console.warn(`[MongoDB Seeder] Source file ${file} not found at ${filePath} or root fallback. Skipping.`);
          continue;
        }
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      if (!raw.trim()) continue;

      let data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        data = [data];
      }

      // Pre-process certain fields to ensure compatibility
      const processed = data.map((item: any) => {
        const doc = { ...item };
        
        // Remove MongoDB internal _id if it's there
        if (doc._id) delete doc._id;

        // Coerce string booleans
        const booleanKeys = [
          "isActive", "is_active", "isApproved", "is_approved", "isSuspended", "is_suspended", "isOnline", "is_online",
          "flaggedForAudit", "flagged_for_audit", "inProcurement", "in_procurement", "requiresMoreInfo", "requires_more_info"
        ];
        for (const key of booleanKeys) {
          if (doc[key] === "true" || doc[key] === true) {
            doc[key] = true;
          } else if (doc[key] === "false" || doc[key] === false) {
            doc[key] = false;
          } else if (doc[key] === "" || doc[key] === null || doc[key] === undefined) {
            delete doc[key];
          } else {
            doc[key] = Boolean(doc[key]);
          }
        }

        // If the file represents permission records, make sure JSON parsed fields are actual objects
        if (name === 'Permission') {
          if (typeof doc.access === 'string') doc.access = JSON.parse(doc.access);
          if (typeof doc.actions === 'string') doc.actions = JSON.parse(doc.actions);
        }

        // Parse any date/timestamps
        const dateFields = [
          'createdAt', 'updatedAt', 'lastSeen', 'submittedAt', 'expiresAt', 
          'approvedAtL1', 'approvedAtL2', 'disbursedAt', 'lastRecurrenceGeneratedAt',
          'timestamp'
        ];
        for (const field of dateFields) {
          if (doc[field]) {
            const rawVal = doc[field];
            let parsedDate = new Date(rawVal);
            if (isNaN(parsedDate.getTime()) && typeof rawVal === 'string') {
              const match = rawVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{1,2}):(\d{1,2}))?$/);
              if (match) {
                const [_, day, month, year, hour, minute, second] = match;
                parsedDate = new Date(
                  Number(year),
                  Number(month) - 1,
                  Number(day),
                  hour ? Number(hour) : 0,
                  minute ? Number(minute) : 0,
                  second ? Number(second) : 0
                );
              }
            }
            if (!isNaN(parsedDate.getTime())) {
              doc[field] = parsedDate;
            } else {
              delete doc[field];
            }
          }
        }

        // Handle stringified subdocuments or arrays if any
        if (typeof doc.groups === 'string') {
          try { doc.groups = JSON.parse(doc.groups); } catch { doc.groups = [doc.groups]; }
        }
        if (typeof doc.approvalHistory === 'string') {
          try { doc.approvalHistory = JSON.parse(doc.approvalHistory); } catch { doc.approvalHistory = []; }
        }
        if (typeof doc.attachments === 'string') {
          try { doc.attachments = JSON.parse(doc.attachments); } catch { doc.attachments = []; }
        }
        if (typeof doc.receipts === 'string') {
          try { doc.receipts = JSON.parse(doc.receipts); } catch { doc.receipts = []; }
        }

        return doc;
      });

      if (processed.length > 0) {
        await (model as any).insertMany(processed);
        console.log(`[MongoDB Seeder] Successfully seeded ${processed.length} records into "${name}".`);
      }
    } catch (error: any) {
      console.error(`[MongoDB Seeder] Failed to seed ${name}:`, error.message);
    }
  }
}

// Run direct script if called natively
if (process.argv[1]?.endsWith('seed-mongo.ts') || process.argv[1]?.endsWith('seed-mongo.js')) {
  async function run() {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB at', MONGODB_URI);
      await seedDatabase();
      await mongoose.disconnect();
      console.log('Seeding finished successfully.');
      process.exit(0);
    } catch (err) {
      console.error('Seeding script failed:', err);
      process.exit(1);
    }
  }
  run();
}
