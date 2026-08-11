/**
 * Reads any uploaded File object and converts it to formatted attachment strings ("fileName::dataUrl").
 * Native PDF files are read directly without PDF-to-image conversion.
 */
export async function processFileToAttachmentStrings(file: File): Promise<string[]> {
  return new Promise<string[]>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      let result = reader.result as string;
      const mime = file.type || "application/octet-stream";
      if (!result || typeof result !== "string") {
        resolve([`${file.name}::data:${mime};base64,`]);
        return;
      }

      // Ensure data URI strictly conforms to data:[<mediatype>][;base64],<data>
      if (!result.startsWith("data:")) {
        result = `data:${mime};base64,${result}`;
      } else if (result.startsWith("data:;base64,") || result.startsWith("data:undefined;base64,")) {
        result = result.replace(/^data:[^;]*;base64,/, `data:${mime};base64,`);
      }

      if (file.type && file.type.startsWith("image/")) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_DIM = 1200;
          let width = img.width;
          let height = img.height;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const imgMime = file.type || "image/jpeg";
          const compressed = canvas.toDataURL(imgMime, 0.85);
          resolve([`${file.name}::${compressed}`]);
        };
        img.onerror = () => {
          resolve([`${file.name}::${result}`]);
        };
        img.src = result;
      } else {
        resolve([`${file.name}::${result}`]);
      }
    };
    reader.onerror = () => {
      const mime = file.type || "application/octet-stream";
      resolve([`${file.name}::data:${mime};base64,RXJyb3IgcmVhZGluZyBmaWxl`]);
    };
    reader.readAsDataURL(file);
  });
}
