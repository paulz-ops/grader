import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { exportBackup, importBackup } from '../backup';
import { daysSince, formatDate } from '../format';
import { Field, TextField } from './fields';
import type { SchoolYear } from '../types';

export function AppSettings({ schoolYear }: { schoolYear: SchoolYear }) {
  const lastBackup = useLiveQuery(async () => (await db.meta.get('lastBackup'))?.value ?? null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  const updateYear = (changes: Partial<SchoolYear>) => db.schoolYears.update(schoolYear.id, changes);

  return (
    <div className="page">
      <h1>Einstellungen &amp; Backup</h1>

      <section className="panel">
        <h2>Backup</h2>
        <p>
          Alle Daten liegen nur in diesem Browser auf diesem Gerät. Sichere sie regelmäßig als Datei, z. B. in
          OneDrive oder auf einem USB-Stick. Der automatische Abgleich über OneDrive kommt in Phase 3.
        </p>
        <p className="muted">
          {lastBackup
            ? `Letztes Backup: ${formatDate(lastBackup.slice(0, 10))} (vor ${daysSince(lastBackup)} Tagen)`
            : 'Noch kein Backup erstellt.'}
          {persisted === false && ' · Achtung: Der Browser hat dauerhaftes Speichern nicht bestätigt.'}
        </p>
        <div className="actions">
          <button
            className="primary"
            onClick={async () => {
              try {
                await exportBackup();
                setMessage({ type: 'ok', text: 'Backup wurde heruntergeladen.' });
              } catch (e) {
                setMessage({ type: 'error', text: `Backup fehlgeschlagen: ${(e as Error).message}` });
              }
            }}
          >
            Backup herunterladen
          </button>
          <label className="button">
            Backup wiederherstellen …
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (!window.confirm('Alle aktuellen Daten werden durch das Backup ersetzt. Fortfahren?')) return;
                try {
                  const data = await importBackup(file);
                  setMessage({
                    type: 'ok',
                    text: `Backup vom ${formatDate(data.exportedAt.slice(0, 10))} wiederhergestellt (${data.tables.classes.length} Klassen).`,
                  });
                } catch (err) {
                  setMessage({ type: 'error', text: (err as Error).message });
                }
              }}
            />
          </label>
        </div>
        {message && <p className={message.type === 'ok' ? 'msg-ok' : 'msg-error'}>{message.text}</p>}
      </section>

      <section className="panel form">
        <h2>Schuljahr</h2>
        <Field label="Bezeichnung">
          <TextField value={schoolYear.name} onSave={(v) => v.trim() && updateYear({ name: v.trim() })} />
        </Field>
        <div className="row">
          <Field label="Beginn">
            <TextField type="date" value={schoolYear.start} onSave={(v) => v && updateYear({ start: v })} />
          </Field>
          <Field label="2. Halbjahr ab" hint="Neue Leistungen werden nach Datum dem Halbjahr zugeordnet.">
            <TextField
              type="date"
              value={schoolYear.secondHalfStart}
              onSave={(v) => v && updateYear({ secondHalfStart: v })}
            />
          </Field>
          <Field label="Ende">
            <TextField type="date" value={schoolYear.end} onSave={(v) => v && updateYear({ end: v })} />
          </Field>
        </div>
      </section>
    </div>
  );
}
