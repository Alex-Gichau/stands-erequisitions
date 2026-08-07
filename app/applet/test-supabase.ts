import http from 'http';
import https from 'https';

const getRedirectUrl = (url: string) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      resolve(res.headers.location);
    }).on('error', reject);
  });
};

(async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error("❌ SUPABASE_URL or VITE_SUPABASE_URL is not set in environment variables!");
    return;
  }
  const targetUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000`;
  console.log(await getRedirectUrl(targetUrl));
})();
