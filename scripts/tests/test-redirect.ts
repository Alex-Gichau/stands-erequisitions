import https from 'https';
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const appUrl = process.env.APP_URL || '';
if (!supabaseUrl || !appUrl) {
  console.error("❌ SUPABASE_URL/VITE_SUPABASE_URL or APP_URL is not set in environment variables!");
  process.exit(1);
}
const targetUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(appUrl)}`;

https.get(targetUrl, (res) => {
  console.log("Status:", res.statusCode);
  console.log("Location:", res.headers.location);
});
