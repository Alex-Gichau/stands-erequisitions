
async function testRest() {
  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY;

  console.log("Testing REST API at:", url);
  
  try {
    const response = await fetch(`${url}/rest/v1/requisitions?select=*`, {
      headers: {
        'apikey': anonKey!,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log("🟢 REST API Success!");
      console.log("Requisitions count:", data.length);
      if (data.length > 0) {
        console.log("Sample Requisition:", JSON.stringify(data[0]).substring(0, 200));
      }
    } else {
      console.error("❌ REST API Failed:", response.status, await response.text());
    }
  } catch (err) {
    console.error("❌ REST API Error:", err);
  }
}

testRest();
