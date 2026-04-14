export const uploadToCloudinary = (file: File, onProgress?: (progress: number) => void): Promise<string> => {
  return new Promise((resolve, reject) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      reject(new Error("Cloudinary credentials are not configured."));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const xhr = new XMLHttpRequest();

    // Progress tracking
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress?.(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch {
          reject(new Error("Invalid response from Cloudinary"));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.error?.message || "Upload failed"));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    xhr.send(formData);
  });
};
