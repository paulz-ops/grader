// Ende-zu-Ende-Verschlüsselung der Sync-Daten.
// Aus dem Sync-Passwort wird mit PBKDF2 (SHA-256, 310.000 Runden) ein AES-256-GCM-Schlüssel
// abgeleitet. In OneDrive liegt nur verschlüsselter Inhalt; ohne Passwort ist er nicht lesbar.

export const KDF_ITERATIONS = 310_000;

export class WrongPassphraseError extends Error {
  constructor() {
    super('Das Sync-Passwort ist falsch.');
  }
}

export interface EncryptedPayload {
  format: 'grader-sync';
  v: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  iv: string;
  data: string;
}

const subtle = () => globalThis.crypto.subtle;

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomSalt(): string {
  return toBase64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

/** Leitet den Schlüssel ab. Der Schlüssel ist nicht exportierbar. */
export async function deriveKey(passphrase: string, salt: string, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
  const material = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptText(
  key: CryptoKey,
  salt: string,
  text: string,
  iterations = KDF_ITERATIONS,
): Promise<EncryptedPayload> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return {
    format: 'grader-sync',
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt },
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  };
}

export async function decryptText(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPassphraseError();
  }
}

export function isEncryptedPayload(x: unknown): x is EncryptedPayload {
  const p = x as Partial<EncryptedPayload> | null;
  return !!p && p.format === 'grader-sync' && p.v === 1 && typeof p.iv === 'string' && typeof p.data === 'string';
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await subtle().digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
