import * as dotenv from "dotenv";
dotenv.config();

console.log("=== ENVIRONMENT VARIABLES INSPECTION ===");
const keys = [
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
];

for (const k of keys) {
  const val = process.env[k];
  if (val === undefined) {
    console.log(`${k}: undefined`);
  } else {
    // Redact password and print info
    let safeVal = val;
    if (val.includes("@")) {
      safeVal = val.replace(/:[^@:]+@/, ':***@');
    } else if (val.length > 20) {
      safeVal = val.substring(0, 10) + "..." + val.substring(val.length - 10);
    }
    console.log(`${k}: defined (length: ${val.length}) -> ${safeVal}`);
    console.log(`  Contains '[YOUR-PASSWORD]'? ${val.includes('[YOUR-PASSWORD]')}`);
    console.log(`  Contains 'YOUR-PASSWORD'? ${val.includes('YOUR-PASSWORD')}`);
    console.log(`  Contains '<password>'? ${val.includes('<password>')}`);
    console.log(`  Contains 'PASSWORD'? ${val.toUpperCase().includes('PASSWORD') && !k.toUpperCase().includes('PASSWORD')}`);
  }
}
