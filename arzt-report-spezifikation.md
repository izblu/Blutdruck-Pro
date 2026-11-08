# Arzt-Report – Datenspezifikation

Stand: 2026-07-13. Diese Datei beschreibt **was** der Arzt-Report rechnet und anzeigt –
nicht wie er aussieht. Gleiche Aufteilung wie die [dashboard-spezifikation.md](dashboard-spezifikation.md):

- **Fix (Logik/Daten):** Kennzahlen, Berechnung, Zeitfenster, Ampel-Regeln, Leerzustände.
  Das ist hier festgelegt, damit kein Entwurf an den Datenregeln vorbeigeht.
- **Offen (Aussehen → Claude Design):** Anordnung/Hierarchie, Farben, Schrift, Kachel- und
  Tabellen-Gestaltung, Grafik-Größe, genaue Text-Formulierungen, Seitenaufteilung.

**Zweck:** ein aufbereiteter, **druckbarer** Bericht (A4) für den Arztbesuch – lesefertig für Menschen,
im Gegensatz zum CSV-Export (Rohdaten). **Keine Diagnose, keine Bewertung** – nur beschreiben.

---

## 0. Grundlagen (gelten für alle Kennzahlen)

- **Datengrundlage:** jede Messung hat Zeitpunkt (`ts`), `sys`, `dia`, `pulse`, optional `note`.
  Das Datenmodell bleibt **unverändert** – keine Neu-Erfassung, keine Migration.
- **Durchschnitt** = einfacher Mittelwert über **alle Messungen** im Zeitraum (nicht pro Tag gewichtet).
- **Rundung:** alle angezeigten Zahlen gerundet – Blutdruck/Puls auf ganze Zahlen, Prozente auf ganze Prozent.
- **Format:** A4-Hochformat, gedacht für **Schwarz auf Weiß** (Ausdruck). Der Report sieht in Hell- und
  Dunkelmodus der App **gleich hell/weiß** aus.

---

## 1. Zeitraum (eigener Wähler im Report)

- Der Report hat einen **eigenen Von–Bis-Wähler**, unabhängig von Verlauf/Diagramm.
- **Standard:** die letzten 30 Tage.
- Der Kopf des Reports zeigt den gewählten **Zeitraum** (Von–Bis) und die **Anzahl** der Messungen darin.

---

## 2. Kennzahlen

### 2.1 Kopf / Übersicht
- App-Name / Titel „Blutdruck-Bericht" (o. ä.), Zeitraum, Anzahl Messungen, Erstellungsdatum.
- **Optional (Design entscheidet):** ein leeres **Namensfeld** zum handschriftlichen Ausfüllen
  (der Report kennt keinen Namen – die App speichert keinen).

### 2.2 Durchschnitt gesamt
- Ø `sys`, Ø `dia`, Ø `pulse` über alle Messungen im Zeitraum.
- Blutdruck mit **Gesamt-Ampelfarbe** einordnen (grün/gelb/rot über `category()` auf den Ø-Werten);
  Puls **ohne** Ampel (keine Schwellenwerte).

### 2.3 Durchschnitt nach Tageszeit
- Drei Fenster (wie in der App über `todOf`): **morgens** (`< 11 Uhr`), **tagsüber** (`11–17 Uhr`),
  **abends** (`≥ 17 Uhr`).
- Je Fenster: Ø `sys` / Ø `dia` (+ optional Ø `pulse`) und die Anzahl der Messungen darin.
- Medizinisch klassisch ist **morgens/abends** – „tagsüber" darf im Entwurf dezenter stehen oder,
  falls leer, entfallen.
- **Leerzustand je Fenster:** keine Messung → „—".

### 2.4 Min / Max
- Höchster und niedrigster Wert je `sys`, `dia`, `pulse` im Zeitraum.

### 2.5 Ampel-Verteilung
- Für jede Messung die **Gesamt-Ampel** (`category()`) bestimmen, je Farbe zählen → Anzahl **und** Prozent.
- Prozente ganzzahlig, so gerundet, dass die Summe **genau 100 %** ergibt.

### 2.6 Anteil über Zielwert
- Prozent der Messungen, die **nicht grün** sind (also „erhöht" **oder** „zu hoch").
- Rein beschreibend, keine Wertung.

### 2.7 Angewendete Schwellenwerte (Fußnote)
- Die im Report zugrunde gelegten Grenzen (`settings.thr`) ausweisen, z. B.
  „Erhöht ab 130/85, zu hoch ab 140/90 mmHg" – damit der Arzt weiß, worauf die Ampel beruht.
- Diese Werte sind vom Nutzer einstellbar; der Report zeigt die **aktuell** gültigen.

---

## 3. Verlaufsgrafik

- Sys- und Dia-Punkte über die Zeit, je in ihrer **eigenen** Ampelfarbe (`catVal`), plus
  gestrichelte **Ø-Linie** – dieselbe Logik wie im App-Diagramm (Variante A), aber
  **druck-optimiert**: hellere Flächen, größer, gut lesbar auf Papier.
- **Keine** Diagnose/Bewertung in der Grafik.
- Puls ist optional (schmales eigenes Feld, andere Einheit) – Design entscheidet, ob er in den
  Report gehört.

---

## 4. Werteliste (Tabelle)

- **Chronologisch** (Design entscheidet: neueste oder älteste zuerst; für Ärzte oft aufsteigend).
- Spalten: **Datum, Uhrzeit, Systolisch, Diastolisch, Puls, Notiz**.
- Sys/Dia dürfen je nach Wert in Ampelfarbe stehen (wie im Verlauf), müssen aber **auch in
  Schwarz-Weiß** eindeutig lesbar bleiben.
- Bei vielen Messungen darf die Tabelle über **mehrere Seiten** laufen (saubere Seitenumbrüche).

---

## 5. Leerzustände

- **Keine Messung im gewählten Zeitraum:** freundlicher Hinweis statt eines leeren Reports
  (z. B. „Für den gewählten Zeitraum liegen keine Messungen vor.").
- Einzelne leere Tageszeit-Fenster: „—" (siehe 2.3).

---

## 6. Bewusst NICHT im Report

- **Keine Bewertung/Diagnose**, keine Empfehlungen – nur Zahlen und beschreibende Sätze.
- Kein Name/keine Personendaten aus der App (die App speichert keine) – höchstens ein leeres
  Feld zum Ausfüllen.

---

## 7. Trennung Logik ↔ Design (Zusammenfassung)

| Fix (im Code) | Offen (mit Claude Design) |
|---|---|
| Welche Kennzahlen + Berechnung | Anordnung, Hierarchie, was groß/klein |
| Zeitfenster + eigener Von–Bis-Wähler | Kachel-/Tabellen-Layout, Grafikgröße |
| Ampel-Regeln (gesamt + pro Wert) | Farben/Schrift im Rahmen der Tokens (siehe 8) |
| Leerzustände (Regeln) | genaue Text-Formulierungen |
| A4-Druck, Schwarz auf Weiß | Kopfbereich, Namensfeld ja/nein, Seitenaufteilung |

---

## 8. Design-Tokens (helle Palette – für den Ausdruck)

Damit der Entwurf zum App-Look passt. Der Report ist **immer hell** (Druck auf Weiß).

- **Struktur:** Text `--ink:#131a26`, Nebentext `--muted:#68717f`, Fläche/Karte `--surf:#ffffff`,
  zarte Kachel `--surf2:#f2f5f9`, Linien `--line:#e5e9f0`, Seiten-Hintergrund `--bg:#eef1f6`.
- **Akzent (Standard „Kobalt"):** `#1E5FE0`, Schrift darauf weiß.
- **Ampel:** grün Fläche `#e7f6ec` / Balken `#16a34a` / Text `#15803d`;
  gelb `#fdf6ea` / `#e08600` / `#b26a00`; rot `#fdeaea` / `#dc2626` / `#c0261f`.
- **Puls:** Balken `#e11d68`, Text `#be185d`.
- **Schrift:** „Hanken Grotesk" (Gewichte 400–800). Zahlen tabellarisch (`tabular-nums`).
- **Form:** Karten-Radius ~22 px, ruhige, klinisch-kühle Anmutung wie der Rest der App.

---

## 9. Seite „Temperatur, Sauerstoff & Gewicht" (Nachtrag 2026-11-08, Blutdruck Pro)

Eigene A4-Seite (Hochformat) **nach Seite 1** und **vor** dem Querformat-Anhang. Kein eigener Entwurf, gebaut im Stil
von Seite 1 (gleiche helle Palette `RP`, gleiche Kacheln, gleiche Fußzeile). Funktionen: `reportVitals`, `rpMetricChart`,
`rpVitalPage`, `rpPages` in [app.js](app.js).

- **Schalter** im Report-Menü, je Wert einer (seit 2026-11-08): „Temperatur einbeziehen", „Sauerstoff einbeziehen", „Gewicht
  einbeziehen", Standard **an** (wie alle Report-Optionen flüchtig, nicht in `settings`/Backup). Reihenfolge: Namensfeld, Puls,
  Temperatur, Sauerstoff, Gewicht, Anhang. Ein Schalter erscheint nur, wenn der Wert unter Menü → Messwerte an ist. Unterzeile:
  „N Messung(en) im Zeitraum" bzw. „Keine Werte im Zeitraum". **Die Zählung ist unabhängig von den Schaltern**, die Seiten richten
  sich danach.
- **Titel aus dem Inhalt:** „Temperatur" · „Sauerstoff" · „Gewicht" · „Temperatur & Sauerstoff" · „Temperatur & Gewicht" ·
  „Sauerstoff & Gewicht" · „Temperatur, Sauerstoff & Gewicht".
- **Keine Werte im Zeitraum:** Die Seite entfällt, auch wenn die Schalter an sind; Unterzeile „Keine Werte im Zeitraum". Sind
  Temperatur und Sauerstoff beide gewählt und fehlt nur einer im Zeitraum, zeigt seine Kachel „Keine Werte im Zeitraum."; ein unter
  Messwerte ausgeschalteter Wert erscheint auch so nie. Gewicht ohne Werte entfällt. Bei nur Blutdruck und Puls entfällt die zweite Seite.
- **Zeitraum:** derselbe wie Seite 1 (eigener Von–Bis-Wähler des Reports).
- **Je Wert eine Kachel:**
  - **Ø** über alle Messungen im Zeitraum, gerundet wie in der App (`meanMetric`: Temperatur 0,1 °C, Sauerstoff ganzzahlig),
    in Ampelfarbe **plus Ampel-Wort** (`catMetric` auf dem gerundeten Ø, z. B. „Normal", „Fieber", „Im Ziel").
  - **Tiefst – Höchst** und **Anzahl** der Messungen.
  - **Verlauf:** zeitgetreue X-Achse, Punkte in Ampelfarbe, graue Verbindungslinie, gestrichelte Ø-Linie mit Wert.
    Keine Schwellen-Linien (wie Seite 1).
  - **Gewicht:** dritte Kachel, Ø auf 0,1 kg in normaler Schriftfarbe, **ohne Ampel-Wort**, Punkte in Report-Farbe, Höhenachse in
    ganzen kg über `metricAxis` (`rpRange`, mindestens 4 kg Spanne).
- **Werteliste „ALLE WERTE"**, neueste zuerst, Spalten Datum · Zeit · Temp. °C · SpO₂ % · Gewicht kg · Notiz (nur Spalten der enthaltenen Werte). Werte
  mit **gleichem Zeitpunkt** (Durchgang „Alles nacheinander") stehen in **einer** Zeile, unterschiedliche Notizen werden mit
  „ · " verbunden. Wert mit Ampel-Punkt in Ampelfarbe (Gewicht ohne Punkt); fehlender Wert „—".
- **Fußzeile:** angewendete Grenzwerte aus `settings.thr` (Temperatur normal ab `tempLow`, erhöht ab `tempY`, Fieber ab `tempR`;
  Sauerstoff im Ziel ab `spo2G`, niedrig ab `spo2Y`, darunter zu niedrig; **nur für Werte, die im Bericht stehen**) und derselbe
  Haftungshinweis wie Seite 1.
  Die Standard-Fiebergrenzen sind gängige Richtwerte, **nicht gegen eine Leitlinie bestätigt** (siehe
  `vitalwerte-spezifikation.md`).
- **Anhang „Temperatur & Sauerstoff" (Querformat, Wunsch des Nutzers 2026-11-08):** mit „Anhangseiten drucken" kommt nach dem
  Blutdruck-Anhang eine zweite Querformat-Seite (`rpVitalLandscape`, Grafik `rpVitalChartDetail`). Beide Werte auf **einer**
  Seite wie Sys/Dia im Blutdruck-Anhang: Temperatur oben, Sauerstoff darunter, Gewicht zuunterst (je eigenes Band, bis zu drei, weil die Einheiten verschieden
  sind), **gemeinsame** zeitgetreue Datumsachse, **Wert an jedem Messpunkt** in Ampelfarbe, Ø-Linie je Band. Legende: Punktfarbe
  = Ampel (im Zielbereich / etwas außerhalb / deutlich außerhalb; entfällt, wenn nur Gewicht drin ist) und Ø Mittel. Fußzeile wie die Hochformat-Seite.
- **Seitenzahlen:** Seite 1 · „Seite 2" (Temperatur & Sauerstoff) · Blutdruck-Anhang „Seite 3 · Anhang" · Temperatur-&-Sauerstoff-
  Anhang „Seite 4 · Anhang". Ohne Temperatur, Sauerstoff und Gewicht im Zeitraum: Seite 1 und Blutdruck-Anhang „Seite 2 · Anhang".
- **Druck:** jede weitere Seite beginnt auf einem neuen Blatt (`.rp-page+.rp-page{break-before:page}`).

## 10. „Als Datei teilen" (Nachtrag 2026-11-08)

Knopf neben „Drucken". **Ersatz**, weil **unbestätigt** ist, ob `window.print()` in der installierten App auf dem iPhone den
Druckdialog öffnet.

- Baut eine **eigenständige HTML-Datei** (`blutdruck-pro-bericht-JJJJ-MM-TT.html`) mit genau den Seiten, die gedruckt würden,
  der eingebetteten Schrift (Hanken Grotesk als Daten-URL) und eigenen Druckregeln (A4 hoch, Anhang quer).
- Teilt sie über die Web Share API (`navigator.share({files})`). Geht das nicht (z. B. am PC), wird sie **heruntergeladen**;
  Abbrechen im Teilen-Menü tut nichts.
- Die Schrift wird schon beim Öffnen des Reports geladen, damit das Teilen direkt im Tipp passiert (Browser verlangen das).
- **Unbestätigt:** ob das iPhone die geteilte HTML-Datei über „Drucken" als PDF ausgeben kann (Weg: Teilen → In Dateien
  sichern → Datei öffnen → Teilen → Drucken). Gehört in die Geräte-Prüfung.
