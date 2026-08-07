import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

// Ensure the public directory exists
const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Find the generated images inside /src/assets/images/
const imagesDir = path.join(process.cwd(), "src", "assets", "images");
let authFlowImg = "";
let reqLifecycleImg = "";
let dashboardOverviewImg = "";

if (fs.existsSync(imagesDir)) {
  const files = fs.readdirSync(imagesDir);
  authFlowImg = files.find(f => f.startsWith("auth_flow_diagram")) || "";
  reqLifecycleImg = files.find(f => f.startsWith("requisition_lifecycle")) || "";
  dashboardOverviewImg = files.find(f => f.startsWith("dashboard_overview")) || "";
}

console.log("Found assets:", { authFlowImg, reqLifecycleImg, dashboardOverviewImg });

// Initialize jsPDF document (standard A4 size: 210mm x 297mm)
const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4"
});

const pageWidth = 210;
const pageHeight = 297;

// Utility to convert file to base64 Data URL
function getBase64Image(fileName: string): string {
  if (!fileName) return "";
  const filePath = path.join(imagesDir, fileName);
  if (!fs.existsSync(filePath)) return "";
  const bitmap = fs.readFileSync(filePath);
  return `data:image/png;base64,${bitmap.toString("base64")}`;
}

const authBase64 = getBase64Image(authFlowImg);
const reqBase64 = getBase64Image(reqLifecycleImg);
const dashBase64 = getBase64Image(dashboardOverviewImg);

// Color Palette
const COLORS = {
  primary: "#4f46e5", // Indigo / Blue primary font and lines
  dark: "#0f172a",    // Slate-900 background text and highlights
  gray: "#475569",    // Slate-600 body text
  lightGray: "#f8fafc", // Slate-50 background blocks
  accent: "#10b981"  // Emerald-500 for status highlights
};

// Custom header/footer generator
function drawPageDecorations(pdf: jsPDF, pageNum: number, totalPages: number, sectionTitle: string) {
  if (pageNum === 1) return; // Skip for cover page
  
  // Header line
  pdf.setDrawColor(226, 232, 240); // slate-200
  pdf.setLineWidth(0.3);
  pdf.line(15, 15, pageWidth - 15, 15);
  
  // Header text
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(COLORS.gray);
  pdf.text("STANDS REQUISITION APPLET • USER MANUAL", 15, 12);
  pdf.text(sectionTitle.toUpperCase(), pageWidth - 15, 12, { align: "right" });
  
  // Footer line
  pdf.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
  
  // Footer text
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
  pdf.text("System Live Ledger Integration Documentation", 15, pageHeight - 10);
  pdf.text("ST. ANDREWS FINANCE SYSTEM", pageWidth - 15, pageHeight - 10, { align: "right" });
}

// Draw Title Cover (Page 1)
function drawCoverPage() {
  // Top deep header block background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 110, "F");
  
  // Soft decorative vector highlights
  doc.setFillColor(79, 70, 229, 0.2); // indigo
  doc.rect(15, 15, 6, 6, "F");
  
  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text("STANDS", 20, 45);
  doc.text("REQUISITION SYSTEM", 20, 60);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setFillColor(COLORS.primary);
  doc.rect(20, 70, 35, 1.5, "F");
  
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(12);
  doc.text("Interactive User Manual & Financial Workflow Guide", 20, 80);
  
  // Metadata Info
  doc.setTextColor(COLORS.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SYSTEM ARCHITECTURE & MANUAL", 20, 130);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.gray);
  const introText = "This manual describes the user flows, role architectures, security credentials, and requisition life cycles of the St. Andrews Church Ministry Group Requisition System. Use this document to understand the validation, approval chains, and final mobile/banking disbursement protocols.";
  const splitIntro = doc.splitTextToSize(introText, pageWidth - 40);
  doc.text(splitIntro, 20, 140);
  
  // Quick Reference roles block
  doc.setFillColor(COLORS.lightGray);
  doc.rect(20, 175, pageWidth - 40, 70, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(20, 175, pageWidth - 40, 70, "D");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.dark);
  doc.text("DOCUMENT VERIFICATION SCOPE:", 25, 187);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(COLORS.gray);
  doc.text("• Onboarding & Identity Approval (Waiting Room status)", 25, 197);
  doc.text("• Requisition submission (Sourcing vendors, budget allocations and files)", 25, 205);
  doc.text("• Multi-Level Verification Lifecycle (L1 Verifier & L2 Keymaster sign-off)", 25, 213);
  doc.text("• Treasury Release Ledger Ops (Automated payouts and checking account reconciliation)", 25, 221);
  doc.text("• Administration Panel Oversight (User permission controls, audit tables)", 25, 229);
  
  // Version and Date Footer
  doc.setFontSize(9);
  doc.setTextColor(COLORS.gray);
  doc.text("Prepared for: St. Andrews Finance Department", 20, 275);
  doc.text("Document Version: 2.1 (Production)", pageWidth - 20, 275, { align: "right" });
}

// Onboarding Page (Page 2)
function drawOnboardingPage() {
  doc.addPage();
  const pageNum = 2;
  const sectionTitle = "1. Identity Onboarding Flows";
  drawPageDecorations(doc, pageNum, 4, sectionTitle);
  
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(COLORS.dark);
  doc.text("1. Identity Access Control & Onboarding", 15, 28);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.gray);
  const bodyText = "The STANDS Requisition portal adopts a zero-trust architecture. When a new system member registers, they are restricted to a secured 'Waiting Room' state. A Super Administrator or Finance Controller must verify the request, assign the appropriate Ministry Group (such as Youth, Choir, Outreach), and authorize Ledger Access before the user can participate in transactions.";
  const splitBody = doc.splitTextToSize(bodyText, pageWidth - 30);
  doc.text(splitBody, 15, 36);
  
  // Add Diagram Headline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.primary);
  doc.text("SECURITY REGISTRATION WORKFLOW FLOWCHART:", 15, 62);
  
  // Draw Placeholder or Actual Image
  if (authBase64) {
    // A4 width minus padding is 180. Let's do width=170, height=95
    doc.addImage(authBase64, "PNG", 20, 68, 170, 95);
  } else {
    // Draw solid placeholder box
    doc.setFillColor(241, 245, 249);
    doc.rect(20, 68, 170, 95, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("Security Authorization Flowchart Grid Placeholder", pageWidth / 2, 115, { align: "center" });
  }
  
  // Explanatory bullets for flow below image
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.dark);
  doc.text("STEP-BY-STEP USER ENTRANCE:", 15, 178);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.gray);
  
  const boldPrefixes = [
    "A. Member Sign Up: ",
    "B. Waiting Room Redirect: ",
    "C. Admin Verification: ",
    "D. Main System Access: "
  ];
  
  const stepTexts = [
    "User submits credentials, choosing their main email and setting up the password profile.",
    "System checks credentials in high-security rules; holds the user in state 'Synchronization Pending' page.",
    "The Sudo Admin receives an event notification, verifies the registrant's affiliation, selects their active Ministry Group line, and toggles Access Status to 'Approved'.",
    "Once synchronized, the user is automatically redirected to the system's live home dashboard, populated with their group's budgets and ledger summaries."
  ];

  let currentY = 188;
  for (let i = 0; i < stepTexts.length; i++) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.dark);
    doc.text(boldPrefixes[i], 15, currentY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.gray);
    const splitStep = doc.splitTextToSize(stepTexts[i], pageWidth - 30 - doc.getTextWidth(boldPrefixes[i]));
    doc.text(splitStep, 15 + doc.getTextWidth(boldPrefixes[i]), currentY);
    currentY += 12;
  }
}

// Requisitions Lifecycle Page (Page 3)
function drawRequisitionsPage() {
  doc.addPage();
  const pageNum = 3;
  const sectionTitle = "2. Requisition Lifecycles";
  drawPageDecorations(doc, pageNum, 4, sectionTitle);
  
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(COLORS.dark);
  doc.text("2. Requisition Submission & Approval Pipeline", 15, 28);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.gray);
  const bodyText = "Ledger accounts on STANDS are linked directly to approved ministry projects and budget codes. Submitting a requisition launches a highly trackable status chain. Requisitions require digital vendor validation and multi-signature checkpoints (L1 & L2 validation) before arriving in the disbursement ledger.";
  const splitBody = doc.splitTextToSize(bodyText, pageWidth - 30);
  doc.text(splitBody, 15, 36);
  
  // Diagram Headline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.primary);
  doc.text("APPROVAL PIPELINE STAGES & DIGITAL CODES:", 15, 62);
  
  // Draw image
  if (reqBase64) {
    doc.addImage(reqBase64, "PNG", 20, 68, 170, 95);
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(20, 68, 170, 95, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("Requisition Pipeline Flow Diagram", pageWidth / 2, 115, { align: "center" });
  }
  
  // Flow details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.dark);
  doc.text("UNDERSTANDING STATUS BAR SYCKPOINTS:", 15, 178);
  
  const statusPoints = [
    { name: "SUBMITTED:", desc: "Initial draft submitted by Ministry Rep. Notified instantly on the global ledger. Triggers an email alert to the L1 Verification Board." },
    { name: "APPROVED_L1:", desc: "Requisition vetted by L1 Verifiers for compliance, receipts, and vendor validity. Approved for general project scope." },
    { name: "APPROVED_L2:", desc: "Treasury sign-off by L2 Keymasters. Authorizes the transaction against corresponding checking accounts." },
    { name: "DISBURSED:", desc: "Final ledger payout completed. Records physical banking checks, receipt tokens, and ledger event archives." }
  ];
  
  let currentY = 188;
  statusPoints.forEach(point => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.dark);
    doc.text(point.name, 15, currentY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.gray);
    const splitDesc = doc.splitTextToSize(point.desc, pageWidth - 30 - doc.getTextWidth(point.name) - 2);
    doc.text(splitDesc, 15 + doc.getTextWidth(point.name) + 2, currentY);
    currentY += 14;
  });
}

// Dashboard & Roles Guide (Page 4)
function drawDashboardPage() {
  doc.addPage();
  const pageNum = 4;
  const sectionTitle = "3. Portal Control & Dashboard";
  drawPageDecorations(doc, pageNum, 4, sectionTitle);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(COLORS.dark);
  doc.text("3. Control Dashboard & System Administration", 15, 28);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.gray);
  const bodyText = "The central administrator dashboard allows real-time insights of active exposure, requisition volume, and upcoming payouts. System roles are granular, authorizing operations from budget adjustments to manual audit logs. The dashboard aggregates project breakdowns to ensure full visibility.";
  const splitBody = doc.splitTextToSize(bodyText, pageWidth - 30);
  doc.text(splitBody, 15, 36);
  
  // Diagram Headline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.primary);
  doc.text("DASHBOARD LIVE TRACKING INTEGRATION OVERVIEW:", 15, 62);
  
  // Draw image
  if (dashBase64) {
    doc.addImage(dashBase64, "PNG", 20, 68, 170, 95);
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(20, 68, 170, 95, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("Dashboard View Illustration", pageWidth / 2, 115, { align: "center" });
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.dark);
  doc.text("GRANULAR USER ROLE ASSIGNMENTS:", 15, 178);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.gray);
  const rolesText = "The system implements four tiers of authentication:\n" +
    "1. MINISTRY_REP: Can submit new requisitions and edit their group's entries while in draft stage.\n" +
    "2. APPROVER_L1: General committee verifiers. Inspects quotes, compares bids, and pushes to Level 2. \n" +
    "3. APPROVER_L2: Senior treasury officers. Checks funding pools, marks final authorization status.\n" +
    "4. SUPER_ADMIN: Global system configurations, adding new groups, manual ledger adjustments, and member status edits.";
  const splitRoles = doc.splitTextToSize(rolesText, pageWidth - 30);
  doc.text(splitRoles, 15, 186);
}

// Write A4 pages to PDF buffer and output to files
try {
  drawCoverPage();
  drawOnboardingPage();
  drawRequisitionsPage();
  drawDashboardPage();
  
  const buffer = doc.output();
  const outputPath = path.join(publicDir, "User_Manual_StAndrews.pdf");
  
  fs.writeFileSync(outputPath, buffer, "binary");
  console.log(`PDF created successfully at: ${outputPath}`);
} catch (error) {
  console.error("Error creating User Manual PDF:", error);
}
