# Grader – Konzept

Stand: 17.11.2026 · Entwurf zur Abstimmung

## 1. Ziel

Ein eigenes Werkzeug für das Notenmanagement meiner Klassen, das ich über viele Schuljahre nutzen kann.

- Mündliche Noten, Projektkompetenz und schriftliche Noten erfassen
- Schüler- und Klassendurchschnitte jederzeit aktuell sehen
- Pro Klasse festlegen, welche Noten bis wann gemacht werden müssen, und sehen, was noch fehlt
- Schülerfotos zuordnen, damit ich die Schüler schneller erkenne und schneller eintrage
- Möglichst wenig Klicks, eine durchgängig gleiche Bedienung, selbsterklärend (anders als Notenbox)

**Nicht-Ziele (vorerst):** Zugang für Schüler oder Eltern, Mehrbenutzerbetrieb, Anbindung an die Schulverwaltung, Stundenplan, Klassenbuch.

## 2. Rahmenbedingungen

| Thema | Entscheidung |
|---|---|
| Geräte | Surface (Windows 11, Touch + Tastatur), iPhone, gelegentlich Mac |
| Nutzer | Nur ich |
| Daten | Auf allen Geräten dieselben Daten → Synchronisation nötig |
| Notensysteme | Pro Klasse einstellbar: 1–6 mit Tendenz (+ = 0,25 besser, − = 0,25 schlechter → 2+ = 1,75, 2− = 2,25), 1–6 mit Dezimalen, 0–15 Punkte |
| Bereiche | Berufsschule: mündlich, schriftlich, Projektkompetenz · Technisches Gymnasium: mündlich, schriftlich |
| Fächer | Mehrere Fächer pro Klasse, jedes Fach ergibt eine eigene Zeugnisnote (z. B. TG Theorie und TG Labor) |
| Gewichtung | Pro Klasse und Fach einstellbar |
| Rundung | Pro Klasse und pro Zeugnis einstellbar |
| Zeugnisse | Halbjahre als Zeiträume; das Halbjahreszeugnis ist pro Klasse optional |
| Fristen | Pro Note bzw. Leistung ein Abgabetermin, bis wann die Note vorliegen muss |
| Sync | Über mein OneDrive |

## 3. Technischer Ansatz

**Eine Web-App (PWA), die offline funktioniert und die Daten lokal speichert.**

- Läuft im Browser und lässt sich auf dem Surface, dem iPhone und dem Mac wie eine App installieren. Ich muss also nur eine Codebasis pflegen, nicht drei.
- Funktioniert ohne Internet, zum Beispiel im Klassenzimmer ohne WLAN. Die Daten liegen auf dem Gerät (IndexedDB).
- Die App selbst ist nur eine statische Website (z. B. auf GitHub Pages). Auf dem Webserver liegen keine Schülerdaten.
- **Sync über OneDrive:** Die App meldet sich mit meinem Microsoft-Konto an und legt in einem eigenen App-Ordner in OneDrive eine verschlüsselte Datendatei ab. Jedes Gerät gleicht sich beim Start und nach Änderungen damit ab. Die Daten werden vor dem Hochladen auf dem Gerät verschlüsselt, OneDrive sieht also nur verschlüsselten Inhalt. Umgesetzt wird das in Phase 3, bis dahin gibt es manuelle Backups als Datei.
- **Langlebigkeit:** Die Daten lassen sich jederzeit als offene JSON-Datei exportieren. Das Datenformat bekommt eine Versionsnummer, damit alte Daten nach Updates automatisch umgewandelt werden. Dazu kommen wenige, verbreitete Abhängigkeiten.
- Stack-Vorschlag: TypeScript, Vite, React, Dexie (IndexedDB). Das ist weit verbreitet und dürfte noch viele Jahre unterstützt werden.

> **Datenschutz:** Für Noten auf Privatgeräten verlangen viele Bundesländer bzw. Schulen eine Genehmigung der Schulleitung und technische Maßnahmen (Verschlüsselung, Gerätesperre). Für Schülerfotos braucht es eine Einwilligung. Das kläre ich vor dem Echtbetrieb mit der Schule. Die App soll das unterstützen: verschlüsselte Speicherung, App-Sperre nach Untätigkeit, Fotos optional.

## 4. Datenmodell

```
Schuljahr (2026/27)
 └─ Halbjahr (1. und 2. Halbjahr, mit Datum)
 └─ Klasse (z. B. "10FA1"; Schulart-Vorlage; Notensystem; Fotos an/aus)
     ├─ Zeugnisse (z. B. Halbjahreszeugnis – optional; Jahreszeugnis; je mit Notenschluss und Rundungsregel)
     ├─ Schüler (Name, Vorname, Foto, aktiv / ausgetreten am …)
     └─ Fach (z. B. "TG Theorie", "TG Labor", "Lernfeld 5"; ergibt eine Zeugnisnote)
         ├─ Bereiche mit Gewicht (z. B. mündlich 40 %, Projekt 20 %, schriftlich 40 %)
         ├─ Plan (Soll je Halbjahr mit Abgabefrist, z. B. "3× mündlich bis 31.01.")
         └─ Leistung (Titel, Bereich, Datum, Abgabefrist, Gewicht im Bereich, Status geplant/erledigt)
             └─ Note (Schüler, Wert, optional Kommentar, "fehlt entschuldigt")
```

- **Schulart-Vorlagen** legen die Bereiche fest. Berufsschule: mündlich, schriftlich, Projektkompetenz. Technisches Gymnasium: mündlich, schriftlich. Danach lässt sich alles pro Klasse und Fach anpassen.
- **Abgabefristen:** Jede geplante Leistung und jeder Plan-Eintrag hat ein „bis“-Datum. Die Startseite zeigt, welche Noten bald fällig oder überfällig sind, z. B. „TG Labor 11TG2: 4 Schüler ohne 2. mündliche Note, fällig in 5 Tagen“.
- **Mündliche Einzelnoten** kann ich spontan eintragen (Schüler antippen, Note tippen). Dabei wird automatisch eine Leistung mit dem Datum von heute angelegt.
- **Vorlagen:** Gewichtung und Plan einer Klasse lassen sich als Vorlage speichern und auf neue Klassen anwenden. Das spart beim Schuljahreswechsel Arbeit.
- Intern werden alle Noten als Zahl gespeichert. Wie sie angezeigt werden, bestimmt das Notensystem der Klasse (z. B. 2- ⇄ 2,33 oder 2,25, siehe offene Fragen).

## 5. Berechnung

1. **Bereichsschnitt** = gewichteter Mittelwert aller Noten des Schülers in diesem Bereich und Zeitraum
2. **Gesamtnote** = gewichteter Mittelwert der Bereichsschnitte
3. Hat ein Bereich noch keine Note, werden die übrigen Bereiche hochgerechnet (einstellbar). Die Note wird dann als „vorläufig“ markiert.
4. **Klassendurchschnitt** je Leistung, je Bereich und gesamt
5. Angezeigt werden 2 Nachkommastellen. Die Zeugnisnote wird nach der Rundungsregel des jeweiligen Zeugnisses gebildet (pro Klasse einstellbar: kaufmännisch, ab x,50 bzw. x,51 abrunden oder eigene Grenze).
6. Tendenznoten werden intern mit ±0,25 gerechnet (2+ = 1,75, 2− = 2,25).

Alles wird bei jeder Eingabe sofort neu berechnet. Einen „Berechnen“-Knopf gibt es nicht.

## 6. Bedienung und Screens

Prinzip: **Klasse → Ansicht → Eintragen.** Keine verschachtelten Menüs, überall dieselben Gesten.

| Screen | Inhalt | Wichtigste Aktion |
|---|---|---|
| **Start** | Meine Klassen als Kacheln, darunter „Offen“: fehlende Noten laut Plan, nächste Termine | Klasse antippen |
| **Klasse – Kacheln** | Schüler mit Foto, Gesamtschnitt, Ampel (Soll erfüllt?) | Schüler antippen → Note eintragen (**2 Taps**) |
| **Klasse – Tabelle** | Schüler × Leistungen, gruppiert nach Bereich, Schnitte am Rand | Spalte anlegen, Noten per Tastatur durchtippen (Enter = nächster Schüler) |
| **Schüler** | Alle Noten nach Bereichen, Verlauf, Kommentare | Note korrigieren |
| **Klasse – Einstellungen** | Notensystem, Fächer, Gewichtung, Plan, Schülerliste, Fotos | Schüler per Copy-Paste aus einer Liste importieren |

Für schnelle Eingaben:
- Eine **Noten-Tastatur** auf dem Touchscreen (1 · 2 · 3 · 4 · 5 · 6 · + · −) statt Dropdown-Menüs
- **Rückgängig** statt „Wirklich speichern?“-Dialogen
- Kacheln und Tabelle zeigen dieselben Daten, ein Schalter wechselt zwischen beiden Ansichten
- **Fotos:** Schüler antippen → Kamera → fertig. Das Foto wird automatisch zugeschnitten und verkleinert.

### Trends und Auswertungen

| Wo | Visualisierung | Nutzen | Phase |
|---|---|---|---|
| Schülerkachel | **Trendpfeil** (↗ → ↘): letzte Noten im Vergleich zum Halbjahresschnitt | Entwicklung auf einen Blick | 2 |
| Schülerkachel | **Mini-Verlauf (Sparkline)** des Schnitts | Verlauf sehen, ohne den Schüler zu öffnen | 2 |
| Leistung | **Notenspiegel** als Balken (Anzahl 1er, 2er …) | Wie ist die Arbeit ausgefallen? | 2 |
| Klasse | Markierung **„Abwärtstrend“** bei deutlicher Verschlechterung | Frühwarnung, Vorbereitung von Elterngesprächen | 2 |
| Schüler | **Verlauf des Schnitts** als Linie, getrennt nach Bereichen | Wo rutscht jemand ab? | 4 |
| Klasse/Fach | **Klassenschnitt im Verlauf** über das Halbjahr | Leistungsentwicklung der Klasse | 4 |
| Archiv | **Vergleich zwischen Schuljahren** (z. B. 11TG2 dieses Jahr vs. 11TG letztes Jahr) | Wird mit wachsendem Archiv aussagekräftiger | 4 |

## 7. Schuljahreswechsel

- Neues Schuljahr anlegen und Klassen mit Schülern, Fotos und Einstellungen übernehmen (z. B. 10FA1 → 11FA1)
- Alte Schuljahre werden archiviert und bleiben nur lesbar zugänglich
- Export pro Klasse als Excel/CSV und PDF-Notenbogen

## 8. Umsetzung in Phasen

| Phase | Umfang | Ergebnis |
|---|---|---|
| **1 – Kern** | Klassen, Schüler, Fächer, Bereiche und Gewichtung, Notensysteme, Notentabelle, Live-Durchschnitte, JSON-Backup | Am Surface im Alltag nutzbar |
| **2 – Komfort** | Kachelansicht mit Fotos, Schnelleingabe mündlich, Plan mit Soll/Ist, Abgabefristen und Ampel, Startseite „Offen“, Trendpfeil, Sparklines, Notenspiegel, Abwärtstrend-Hinweis | Unterricht mit dem iPhone oder dem Surface |
| **3 – Sync & Sicherheit** | Verschlüsselung, App-Sperre, OneDrive-Sync zwischen den Geräten | Gleicher Stand auf allen Geräten |
| **4 – Jahre** | Schuljahreswechsel, Archiv, Vorlagen, Excel- und PDF-Export, Verlaufsdiagramme für Schüler und Klasse, Vergleich zwischen Schuljahren | Langfristig nutzbar |

## 9. Ausblick (später, nicht Teil der Phasen 1–4)

- Anbindung an den Stoffverteilungsplan
- Klassenarbeitstermine eintragen und mit den Abgabefristen verknüpfen

Das Datenmodell lässt dafür Platz: Leistungen haben bereits Datum und Frist.
