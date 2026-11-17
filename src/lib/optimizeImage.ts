import sharp from "sharp";
import { sniffImage } from "./sniffImage";

export type StillVariant = { width: 360 | 720 | 1600; body: Buffer };

export type OptimizedPublicImage =
  | {
      kind: "still";
      ext: "jpg" | "png" | "webp";
      mime: "image/jpeg" | "image/png" | "image/webp";
      original: Buffer;
      variants: StillVariant[];
    }
  | { kind: "gif"; body: Buffer };

const WIDTHS = [360, 720, 1600] as const;

export async function optimizePublicImage(bytes: Buffer): Promise<OptimizedPublicImage | null> {
  const sniffed = sniffImage(bytes);
  if (!sniffed) return null;
  if (sniffed.ext === "gif") return { kind: "gif", body: bytes };
  try {
    const variants = await Promise.all(
      WIDTHS.map(async (width) => {
        const body = await sharp(bytes, { animated: false, failOn: "error" })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();
        return { width, body };
      }),
    );
    return {
      kind: "still",
      ext: sniffed.ext,
      mime: sniffed.mime,
      original: bytes,
      variants,
    };
  } catch {
    return null;
  }
}
