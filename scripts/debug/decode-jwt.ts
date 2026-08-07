const anonKey = process.env.SUPABASE_ANON_KEY || "";
console.log("ANON_KEY length:", anonKey.length);

if (anonKey) {
  try {
    const parts = anonKey.split('.');
    if (parts.length === 3) {
      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      console.log("Decoded JWT Payload:", JSON.parse(payload));
    } else {
      console.log("Not a valid 3-part JWT");
    }
  } catch (err: any) {
    console.error("Failed to decode JWT:", err);
  }
}
