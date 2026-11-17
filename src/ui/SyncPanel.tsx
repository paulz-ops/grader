import { useEffect, useState } from 'react';
import { disableSync, enableSync, remoteExists, signIn, syncNow, unlock, useSyncStatus, type SyncStatus } from '../sync/engine';
import { WrongPassphraseError } from '../sync/crypto';
import { Field } from './fields';

function formatTime(ts: number | null): string {
  if (!ts) return 'noch nie';
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `heute, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

/** Kleine Statusanzeige in der Kopfzeile */
export function SyncBadge() {
  const s = useSyncStatus();
  if (s.state === 'unconfigured' || s.state === 'off') return null;
  const map: Record<string, { text: string; cls: string }> = {
    idle: { text: '✓ Synchron', cls: 'ok' },
    syncing: { text: '⟳ Synchronisiere …', cls: 'busy' },
    offline: { text: '○ Offline', cls: 'warn' },
    error: { text: '⚠ Sync-Fehler', cls: 'bad' },
    'signed-out': { text: '⚠ Sync: Anmeldung nötig', cls: 'bad' },
    locked: { text: '⚠ Sync: Passwort nötig', cls: 'bad' },
  };
  const m = map[s.state];
  return (
    <a href="#/einstellungen" className={`sync-badge ${m.cls}`} title={`Zuletzt synchronisiert: ${formatTime(s.lastSync)}`}>
      {m.text}
    </a>
  );
}

export function SyncPanel() {
  const s = useSyncStatus();
  return (
    <section className="panel">
      <h2>Sync über OneDrive</h2>
      <SyncBody status={s} />
    </section>
  );
}

function SyncBody({ status: s }: { status: SyncStatus }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  switch (s.state) {
    case 'unconfigured':
      return (
        <p className="muted">
          Der Sync ist in dieser Version noch nicht eingerichtet (die Microsoft-App-ID fehlt noch).
        </p>
      );
    case 'off':
      return (
        <>
          <p>
            Gleicht deine Daten zwischen Surface, iPhone und Mac über dein OneDrive ab. Die Daten werden auf dem Gerät
            mit deinem Sync-Passwort verschlüsselt, bevor sie hochgeladen werden. Grader sieht in OneDrive nur seinen
            eigenen Ordner (Apps/Grader).
          </p>
          <button className="primary" disabled={busy} onClick={() => void run(enableSync)}>
            Mit OneDrive verbinden
          </button>
        </>
      );
    case 'signed-out':
      return (
        <>
          {s.message && <p className="msg-error">{s.message}</p>}
          <p>Melde dich mit deinem Microsoft-Konto an, um den Sync fortzusetzen.</p>
          <div className="actions">
            <button className="primary" disabled={busy} onClick={() => void run(signIn)}>
              Bei Microsoft anmelden
            </button>
            <button disabled={busy} onClick={() => void run(disableSync)}>
              Sync ausschalten
            </button>
          </div>
        </>
      );
    case 'locked':
      return <UnlockForm status={s} />;
    default:
      return (
        <>
          <p>
            Verbunden als <strong>{s.account}</strong>. Zuletzt synchronisiert: {formatTime(s.lastSync)}.
          </p>
          {s.message && <p className={s.state === 'error' ? 'msg-error' : 'muted'}>{s.message}</p>}
          <div className="actions">
            <button className="primary" disabled={busy || s.state === 'syncing'} onClick={() => void run(syncNow)}>
              {s.state === 'syncing' ? 'Synchronisiere …' : 'Jetzt synchronisieren'}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm('Sync auf diesem Gerät trennen? Deine Daten bleiben hier und in OneDrive erhalten.')) {
                  void run(disableSync);
                }
              }}
            >
              Sync trennen
            </button>
          </div>
        </>
      );
  }
}

function UnlockForm({ status }: { status: SyncStatus }) {
  const [exists, setExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    remoteExists()
      .then(setExists)
      .catch((e: Error) => setError(`OneDrive konnte nicht gelesen werden: ${e.message}`));
  }, []);

  const isNew = exists === false;
  const valid = isNew ? pw.length >= 8 && pw === pw2 : pw.length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await unlock(pw);
    } catch (e) {
      setError(e instanceof WrongPassphraseError ? 'Das Passwort ist falsch.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (exists === null && !error) return <p className="muted">Prüfe OneDrive …</p>;

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void submit();
      }}
    >
      <p>
        Angemeldet als <strong>{status.account}</strong>.{' '}
        {isNew
          ? 'Lege jetzt ein Sync-Passwort fest. Du brauchst es einmal auf jedem weiteren Gerät.'
          : 'In OneDrive liegen schon Grader-Daten. Gib dein Sync-Passwort ein.'}
      </p>
      {status.message && <p className="msg-error">{status.message}</p>}
      <Field label="Sync-Passwort" hint={isNew ? 'Mindestens 8 Zeichen.' : undefined}>
        <input type="password" autoComplete={isNew ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </Field>
      {isNew && (
        <>
          <Field label="Passwort wiederholen">
            <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <p className="notice">
            Wichtig: Das Passwort kann nicht wiederhergestellt werden. Ohne es sind die Daten in OneDrive nicht lesbar.
            Deine Daten auf den Geräten und deine Backups bleiben davon unberührt.
          </p>
        </>
      )}
      {error && <p className="msg-error">{error}</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={!valid || busy}>
          {busy ? 'Bitte warten …' : isNew ? 'Passwort festlegen und synchronisieren' : 'Entsperren und synchronisieren'}
        </button>
        <button type="button" disabled={busy} onClick={() => void disableSync()}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
