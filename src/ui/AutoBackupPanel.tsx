import { useState } from 'react';
import { chooseFolder, disableAutoBackup, resumeAccess, runNow, useAutoBackupStatus } from '../autobackup';
import { confirmDialog } from './confirm';

function formatTime(ts: number | null): string {
  if (!ts) return 'noch nie';
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? `heute, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
    : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

export function AutoBackupPanel() {
  const s = useAutoBackupStatus();
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="panel">
      <h2>Automatisches Backup</h2>
      {s.state === 'unsupported' && (
        <p className="muted">
          Das automatische Backup funktioniert nur in Edge oder Chrome am PC (z. B. auf deinem Surface). Hier bitte
          das Backup unten von Hand herunterladen.
        </p>
      )}

      {s.state === 'off' && (
        <>
          <p>
            Grader speichert nach jeder Änderung automatisch ein Backup in einen Ordner deiner Wahl. Wähle am besten
            einen Ordner in deinem <strong>OneDrive</strong> (z. B. „OneDrive – Schule\Grader-Backups“). Das
            OneDrive-Programm lädt die Dateien dann von selbst hoch. Pro Tag entsteht eine Datei, die letzten 30 Tage
            werden aufbewahrt.
          </p>
          <button className="primary" onClick={() => void run(chooseFolder)}>
            Backup-Ordner wählen …
          </button>
        </>
      )}

      {s.state === 'needs-permission' && (
        <>
          <p className="notice">
            Das automatische Backup ist pausiert: Der Browser fragt nach einem Neustart einmal nach, ob Grader weiter
            in den Ordner „{s.folder}“ schreiben darf.
          </p>
          <button className="primary" onClick={() => void run(resumeAccess)}>
            Zugriff erlauben
          </button>
        </>
      )}

      {(s.state === 'idle' || s.state === 'saving' || s.state === 'error') && (
        <>
          <p>
            Ordner: <strong>{s.folder}</strong> · Letztes automatisches Backup: {formatTime(s.last)}
            {s.state === 'saving' && ' · speichere …'}
          </p>
          <p className="muted">
            Gesichert wird ca. 20 Sekunden nach jeder Änderung und beim Schließen der App. Pro Tag eine Datei
            (grader-auto-JJJJ-MM-TT.json), die letzten 30 Tage bleiben erhalten. Wiederherstellen geht unten mit
            „Backup wiederherstellen …“.
          </p>
          {s.message && <p className="msg-error">{s.message}</p>}
          <div className="actions">
            <button className="primary" disabled={s.state === 'saving'} onClick={() => void run(() => runNow(true))}>
              Jetzt sichern
            </button>
            <button onClick={() => void run(chooseFolder)}>Anderen Ordner wählen …</button>
            <button
              onClick={async () => {
                const ok = await confirmDialog(
                  'Automatisches Backup ausschalten? Bereits gespeicherte Dateien bleiben im Ordner erhalten.',
                  { confirmLabel: 'Ausschalten' },
                );
                if (ok) void run(disableAutoBackup);
              }}
            >
              Ausschalten
            </button>
          </div>
        </>
      )}
      {error && <p className="msg-error">{error}</p>}
    </section>
  );
}

/** Hinweis auf der Startseite, wenn das automatische Backup auf eine Erlaubnis wartet. */
export function AutoBackupNotice() {
  const s = useAutoBackupStatus();
  if (s.state !== 'needs-permission' && s.state !== 'error') return null;
  return (
    <div className="notice">
      {s.state === 'needs-permission'
        ? 'Das automatische Backup ist pausiert, bis du den Zugriff auf den Ordner erlaubst. '
        : `Automatisches Backup: ${s.message ?? 'Fehler'} `}
      {s.state === 'needs-permission' ? (
        <button className="small" onClick={() => void resumeAccess()}>
          Zugriff erlauben
        </button>
      ) : (
        <a href="#/einstellungen">Zu den Einstellungen</a>
      )}
    </div>
  );
}
