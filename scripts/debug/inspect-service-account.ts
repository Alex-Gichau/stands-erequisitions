import fs from 'fs';

try {
  const serviceAccount = JSON.parse(fs.readFileSync('./googleService.json', 'utf8'));
  console.log("=== googleService.json Fields ===");
  for (const k of Object.keys(serviceAccount)) {
    if (k === "private_key") {
      console.log(`${k}: [REDACTED] (length: ${serviceAccount[k]?.length})`);
    } else {
      console.log(`${k}: ${JSON.stringify(serviceAccount[k])}`);
    }
  }
} catch (err: any) {
  console.error("Error inspecting service account:", err.message);
}
