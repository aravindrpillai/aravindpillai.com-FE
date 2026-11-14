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

/** Encrypt raw file bytes (images). Output: iv(12) || ciphertext+tag. Bound to this chat. */
export async function encryptBytes(keys: QChatKeys, data: ArrayBuffer): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(`${keys.name}|file`) },
      keys.encKey,
      data
    )
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return out;
}

/** Throws if the data was tampered with or the key is wrong. */
export async function decryptBytes(keys: QChatKeys, data: ArrayBuffer): Promise<ArrayBuffer> {
  const raw = new Uint8Array(data);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: raw.slice(0, 12), additionalData: enc.encode(`${keys.name}|file`) },
    keys.encKey,
    raw.slice(12)
  );
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
