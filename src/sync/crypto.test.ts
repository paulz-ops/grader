import { describe, expect, it } from 'vitest';
import { decryptText, deriveKey, encryptText, fromBase64, randomSalt, sha256Hex, toBase64, WrongPassphraseError } from './crypto';
import { emptySnapshot } from './merge';
import { referencedPhotos, toLocalShape, toRemoteShape } from './photos';

// Weniger Runden, damit die Tests schnell sind (Algorithmus ist derselbe)
const ITER = 1000;

describe('Verschlüsselung', () => {
  it('Base64 hin und zurück', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('verschlüsselt und entschlüsselt mit demselben Passwort', async () => {
    const salt = randomSalt();
    const key = await deriveKey('geheim-123', salt, ITER);
    const payload = await encryptText(key, salt, 'Noten: 2+, 3-', ITER);
    expect(payload.data).not.toContain('Noten');
    expect(payload.kdf.salt).toBe(salt);
    const again = await deriveKey('geheim-123', payload.kdf.salt, ITER);
    expect(await decryptText(again, payload)).toBe('Noten: 2+, 3-');
  });

  it('lehnt ein falsches Passwort ab', async () => {
    const salt = randomSalt();
    const payload = await encryptText(await deriveKey('richtig', salt, ITER), salt, 'x', ITER);
    await expect(decryptText(await deriveKey('falsch', salt, ITER), payload)).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it('nutzt jedes Mal einen neuen IV', async () => {
    const salt = randomSalt();
    const key = await deriveKey('pw', salt, ITER);
    const a = await encryptText(key, salt, 'gleich', ITER);
    const b = await encryptText(key, salt, 'gleich', ITER);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('sha256Hex', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('Fotos im Sync', () => {
  it('ersetzt Fotos durch Hashes und wieder zurück', async () => {
    const s = emptySnapshot();
    s.tables.students = [
      { id: 'a', updatedAt: 1, photo: 'data:image/jpeg;base64,AAA' },
      { id: 'b', updatedAt: 1 },
    ];
    const remote = await toRemoteShape(s, async (x) => `h-${x.length}`);
    expect(remote.snapshot.tables.students[0]).toEqual({ id: 'a', updatedAt: 1, photoRef: 'h-26' });
    expect(remote.snapshot.tables.students[1]).toEqual({ id: 'b', updatedAt: 1 });
    expect([...referencedPhotos(remote.snapshot)]).toEqual(['h-26']);
    expect(toLocalShape(remote.snapshot, remote.photos)).toEqual(s);
  });
});
