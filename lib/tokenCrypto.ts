// AES-256-GCM encryption for OAuth refresh tokens stored at rest in
// google_oauth_tokens. TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte
// key (e.g. `openssl rand -base64 32`) -- no default is set on purpose, a
// missing/wrong-length key fails loud rather than silently using a weak one.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured. Generate one with `openssl rand -base64 32`.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to 32 bytes for AES-256 (got ${key.length}). Generate one with \`openssl rand -base64 32\`.`,
    );
  }
  return key;
}

/** Returns "iv:authTag:ciphertext", each base64, colon-joined. */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptToken(encoded: string): string {
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = encoded.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Stored token is malformed (expected iv:authTag:ciphertext).");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
