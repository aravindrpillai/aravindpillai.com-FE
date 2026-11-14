/**
 * MIME detection for QChat uploads.
 *
 * Browsers (Windows especially) often report an empty or generic `file.type` for
 * HEIC, MKV, AVI, 3GP, RAW... so the extension is used as a fallback. The type is
 * stored inside the encrypted meta, which decides whether recipients see a photo,
 * a video player or a download tile.
 */

const EXT_MIME: Record<string, string> = {
  // ---- images ----
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  jfif: "image/jpeg",
  pjpeg: "image/jpeg",
  png: "image/png",
  apng: "image/apng",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  dib: "image/bmp",
  ico: "image/x-icon",
  cur: "image/x-icon",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  hif: "image/heif",
  jxl: "image/jxl",
  jp2: "image/jp2",
  // ---- videos ----
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  asf: "video/x-ms-asf",
  flv: "video/x-flv",
  f4v: "video/x-f4v",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  mpe: "video/mpeg",
  m2v: "video/mpeg",
  ts: "video/mp2t",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
  ogv: "video/ogg",
  vob: "video/dvd",
  hevc: "video/hevc",
  h264: "video/h264",
};

/** Odd/legacy MIME spellings some systems report -> the canonical one. */
const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "image/x-ms-bmp": "image/bmp",
  "image/vnd.microsoft.icon": "image/x-icon",
  "video/x-mp4": "video/mp4",
  "video/avi": "video/x-msvideo",
  "video/msvideo": "video/x-msvideo",
  "video/mkv": "video/x-matroska",
  "video/x-mkv": "video/x-matroska",
  "audio/x-matroska": "video/x-matroska",
};

const GENERIC = new Set(["", "application/octet-stream", "binary/octet-stream", "application/x-unknown"]);

const extOf = (name: string) => {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "";
};

/** Best-guess MIME type from a file name ("" when unknown). */
export const mimeFromName = (name: string) => EXT_MIME[extOf(name)] ?? "";

/** MIME for a picked file: the browser's type when specific, otherwise from the extension. */
export const resolveMime = (type: string, name: string) => {
  const t = (type || "").toLowerCase().trim();
  const canonical = MIME_ALIASES[t] ?? t;
  if (!GENERIC.has(canonical)) return canonical;
  return mimeFromName(name) || "application/octet-stream";
};

/**
 * Type to give the decrypted Blob so the <video>/<img> element plays it.
 * Chrome/Firefox play H.264/HEVC .mov/.m4v and most .mkv files when they are
 * labelled as MP4 / WebM, even though they refuse "video/quicktime".
 */
export const playbackMime = (mime: string) => {
  switch (mime) {
    case "video/quicktime":
    case "video/x-m4v":
      return "video/mp4";
    case "video/x-matroska":
      return "video/webm";
    default:
      return mime;
  }
};

/** Inline thumbnails are fetched automatically, so only for reasonably small images. */
export const MAX_INLINE_IMAGE_BYTES = 25 * 1024 * 1024;
