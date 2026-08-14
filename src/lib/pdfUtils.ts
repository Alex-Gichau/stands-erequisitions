import { compressImageFile } from "./imageCompression";

/**
 * Reads any uploaded File object and converts it to formatted attachment strings ("fileName::dataUrl").
 * Native PDF, DOCX, and XLSX files are read directly while images are automatically compressed.
 */
export async function processFileToAttachmentStrings(file: File): Promise<string[]> {
  try {
    const dataUri = await compressImageFile(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.82,
      mimeType: "image/webp",
    });

    const mime = file.type || "application/octet-stream";
    let normalized = dataUri;
    if (!normalized.startsWith("data:")) {
      normalized = `data:${mime};base64,${normalized}`;
    } else if (normalized.startsWith("data:;base64,") || normalized.startsWith("data:undefined;base64,")) {
      normalized = normalized.replace(/^data:[^;]*;base64,/, `data:${mime};base64,`);
    }

    return [`${file.name}::${normalized}`];
  } catch (error) {
    console.warn("Failed to process attachment file, falling back to raw reader:", error);
    return new Promise<string[]>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const mime = file.type || "application/octet-stream";
        let res = reader.result as string;
        if (!res.startsWith("data:")) res = `data:${mime};base64,${res}`;
        resolve([`${file.name}::${res}`]);
      };
      reader.onerror = () => {
        const mime = file.type || "application/octet-stream";
        resolve([`${file.name}::data:${mime};base64,RXJyb3IgcmVhZGluZyBmaWxl`]);
      };
      reader.readAsDataURL(file);
    });
  }
}
