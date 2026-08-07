import express from "express";
import path from "path";
import fs from "fs";
import mime from "mime-types";

const router = express.Router();
const uploadsDir = path.join(process.cwd(), "uploads");

// Ensure the ./uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Express router serving static files from the './uploads' directory.
 * Uses 'mime-types' to dynamically set the Content-Type header based on the file extension
 * (e.g., application/pdf for .pdf) and inline Content-Disposition so documents render seamlessly.
 */
router.use(
  express.static(uploadsDir, {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      const contentType = mime.lookup(filePath) || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      const filename = path.basename(filePath);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    },
  })
);

// Explicit route handler for /:filename guaranteeing exact Content-Type headers via mime-types
router.get("/:filename", (req, res, next) => {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    if (safeFilename.endsWith(".js") || safeFilename.includes("sw.js")) {
      return res.status(404).type("application/javascript").send("// Script or service worker not found in uploads");
    }
    return next();
  }

  const contentType = mime.lookup(safeFilename) || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(safeFilename)}"`);
  res.setHeader("Cache-Control", "public, max-age=86400");

  return res.sendFile(filePath);
});

export default router;
