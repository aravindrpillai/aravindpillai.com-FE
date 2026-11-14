/**
 * QChat end-to-end encryption (browser side).
 *
 * The chat code is stretched with PBKDF2-SHA256 (600k iterations, salt bound to
 * the chat name) into 64 bytes:
 *   - bytes[0:32]  -> AES-256-GCM key. Non-extractable, never leaves the browser.
 *   - bytes[32:64] -> auth token (hex), sent to the server in the "token" header.
 * The server stores only SHA-256(token), so it cannot derive the message key.
 *
 * MUST stay in sync with aravindrpillai.com-BE/qchat/crypto.py.
 */
import CryptoJS from "crypto-js";

const PBKDF2_ITERATIONS = 600_000;
const V2_PREFIX = "v2:";
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface QChatKeys {
  encKey: CryptoKey;
  token: string;
  name: string;
  /** Only used to read messages written by the old (pre-v2) client. */
  legacyCode: string;
}

const toHex = (buf: Uint8Array) =>
  Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");

const toB64 = (buf: Uint8Array) => {
  let s = "";
  buf.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};

const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function deriveKeys(code: string, name: string): Promise<QChatKeys> {
  if (!window.isSecureContext || !crypto?.subtle) {
    throw new Error("Secure context (HTTPS) required for encryption");
  }
  const material = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(`qchat|v2|${name}`), iterations: PBKDF2_ITERATIONS },
      material,
      512
    )
  );
  const encKey = await crypto.subtle.importKey("raw", bits.slice(0, 32), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  const token = toHex(bits.slice(32, 64));
  bits.fill(0);
  return { encKey, token, name, legacyCode: code };
}

/** AES-256-GCM with a fresh random IV per message; chat name bound as associated data. */
export async function encryptMessage(keys: QChatKeys, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(keys.name) },
      keys.encKey,
      enc.encode(plain)
    )
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return V2_PREFIX + toB64(out);
}

/*
 * Files are encrypted in chunks so large uploads (up to 200 MB) never need the
 * whole plaintext in one buffer and progress can be reported.
 *
 * Chunked format ("QCF1"):
 *   header(16) = "QCF1"(4) || noncePrefix(8, random per file) || chunkSize(u32 BE)
 *   then for each chunk i: AES-256-GCM(chunk_i) incl. 16-byte tag
 *     iv  = noncePrefix || u32BE(i)          (unique per chunk, never reused)
 *     aad = "<chat name>|file|c|<i>|<1 if last chunk else 0>"
 * The index stops chunks being reordered; the "last" flag stops truncation.
 *
 * Legacy format (older uploads): iv(12) || ciphertext+tag over the whole file.
 */
const FILE_MAGIC = [0x51, 0x43, 0x46, 0x31]; // "QCF1"
const FILE_HEADER_LEN = 16;
const FILE_CHUNK = 1024 * 1024; // 1 MiB plaintext per chunk
const GCM_TAG = 16;

export type Progress = (fraction: number) => void;

const chunkIv = (prefix: Uint8Array, index: number) => {
  const iv = new Uint8Array(12);
  iv.set(prefix);
  new DataView(iv.buffer).setUint32(8, index);
  return iv;
};

const chunkAad = (keys: QChatKeys, index: number, last: boolean) =>
  enc.encode(`${keys.name}|file|c|${index}|${last ? 1 : 0}`);

/** Encrypted size of a file of `plainSize` bytes (used for the server size check). */
export const encryptedFileSize = (plainSize: number) =>
  FILE_HEADER_LEN + Math.max(1, Math.ceil(plainSize / FILE_CHUNK)) * GCM_TAG + plainSize;

/** Encrypt a file chunk by chunk. Returns the ciphertext as a Blob. */
export async function encryptFile(
  keys: QChatKeys,
  file: Blob,
  onProgress?: Progress,
  signal?: AbortSignal
): Promise<Blob> {
  const prefix = crypto.getRandomValues(new Uint8Array(8));
  const header = new Uint8Array(FILE_HEADER_LEN);
  header.set(FILE_MAGIC);
  header.set(prefix, 4);
  new DataView(header.buffer).setUint32(12, FILE_CHUNK);

  const parts: BlobPart[] = [header];
  const count = Math.max(1, Math.ceil(file.size / FILE_CHUNK));
  for (let i = 0; i < count; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const plain = await file.slice(i * FILE_CHUNK, (i + 1) * FILE_CHUNK).arrayBuffer();
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: chunkIv(prefix, i), additionalData: chunkAad(keys, i, i === count - 1) },
      keys.encKey,
      plain
    );
    parts.push(ct);
    onProgress?.((i + 1) / count);
  }
  return new Blob(parts, { type: "application/octet-stream" });
}

async function decryptChunked(keys: QChatKeys, data: Blob, onProgress?: Progress): Promise<Blob> {
  const header = new Uint8Array(await data.slice(0, FILE_HEADER_LEN).arrayBuffer());
  const prefix = header.slice(4, 12);
  const chunkSize = new DataView(header.buffer).getUint32(12);
  const body = data.size - FILE_HEADER_LEN;
  if (chunkSize <= 0 || body < GCM_TAG) throw new Error("Corrupt file");
  const encChunk = chunkSize + GCM_TAG;
  const count = Math.ceil(body / encChunk);

  const parts: BlobPart[] = [];
  for (let i = 0; i < count; i++) {
    const start = FILE_HEADER_LEN + i * encChunk;
    const ct = await data.slice(start, start + encChunk).arrayBuffer();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: chunkIv(prefix, i), additionalData: chunkAad(keys, i, i === count - 1) },
      keys.encKey,
      ct
    );
    parts.push(pt);
    onProgress?.((i + 1) / count);
  }
  return new Blob(parts);
}

async function decryptLegacy(keys: QChatKeys, data: Blob): Promise<Blob> {
  const raw = new Uint8Array(await data.arrayBuffer());
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: raw.slice(0, 12), additionalData: enc.encode(`${keys.name}|file`) },
    keys.encKey,
    raw.slice(12)
  );
  return new Blob([pt]);
}

/** Decrypt an uploaded file (chunked or legacy). Throws if tampered with or the key is wrong. */
export async function decryptFile(keys: QChatKeys, data: Blob, onProgress?: Progress): Promise<Blob> {
  const head = new Uint8Array(await data.slice(0, 4).arrayBuffer());
  if (head.length === 4 && FILE_MAGIC.every((b, i) => head[i] === b)) {
    try {
      return await decryptChunked(keys, data, onProgress);
    } catch (e) {
      // A legacy random IV can (very rarely) start with the magic bytes.
      try {
        return await decryptLegacy(keys, data);
      } catch {
        throw e;
      }
    }
  }
  return decryptLegacy(keys, data);
}

export async function decryptMessage(keys: QChatKeys, payload: string): Promise<string> {
  try {
    if (payload.startsWith(V2_PREFIX)) {
      const raw = fromB64(payload.slice(V2_PREFIX.length));
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: raw.slice(0, 12), additionalData: enc.encode(keys.name) },
        keys.encKey,
        raw.slice(12)
      );
      return dec.decode(pt);
    }
    // Legacy message (old client): CryptoJS passphrase mode.
    const plain = CryptoJS.AES.decrypt(payload, keys.legacyCode).toString(CryptoJS.enc.Utf8);
    return plain || "<Decryption Failed>";
  } catch {
    return "<Decryption Failed>";
  }
}
