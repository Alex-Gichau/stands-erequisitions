import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Local File Upload Endpoint (VPS Local Storage Support)
app.post("/api/attachments/upload", async (req, res) => {
  const { fileName, dataUrl } = req.body;
  if (!fileName || !dataUrl) {
    return res.status(400).json({ error: "Missing fileName or dataUrl payload." });
  }
  
  try {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Invalid dataUrl format. Must be a valid base64 data URL." });
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const uniquePrefix = Math.random().toString(36).substring(2, 10) + "_" + Date.now();
    const uniqueFileName = `${uniquePrefix}_${cleanFileName}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    fs.writeFileSync(filePath, buffer);
    
    const vpsIp = process.env.VPS_IP || "178.104.122.211";
    const serverPort = process.env.SERVER_PORT || process.env.PORT || "3000";
    const fileUrl = `http://${vpsIp}:${serverPort}/uploads/${uniqueFileName}`;
    console.log(`[Local Upload] Saved file to VPS local disk: ${fileUrl}`);
    
    res.json({ success: true, url: fileUrl });
  } catch (err: any) {
    console.error("[Local Upload] Failed saving file:", err.message || err);
    res.status(500).json({ error: `Failed to store attachment locally: ${err.message || err}` });
  }
});

interface Activity {
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
  metadata?: any;
}

// Ensure activity_history.json exists or create it
function restoreActivities(): Activity[] {
  try {
    const filePath = path.join(process.cwd(), "activity_history.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading activity_history.json:", err);
  }
  return [];
}

function persistActivity(activity: Activity) {
  try {
    const filePath = path.join(process.cwd(), "activity_history.json");
    const activities = restoreActivities();
    activities.push(activity);
    fs.writeFileSync(filePath, JSON.stringify(activities, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing activity_history.json:", err);
  }
}

function generateSlackThreadSummary(): string {
  const activities = restoreActivities();
  if (activities.length === 0) {
    return "No historical user activities recorded yet.";
  }

  // Sort chronologically/descending to display latest info on top
  // Limit to most recent 20 activities to stay within Slack per-block limits
  const sorted = [...activities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  const loginsAndLogouts: string[] = [];
  const crudOps: string[] = [];
  const others: string[] = [];

  sorted.forEach(act => {
    const actionLower = act.action.toLowerCase();
    const timeStr = new Date(act.timestamp).toLocaleString();
    const line = `• *[${timeStr}]* _${act.performedBy}_ performed *${act.action}*: ${act.details}`;

    // Priority 1: Login & Logout
    if (
      actionLower.includes("login") || 
      actionLower.includes("logout") || 
      actionLower.includes("sign_in") ||
      actionLower.includes("sign_out") ||
      actionLower.includes("session")
    ) {
      loginsAndLogouts.push(line);
    } 
    // Priority 2: CRUD
    else if (
      actionLower.includes("create") || 
      actionLower.includes("update") || 
      actionLower.includes("delete") || 
      actionLower.includes("submit") || 
      actionLower.includes("approve") || 
      actionLower.includes("reject") ||
      actionLower.includes("disburse") ||
      actionLower.includes("cancel") ||
      actionLower.includes("add") ||
      actionLower.includes("save")
    ) {
      crudOps.push(line);
    } 
    // Others
    else {
      others.push(line);
    }
  });

  let text = "";
  text += "*🔐 USER ACTIVITY: LOGINS & LOGOUTS SESSION HISTORY (PRIORITY 1)*\n";
  if (loginsAndLogouts.length > 0) {
    text += loginsAndLogouts.join("\n") + "\n";
  } else {
    text += "• No session login/logout actions recorded yet.\n";
  }

  text += "\n*📂 USER ACTIVITY: LEDGER & RECORD CRUD OPERATIONS (PRIORITY 2)*\n";
  if (crudOps.length > 0) {
    text += crudOps.join("\n") + "\n";
  } else {
    text += "• No record mutations or CRUD operations recorded yet.\n";
  }

  if (others.length > 0) {
    text += "\n*⚙️ OTHER OPERATIONAL EVENTS AND SIGNALS*\n";
    text += others.join("\n") + "\n";
  }

  if (activities.length > 20) {
    text += `\n... and ${activities.length - 20} more historical records.`;
  }

  // Safety truncation for Slack 3000 char block limit
  if (text.length > 2900) {
    text = text.substring(0, 2897) + "...";
  }

  return text;
}

// API Route for Slack Notifications
app.post("/api/notify-slack", async (req, res) => {
  const { action, details, performedBy, timestamp, metadata, level = "normal" } = req.body;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL is not defined in environment variables.");
    return res.status(503).json({ error: "Slack integration not configured" });
  }

  try {
    // Persist the current activity first
    persistActivity({ action, details, performedBy, timestamp, metadata });

    // Build the long thread summary
    const summaryText = generateSlackThreadSummary();

    let color = "#4b5563"; // Default slate gray
    let headerText = "🚨 System Ledger Alert";

    const actLower = action ? action.toLowerCase() : "";
    if (actLower.includes("login") || actLower.includes("sign_in")) {
      color = "#3b82f6"; // Blue
      headerText = "👋 User Session Started (Login)";
    } else if (actLower.includes("logout") || actLower.includes("sign_out")) {
      color = "#64748b"; // Slate
      headerText = "✌️ User Session Ended (Logout)";
    } else if (actLower.includes("created") || actLower.includes("submitted") || actLower.includes("submit") || actLower.includes("create")) {
      color = "#6366f1"; // Indigo
      headerText = "✨ New Requisition Submitted";
    } else if (actLower.includes("approved_l1")) {
      color = "#10b981"; // L1 Green
      headerText = "✅ Compliance L1 Clearance Granted";
    } else if (actLower.includes("approved_l2")) {
      color = "#059669"; // L2 Dark Green
      headerText = "👑 Keymaster L2 Signing Certified";
    } else if (actLower.includes("approve")) {
      color = "#10b981"; // Green
      headerText = "✅ Requisition Authorized";
    } else if (actLower.includes("reject")) {
      color = "#ef4444"; // Red
      headerText = "❌ Requisition Returned / Rejected";
    } else if (actLower.includes("disburse") || actLower.includes("payment")) {
      color = "#f59e0b"; // Amber
      headerText = "💸 Funds Disbursed / Financial Settlement";
    } else if (actLower.includes("fail") || actLower.includes("security") || actLower.includes("unauthorized") || actLower.includes("bypass") || actLower.includes("suspension")) {
      color = "#dc2626"; // Crimson
      headerText = "🚨 SECURITY AUDIT RISK ALERT";
    } else if (level === "critical" || level === "abnormal") {
      color = "#ef4444"; // Red/Alert
      headerText = "⚠️ High Severity System Signal";
    }

    const slackBody = {
      attachments: [
        {
          color: color,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: headerText,
                emoji: true
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Action:*\n${action}`
                },
                {
                  type: "mrkdwn",
                  text: `*User:*\n${performedBy}`
                }
              ]
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Details:* ${details}`
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*Timestamp:* ${timestamp}`
                }
              ]
            }
          ]
        },
        {
          color: "#4A5568",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🧵 LONG ACTIVITY THREAD SUMMARY",
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: summaryText
              }
            }
          ]
        }
      ]
    };

    if (metadata && Object.keys(metadata).length > 0) {
      slackBody.attachments[0].blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Extended Metadata:*\n" + Object.entries(metadata).map(([k, v]) => `• *${k}:* ${v}`).join("\n")
        }
      });
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackBody)
    });

    if (!response.ok) {
      throw new Error(`Slack responded with ${response.status}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to send Slack notification on Vercel:", error);
    res.status(500).json({ error: "Failed to notify Slack" });
  }
});

// API Route for Sending Email
app.post("/api/send-email", async (req, res) => {
  const { to, requesterName, amount, title } = req.body;
  console.log(`Sending disbursement email notification to ${to}...`);
  
  // Simulate real mail transfer delay (SMTP handshake, transfer)
  await new Promise(resolve => setTimeout(resolve, 1800));

  try {
    persistActivity({
      action: "EMAIL_DISPATCH",
      details: `Disbursement Confirmation Email sent to ${requesterName} <${to}> regarding '${title}' (Amount: KES ${Number(amount).toLocaleString()})`,
      performedBy: "SYSTEM_MAILER",
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, deliveredTo: to, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Failed to send email:", err);
    res.status(500).json({ error: "SMTP Dispatch simulation failed" });
  }
});

// Standalone health endpoint for testing Vercel Serverless connectivity
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", host: "vercel-serverless-endpoint" });
});

// Wildcard API fallback
app.all("*", (req, res) => {
  res.status(404).json({ error: `Vercel Serverless: API route ${req.method} ${req.path} not matched.` });
});

export default app;
