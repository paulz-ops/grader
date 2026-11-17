import { useRef, useState } from 'react';
import { setPhoto } from '../actions';
import { Modal } from './Modal';
import type { Student } from '../types';

const PHOTO_SIZE = 320;

/**
 * Schneidet ein Bild quadratisch zu (etwas oberhalb der Mitte, wo meist das
 * Gesicht ist), verkleinert es und gibt es als JPEG-Data-URL zurück (~20 KB).
 */
export async function resizePhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Das Bild konnte nicht geladen werden. Bitte ein JPG oder PNG wählen.'));
      i.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = (h - side) * 0.3;
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Bildbearbeitung wird von diesem Browser nicht unterstützt.');
    ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function initials(s: Pick<Student, 'firstName' | 'lastName'>): string {
  return `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase();
}

export function Avatar({ student, size }: { student: Student; size: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return student.photo ? (
    <img className="avatar" src={student.photo} alt="" style={style} />
  ) : (
    <span className="avatar initials" style={style} aria-hidden="true">
      {initials(student)}
    </span>
  );
}

/**
 * Avatar als Knopf: ohne Foto → Kamera/Bildauswahl öffnen,
 * mit Foto → groß anzeigen (ersetzen oder entfernen).
 */
export function PhotoButton({ student, size }: { student: Student; size: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = `${student.firstName} ${student.lastName}`;

  const pick = () => inputRef.current?.click();

  return (
    <>
      <button
        type="button"
        className="avatar-btn"
        title={student.photo ? `Foto von ${name}` : `Foto für ${name} hinzufügen`}
        aria-label={student.photo ? `Foto von ${name} anzeigen` : `Foto für ${name} hinzufügen`}
        onClick={() => (student.photo ? setViewing(true) : pick())}
      >
        <Avatar student={student} size={size} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            await setPhoto(student.id, await resizePhoto(file));
            setError(null);
          } catch (err) {
            setError((err as Error).message);
            setViewing(true);
          }
        }}
      />
      {viewing && (
        <Modal title={name} onClose={() => setViewing(false)}>
          {student.photo && <img className="photo-large" src={student.photo} alt={`Foto von ${name}`} />}
          {error && <p className="msg-error">{error}</p>}
          <div className="actions">
            <button className="primary" onClick={pick}>
              {student.photo ? 'Neues Foto' : 'Foto wählen'}
            </button>
            {student.photo && (
              <button
                className="danger"
                onClick={async () => {
                  await setPhoto(student.id, undefined);
                  setViewing(false);
                }}
              >
                Foto entfernen
              </button>
            )}
            <button className="push-right" onClick={() => setViewing(false)}>
              Schließen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
