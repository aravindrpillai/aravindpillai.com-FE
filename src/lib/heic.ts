/**
 * HEIC/HEIF (Apple photo) support.
 *
 * Only Safari can render HEIC natively, so photos are converted to JPEG in the
 * browser: before upload (so every recipient can see them) and at display time
 * (for HEIC uploads sent before this existed). The decoder (libheif wasm) is
 * large, so it's only loaded when a HEIC file actually shows up.
 */

const HEIC_MIMES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

export const isHeicMime = (mime: string) => HEIC_MIMES.has((mime || "").toLowerCase());

const hasHeicExtension = (name: string) => /\.(heic|heif)$/i.test(name || "");

/** Sniff the ISO-BMFF "ftyp" box: bytes 4..8 = "ftyp", bytes 8..12 = major brand. */
const hasHeicSignature = async (blob: Blob) => {
  try {
    const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (b.length < 12) return false;
    const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
    return ascii(4, 8) === "ftyp" && HEIC_BRANDS.has(ascii(8, 12));
  } catch {
    return false;
  }
};

/**
 * Is this a HEIC/HEIF photo? Windows/Chrome often report an empty `file.type`
 * for .heic files, so the extension and file signature are checked too.
 */
export const isHeicFile = async (file: File) => {
  if (isHeicMime(file.type) || hasHeicExtension(file.name)) return true;
  if (file.type && file.type !== "application/octet-stream") return false;
  return hasHeicSignature(file);
};

/** Decode a HEIC/HEIF blob to a JPEG blob. */
export const heicToJpeg = async (blob: Blob, quality = 0.9): Promise<Blob> => {
  const { heicTo } = await import("heic-to");
  return heicTo({ blob, type: "image/jpeg", quality });
};

/** Convert a picked HEIC file into a JPEG File (same base name, .jpg). */
export const heicFileToJpeg = async (file: File): Promise<File> => {
  const jpeg = await heicToJpeg(file);
  const base = (file.name || "photo").replace(/\.(heic|heif)$/i, "") || "photo";
  return new File([jpeg], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
};
