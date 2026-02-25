import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { v2 as cloudinary } from "cloudinary";

type UploadPurpose = "avatar" | "cover" | "social";

type StoreUploadedImageInput = {
  buffer: Buffer;
  mime: string;
  purpose: UploadPurpose;
  userId: string;
};

type StoreUploadedImageResult = {
  url: string;
  provider: "cloudinary" | "local";
};

let cloudinaryConfigured = false;

function configureCloudinary() {
  if (cloudinaryConfigured) return;
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    cloudinaryConfigured = true;
  }
}

function cloudinaryReady() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  return Boolean(cloudName && apiKey && apiSecret);
}

export function isSupportedImageMime(mime: string, allowGif = false) {
  const m = String(mime || "").toLowerCase();
  const accepted = allowGif
    ? ["image/jpeg", "image/png", "image/webp", "image/gif"]
    : ["image/jpeg", "image/png", "image/webp"];
  return accepted.includes(m);
}

function extFromMime(mime: string) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  return "";
}

function ensureLocalUploadsDir() {
  const dir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function uploadToCloudinary(input: StoreUploadedImageInput): Promise<string> {
  configureCloudinary();
  const folder = String(process.env.CLOUDINARY_FOLDER || "supcontent").trim();
  const publicId = `${input.purpose}_${input.userId}_${randomUUID()}`;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
      },
      (err, result) => {
        if (err) return reject(err);
        const url = String(result?.secure_url || result?.url || "").trim();
        if (!url) return reject(new Error("cloudinary_upload_missing_url"));
        resolve(url);
      }
    );
    stream.end(input.buffer);
  });
}

function uploadToLocal(input: StoreUploadedImageInput): string {
  const ext = extFromMime(input.mime);
  if (!ext) throw new Error("unsupported_mime");
  const dir = ensureLocalUploadsDir();
  const filename = `${input.purpose}_${input.userId}_${randomUUID()}${ext}`;
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, input.buffer);
  return `/uploads/${filename}`;
}

export async function storeUploadedImage(input: StoreUploadedImageInput): Promise<StoreUploadedImageResult> {
  if (cloudinaryReady()) {
    try {
      const url = await uploadToCloudinary(input);
      return { url, provider: "cloudinary" };
    } catch (e: any) {
      console.error("Cloudinary upload failed, fallback local:", e?.message || e);
    }
  }
  return { url: uploadToLocal(input), provider: "local" };
}

