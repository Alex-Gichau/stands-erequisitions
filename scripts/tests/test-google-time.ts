async function checkTime() {
  try {
    const res = await fetch("https://www.google.com", { method: "HEAD" });
    const dateHeader = res.headers.get("date");
    console.log("Real Google Time Header:", dateHeader);
    if (dateHeader) {
      const realTime = new Date(dateHeader);
      const systemTime = new Date();
      console.log("System Time:", systemTime.toISOString());
      console.log("Real Time:", realTime.toISOString());
      const diffMs = systemTime.getTime() - realTime.getTime();
      console.log("Difference (System - Real) in MS:", diffMs);
      console.log("Difference in Days:", diffMs / (24 * 60 * 60 * 1000));
    }
  } catch (err: any) {
    console.error("Error getting time:", err.message);
  }
}
checkTime();
