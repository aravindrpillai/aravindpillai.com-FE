/**
 * Textbox end-to-end encryption (browser side). Nothing readable ever leaves the browser.
 *
 *   master    = PBKDF2-SHA256(code, salt="textbox|v1", 600k iterations, 32 bytes)
 *   openKey   = HKDF(master, "textbox|v1|enc")        AES-256-GCM, non-extractable
 *   boxId     = HKDF(master, "textbox|v1|id")         hex; the server stores only SHA-256(boxId)
 *   lockSalt  = HKDF(master, "textbox|v1|lock-salt")  salt for the PIN stage, never sent
 *
 * Optional 4-digit PIN lock:
 *   pinMaster = PBKDF2-SHA256(pin, salt=lockSalt, 100k iterations, 32 bytes)
 *   lockKey   = HKDF(pinMaster, "textbox|v1|lock-enc")   AES-256-GCM for locked content
 *   pinToken  = HKDF(pinMaster, "textbox|v1|lock-auth")  hex; the server stores only SHA-256(pinToken)
 *
 * Because the PIN stage is salted with a secret derived from the code, the server
 * (or a database leak) can't brute force the PIN without also knowing the code.
 *
 * Content: "v1:" + base64(iv[12] || ciphertext+tag), associated data
 * "textbox|v1|<boxId>|open|locked" so it can't be swapped between boxes or lock states.
 *
 * MUST stay in sync with aravindrpillai.com-BE/textbox/crypto.py.
 */

const CODE_ITERATIONS = 600_000;
const PIN_ITERATIONS = 100_000;
const PREFIX = "v1:";
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface BoxKeys {
  boxId: string;
  openKey: CryptoKey;
  lockSalt: Uint8Array;
}

export interface PinKeys {
  lockKey: CryptoKey;
  pinToken: string;
}

export const normalizeCode = (code: string) => code.trim().toLowerCase().normalize("NFC");

export const isValidPin = (pin: string) => /^[0-9]{4}$/.test(pin);

const toHex = (buf: Uint8Array) => Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");

const toB64 = (buf: Uint8Array) => {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function requireCrypto() {
  // isSecureContext is false on plain-http pages (where crypto.subtle is also missing).
  if (globalThis.isSecureContext === false || !globalThis.crypto?.subtle) {
    throw new Error("Encryption needs a secure (HTTPS) connection.");
  }
}

async function pbkdf2(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256)
  );
  const master = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveBits", "deriveKey"]);
  bits.fill(0);
  return master;
}

const hkdfParams = (info: string): HkdfParams => ({
  name: "HKDF",
  hash: "SHA-256",
  salt: new Uint8Array(),
  info: enc.encode(info),
});

const hkdfBytes = async (master: CryptoKey, info: string) =>
  new Uint8Array(await crypto.subtle.deriveBits(hkdfParams(info), master, 256));

const hkdfAesKey = (master: CryptoKey, info: string) =>
  crypto.subtle.deriveKey(hkdfParams(info), master, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);

export async function deriveBoxKeys(code: string): Promise<BoxKeys> {
  requireCrypto();
  const master = await pbkdf2(normalizeCode(code), enc.encode("textbox|v1"), CODE_ITERATIONS);
  const [openKey, id, lockSalt] = await Promise.all([
    hkdfAesKey(master, "textbox|v1|enc"),
    hkdfBytes(master, "textbox|v1|id"),
    hkdfBytes(master, "textbox|v1|lock-salt"),
  ]);
  return { boxId: toHex(id), openKey, lockSalt };
}

export async function derivePinKeys(box: BoxKeys, pin: string): Promise<PinKeys> {
  requireCrypto();
  if (!isValidPin(pin)) throw new Error("PIN must be 4 digits.");
  const master = await pbkdf2(pin, box.lockSalt, PIN_ITERATIONS);
  const [lockKey, token] = await Promise.all([
    hkdfAesKey(master, "textbox|v1|lock-enc"),
    hkdfBytes(master, "textbox|v1|lock-auth"),
  ]);
  return { lockKey, pinToken: toHex(token) };
}

const aad = (boxId: string, locked: boolean) => enc.encode(`textbox|v1|${boxId}|${locked ? "locked" : "open"}`);

export async function encryptContent(key: CryptoKey, boxId: string, locked: boolean, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(boxId, locked) }, key, enc.encode(plain))
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return PREFIX + toB64(out);
}

/** Throws if the content was tampered with or the key is wrong. */
export async function decryptContent(key: CryptoKey, boxId: string, locked: boolean, payload: string): Promise<string> {
  if (!payload.startsWith(PREFIX)) throw new Error("Unknown content format.");
  const raw = fromB64(payload.slice(PREFIX.length));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: raw.slice(0, 12), additionalData: aad(boxId, locked) },
    key,
    raw.slice(12)
  );
  return dec.decode(pt);
}
