// Cryptographically secure helpers (the old code used Math.random()).

const ALNUM_LOWER = "abcdefghijklmnopqrstuvwxyz0123456789";
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+";

/** Uniformly pick `length` characters from `alphabet` without modulo bias. */
export function randomString(length, alphabet) {
  const out = [];
  const max = 256 - (256 % alphabet.length);
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < max) out.push(alphabet[b % alphabet.length]);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

export function randomPassword(length = 20) {
  return randomString(length, PASSWORD_CHARS);
}

/** Pronounceable-ish mailbox local part: e.g. "kavo.mirun42". */
export function randomLocalPart() {
  const cons = "bcdfghjklmnprstvz";
  const vow = "aeiou";
  const syl = () => randomString(1, cons) + randomString(1, vow);
  return `${syl()}${syl()}.${syl()}${syl()}${randomString(2, "0123456789")}`;
}

export function randomId(bytes = 16) {
  return randomString(bytes, ALNUM_LOWER);
}

export function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function digestHex(algorithm, data) {
  return toHex(await crypto.subtle.digest(algorithm, data));
}

export async function sha256Hex(data) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return digestHex("SHA-256", bytes);
}

// MD5 is not in WebCrypto; it is still the identifier many analysts paste, so
// we compute it locally (never used for anything security-relevant).
export function md5Hex(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  const len = bytes.length;
  const padLen = ((len + 8) >>> 6 << 6) + 64;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 8, (len * 8) >>> 0, true);
  view.setUint32(padLen - 4, Math.floor(len / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new DataView(new ArrayBuffer(16));
  [a0, b0, c0, d0].forEach((v, i) => out.setUint32(i * 4, v, true));
  return toHex(out.buffer);
}
