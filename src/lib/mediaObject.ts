import { randomBytes } from "crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { publicS3Env } from "./mediaEnv";
import { optimizePublicImage } from "./optimizeImage";
import { sniffImage } from "./sniffImage";

const MAX_BYTES = 8_000_000;
const INCOMING = /^incoming\/admin\/[0-9a-f]{32}$/;

let client: S3Client | null = null;

function storage() {
  const env = publicS3Env();
  if (!env.ready) return null;
  if (!client) {
    client = new S3Client({
      region: env.region,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    });
  }
  return { client, env };
}

async function putPublicImage(
  store: NonNullable<ReturnType<typeof storage>>,
  base: string,
  bytes: Buffer,
): Promise<string | null> {
  const optimized = await optimizePublicImage(bytes);
  if (!optimized) return null;
  if (optimized.kind === "gif") {
    const key = `${base}/original.gif`;
    await store.client.send(new PutObjectCommand({
      Bucket: store.env.publicBucket,
      Key: key,
      Body: optimized.body,
      ContentType: "image/gif",
      CacheControl: "public, max-age=31536000, immutable",
      ServerSideEncryption: "AES256",
    }));
    return `https://${store.env.cdnHost}/${key}`;
  }
  const objects = [
    { key: `${base}/original.${optimized.ext}`, body: optimized.original, type: optimized.mime },
    ...optimized.variants.map((variant) => ({
      key: `${base}/w${variant.width}.webp`,
      body: variant.body,
      type: "image/webp",
    })),
  ];
  for (const object of objects) {
    await store.client.send(new PutObjectCommand({
      Bucket: store.env.publicBucket,
      Key: object.key,
      Body: object.body,
      ContentType: object.type,
      CacheControl: "public, max-age=31536000, immutable",
      ServerSideEncryption: "AES256",
    }));
  }
  return `https://${store.env.cdnHost}/${base}/w1600.webp`;
}

export function newIncomingKey() {
  return `incoming/admin/${randomBytes(16).toString("hex")}`;
}

export async function presignIncomingUpload(key: string, bytes: number) {
  const store = storage();
  if (!store || !INCOMING.test(key) || bytes < 32 || bytes > MAX_BYTES) return null;
  const command = new PutObjectCommand({
    Bucket: store.env.publicBucket,
    Key: key,
    ContentType: "application/octet-stream",
  });
  const uploadUrl = await getSignedUrl(store.client, command, { expiresIn: 300 });
  return { uploadUrl, contentType: "application/octet-stream" };
}

export async function finishIncomingImage(key: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const store = storage();
  if (!store || !INCOMING.test(key)) return { ok: false, error: "That upload could not be accepted." };
  try {
    const head = await store.client.send(new HeadObjectCommand({
      Bucket: store.env.publicBucket,
      Key: key,
    }));
    if (!head.ContentLength || head.ContentLength < 32 || head.ContentLength > MAX_BYTES) {
      await store.client.send(new DeleteObjectCommand({ Bucket: store.env.publicBucket, Key: key }));
      return { ok: false, error: "This photo is too large. Choose a smaller one." };
    }
    const loaded = await store.client.send(new GetObjectCommand({
      Bucket: store.env.publicBucket,
      Key: key,
    }));
    const body = loaded.Body;
    if (!body) return { ok: false, error: "Could not store the photo. Please try again." };
    const bytes = Buffer.from(await body.transformToByteArray());
    if (bytes.length < 32 || bytes.length > MAX_BYTES) {
      await store.client.send(new DeleteObjectCommand({ Bucket: store.env.publicBucket, Key: key }));
      return { ok: false, error: "This photo is too large. Choose a smaller one." };
    }
    if (!sniffImage(bytes)) {
      await store.client.send(new DeleteObjectCommand({ Bucket: store.env.publicBucket, Key: key }));
      return { ok: false, error: "Choose a JPG, PNG, WebP or GIF photo." };
    }
    const now = new Date();
    const base = `public/admin/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(16).toString("hex")}`;
    const url = await putPublicImage(store, base, bytes);
    await store.client.send(new DeleteObjectCommand({ Bucket: store.env.publicBucket, Key: key }));
    if (!url) return { ok: false, error: "Choose a JPG, PNG, WebP or GIF photo." };
    return { ok: true, url };
  } catch (error) {
    console.error("[admin media]", error instanceof Error ? error.name : "finish failed");
    return { ok: false, error: "Could not store the photo. Please try again." };
  }
}

export async function storeAdminAvatar(bytes: Buffer): Promise<string | null> {
  if (!sniffImage(bytes) || bytes.length < 32 || bytes.length > 2_000_000) return null;
  const store = storage();
  if (!store) return null;
  const now = new Date();
  const base = `public/admin-avatar/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(16).toString("hex")}`;
  try {
    return await putPublicImage(store, base, bytes);
  } catch (error) {
    console.error("[admin avatar]", error instanceof Error ? error.name : "put failed");
    return null;
  }
}

export async function storeServerImage(bytes: Buffer): Promise<string | null> {
  if (!sniffImage(bytes) || bytes.length < 32 || bytes.length > 12_000_000) return null;
  const store = storage();
  if (!store) return null;
  const now = new Date();
  const base = `public/rehost/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(16).toString("hex")}`;
  try {
    return await putPublicImage(store, base, bytes);
  } catch (error) {
    console.error("[admin rehost]", error instanceof Error ? error.name : "put failed");
    return null;
  }
}

export async function presignPrivateDownload(key: string) {
  const store = storage();
  const privateBucket = process.env.FINDERB_S3_PRIVATE_BUCKET?.trim() || "";
  const allowed = (key.startsWith("private/cvs/") || key.startsWith("private/verification/")) && !key.includes("..");
  if (!store || !privateBucket || !allowed) return null;
  return getSignedUrl(
    store.client,
    new GetObjectCommand({ Bucket: privateBucket, Key: key }),
    { expiresIn: 600 },
  );
}
