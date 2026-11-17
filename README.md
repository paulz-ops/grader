# Grader

Notenverwaltung für meine Klassen. Konzept und Phasen: siehe [KONZEPT.md](KONZEPT.md).

## Entwicklung

Voraussetzung: [Node.js](https://nodejs.org) LTS (ab Version 20).

```bash
npm install      # einmalig: Abhängigkeiten installieren
npm run dev      # App lokal starten (http://localhost:5173)
npm test         # Tests der Notenberechnung
npm run build    # fertige App nach dist/ bauen
```

## Daten

- Alle Daten liegen lokal im Browser (IndexedDB), nichts geht ins Internet.
- **Backup:** Einstellungen & Backup → „Backup herunterladen“ (JSON-Datei).
  Backups enthalten Schülerdaten. Sie gehören nicht ins Repository (stehen in `.gitignore`).
- Schemaänderungen immer als neue `version(n)` in `src/db.ts` mit Migration anlegen,
  damit alte Daten weiter lesbar bleiben.

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/types.ts` | Datenmodell |
| `src/db.ts` | Datenbank (Dexie/IndexedDB), Schuljahr |
| `src/grades.ts` | Notensysteme: Eingabe, Anzeige, Rundung |
| `src/calc.ts` | Berechnung der Schnitte |
| `src/actions.ts` | Anlegen, Ändern, Löschen |
| `src/backup.ts` | Export und Import |
| `src/ui/` | Oberfläche |
