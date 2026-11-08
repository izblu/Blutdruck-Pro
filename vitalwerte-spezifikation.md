# Vitalwerte – Datenspezifikation

Stand: 2026-11-04, ergänzt 2026-11-07 (Ziffern-Logik, Dashboard, Zielbereich, großes +), am 2026-11-08 mit dem
fertigen Code abgeglichen (Umbau Schritte 1–10 erledigt). Diese Datei beschreibt **was** die App bei Körpertemperatur und
Sauerstoffsättigung (SpO₂) rechnet, speichert und anzeigt – nicht wie es aussieht. Gleiche
Aufteilung wie die [dashboard-spezifikation.md](dashboard-spezifikation.md):

- **Fix (Logik/Daten):** Datenmodell, Eingabe-Regeln, Berechnung, Zeitfenster, Ampel-Regeln,
  Leerzustände, Backup. Das ist hier festgelegt, damit kein Entwurf an den Datenregeln vorbeigeht.
- **Aussehen (mit Claude Design entschieden und umgesetzt):** das große +, Anordnung/Hierarchie, Farben, Kachel- und
  Diagramm-Gestaltung, Text-Formulierungen, App-Icon. Die Entwürfe liegen auf der Zeichenfläche; was entschieden
  wurde, steht in Abschnitt 12.

**Grundsatz wie im ganzen Projekt:** Die App beschreibt nur. Keine Diagnose, keine Bewertung,
keine Empfehlungen.

---

## 0. Grundlagen

- **Eigene Liste `vitals`**, getrennt von den Blutdruck-Einträgen (`entries`). Grund:
  `mergeEntriesFromData` übernimmt nur Einträge mit `sys`, `dia` und `pulse`. Bleibt `entries`
  unverändert, kann auch die alte App ein Pro-Backup lesen.
- **Ein Datensatz, ein Wert:**
  `{id, ts, type:'temp'|'spo2', value, note}`. `value` ist immer eine Zahl (`36.8`, nie `"36,8"`).
- **Speicher:** eigener Bereich der Browser-Datenbank (IndexedDB-Store `vitals`), dafür steigt
  `DB_VER` auf 2. Vorhandene Daten bleiben beim Umstieg erhalten. Kopie in `localStorage` unter
  `bpp_vitals`, Ablauf wie bei `entries` (`saveEntries`, `initStorage`).
- **Zeitfenster rollierend ab jetzt**, wie im Dashboard (`ageDays`): „7 Tage" = 0–7. (Die frühere „Vorwoche" für
  den Trend entfällt, siehe Abschnitt 3.)
- **Durchschnitt** = einfacher Mittelwert über alle Werte im Fenster (nicht pro Tag gewichtet).
- **Rundung und Anzeige:** Temperatur immer mit einer Nachkommastelle und Komma (`36,8 °C`, auch
  `37,0 °C`), Sauerstoff als ganze Zahl (`98 %`).

### Verzeichnis `METRICS`

Alle festen Angaben stehen an einer Stelle:

| `type` | Name | Einheit | Nachkommastellen | Plausibel |
|---|---|---|---|---|
| `temp` | Körpertemperatur | °C | 1 | 34–43 |
| `spo2` | Sauerstoffsättigung (SpO₂) | % | 0 | 70–100 |

---

## 1. Eingabe

Ziffernblock, Datums-Blatt, Notiz-Blatt und Speichern-Häkchen sind dieselben wie beim Blutdruck.
Temperatur und Sauerstoff haben je **ein Feld**. Gespeichert wird immer erst per Knopf, nie automatisch.

| | Temperatur | Sauerstoff |
|---|---|---|
| Ziffern | genau 3, das Komma setzt die App | 2 oder 3 |
| Speichern möglich | ab 3 Ziffern | ab 2 Ziffern und höchstens 100 |
| Beispiele | `368` → 36,8 · `370` → 37,0 | `98` → 98 · `100` → 100 · `101` gesperrt |

- **Prüf-Hinweis** wie beim Blutdruck („Ungewöhnlicher Wert – bitte prüfen."), wenn der Wert außerhalb
  des plausiblen Bereichs liegt. Er erscheint erst, wenn der Wert vollständig ist, und verhindert das
  Speichern nicht.
- **Einzige Sperre:** Sauerstoff über 100 % ist unmöglich und lässt sich nicht speichern.
- **Bearbeiten:** Der Wert wird wieder in Ziffern zerlegt. Vorsicht: `String(37.0)` ergibt `"37"`.
  Deshalb über `Math.round(value*10)` gehen, sonst wird aus 37,0 beim Bearbeiten etwas Falsches.
- **Der Typ lässt sich nicht ändern:** Eine Temperatur bleibt beim Bearbeiten eine Temperatur.

### 1.1 Ziffern-Logik (alle Werte, auch Blutdruck)

Wunsch des Nutzers (Kommentar auf der Zeichenfläche, 2026-11-06). Der Ziffernblock erkennt selbst, ob ein Wert zwei
oder drei Stellen hat, und springt danach von selbst zum nächsten Feld.

| Feld | Drei Stellen, wenn die erste Ziffer … | sonst | Prüf-Hinweis außerhalb von |
|---|---|---|---|
| Systolisch | 1 oder 2 ist (100–299) | zwei Stellen | 70–250 |
| Diastolisch | 1 ist (100–199) | zwei Stellen | 40–140 |
| Puls | 1 ist (100–199) | zwei Stellen | 35–200 |
| Sauerstoff | 1 ist (100) | zwei Stellen | 70–100 (über 100 gesperrt) |
| Temperatur | immer drei Stellen | – | 34–43 |

- **0 als erste Ziffer wird ignoriert.** Mehr Ziffern als vorgesehen lassen sich nicht eintippen.
- **Vollständig → automatisch weiter** zum nächsten Feld. Beim letzten Feld bleibt die Eingabe stehen, gespeichert wird
  nur per Knopf.
- **Ampel erst bei vollständigem Wert.** Vorher (z. B. bei „1") steht weder Farbe noch Ampel-Wort da.
- **Der Prüf-Hinweis sperrt nichts** (einzige Sperre bleibt Sauerstoff über 100 %).
- Gilt auch für den bisherigen Blutdruck: `capPressDigit` sprang früher erst nach drei Ziffern weiter.
- **Überspringen** führt auf jedem Feld außer dem letzten genau ein Feld nach rechts, auch über Pflichtfelder hinweg.
  Auf dem letzten Feld steht stattdessen „Speichern". Einen Knopf „Weiter" gibt es seit 2026-11-08 nicht mehr. Fehlt
  am Ende ein früheres Feld, ist „Speichern" gesperrt und der Hinweis nennt, was fehlt.
- **Datum und Uhrzeit** stehen seit 2026-11-08 links in der Knopfzeile über dem Ziffernblock, damit sie mit dem Daumen
  erreichbar sind. An einem anderen Tag als heute ist das Feld kräftiger markiert.

---

## 2. Ampel

Eigene Funktion `catMetric(type,v)`, `catVal` bleibt unverändert (sie kennt nur „höher ist schlechter").
Sie liefert Farbe **und** Text, weil Gelb bei der Temperatur zwei Bedeutungen hat. `CAT_LABEL` passt hier nicht.

| Wert | Grün | Gelb | Rot |
|---|---|---|---|
| Temperatur | 36,0–37,4 „Normal" | unter 36,0 „Niedrig" · 37,5–38,0 „Erhöht" | ab 38,1 „Fieber" |
| Sauerstoff | ab 95 „Im Ziel" | 93–94 „Niedrig" | bis 92 „Zu niedrig" |

**Grenzen in `settings.thr`** (zusätzlich zu den vier Blutdruck-Werten):

| Schlüssel | Standard | Bedeutung |
|---|---|---|
| `tempLow` | 36.0 | darunter „Niedrig" |
| `tempY` | 37.5 | ab hier „Erhöht" |
| `tempR` | 38.1 | ab hier „Fieber" |
| `spo2G` | 95 | darunter „Niedrig" |
| `spo2Y` | 93 | darunter „Zu niedrig" |

**Prüfwerte an den Grenzen:** 35,9 Niedrig · 36,0 Normal · 37,4 Normal · 37,5 Erhöht · 38,0 Erhöht ·
38,1 Fieber · 95 Im Ziel · 94 Niedrig · 93 Niedrig · 92 Zu niedrig.

**Zielbereich (Menü → Zielbereich, eigener Menü-Abschnitt seit 2026-11-07, nicht mehr unter „Anzeige"):**

- Je Wert eine Ampel-Leiste, darunter die Grenzen als Eingabe-Chips an den Übergängen, zusammen **neun Grenzen**
  (Sys 2, Dia 2, Temperatur 3, Sauerstoff 2). Jede Zahl gehört zum Bereich rechts davon („ab"). Hinweissatz darunter:
  „Jede Zahl zählt schon zum Bereich rechts davon: 37,5 °C gilt als „Erhöht". Die Standardwerte sind gängige
  Richtwerte." Eine gültige Eingabe gilt sofort überall.
- Temperatur-Felder als Textfeld mit `inputmode="decimal"`. Komma und Punkt zählen beide, damit das
  Komma der iPhone-Tastatur sicher ankommt. Die übrigen Felder `inputmode="numeric"`.
- Die Reihenfolge muss stimmen, **auch beim Blutdruck**: `sysY < sysR`, `diaY < diaR`, `tempLow < tempY < tempR` und
  `spo2Y < spo2G ≤ 100`. Sonst wird die Eingabe nicht übernommen.
- **Fehlermeldung** (rote Zeile unter der Leiste, Chip rot umrandet) erst, wenn die Eingabe fertig aussieht (Temperatur
  `NN,N`, sonst 2–3 Ziffern), damit beim Tippen nichts blinkt: „Bitte eine Zahl wie 37,5 eingeben." / „Bitte eine
  ganze Zahl eingeben." / „Höchstens 100 %." / „Nicht übernommen: Die Zahlen müssen von links nach rechts größer
  werden." Beim **Verlassen** eines ungültigen Felds springt es auf den alten Wert zurück, dazu der Hinweis-Toast
  „Nicht übernommen, der alte Wert gilt weiter."
- „Standardwerte wiederherstellen" setzt alle neun Grenzen zurück.
- **Stand-Zeile** des Abschnitts im Menü: „Standardwerte", sobald eine Grenze abweicht „Eigene Werte".

**Noch nicht abgesichert, nicht als Tatsache darstellen:** Das sind gängige Richtwerte. Die
Sauerstoff-Stufen stammen aus Gesundheitsratgebern. Für die Fieber-Grenzen wurde keine offizielle
Leitlinie gefunden. Deshalb sind sie änderbar, was z. B. bei Lungenerkrankungen mit anderem Zielbereich
wichtig ist. Der Nutzer will sie mit seiner Ärztin oder seinem Arzt besprechen.

**Bewusst einfach:** Nach unten gibt es bei der Temperatur keine rote Stufe. Auch sehr niedrige Werte
bleiben gelb „Niedrig", unter 34 kommt der Prüf-Hinweis dazu.

---

## 3. Dashboard

Neu aufgebaut („Letzte Messung + 7 Tage", Entwurf vom 2026-11-06, Nutzer: „erstmal fertig"). Alle vier Werte im
selben Aufbau, Einzelheiten in [dashboard-spezifikation.md](dashboard-spezifikation.md). Der Ampel-Ring entfällt.

### 3.1 Kennzahlen je Wert
- **Letzte Messung:** eigene Karte je Wert (Blutdruck + Puls · Temperatur · Sauerstoff). Zahl mit Einheit in
  Ampelfarbe, Ampel-Punkt und Ampel-Wort, Zeitpunkt relativ (`relTime`). Puls in Puls-Farbe ohne Ampel, „–" wenn
  die Messung keinen Puls hat.
- **Ø 7 Tage** (rollierend, 168 h, fest): Temperatur auf eine Nachkommastelle, Sauerstoff ganzzahlig. **Erst ab 3
  Messungen** (`DASH_MIN`). Der Ø trägt Ampelfarbe und Ampel-Wort (`catMetric` auf dem gerundeten Ø; Blutdruck
  `category()` auf den gerundeten Ø-Werten). Puls: Ø ohne Ampel, eigene Zählung (Messungen ohne Puls zählen nicht).
- **Kein Trend, keine Anzahl „im Ziel", keine Grafik** (Verläufe gehören in den Tab „Diagramm").
- **Antippen:** Karte „Letzte Messung" → Detail dieser Messung; Karte „Letzte 7 Tage" → Diagramm mit diesem Wert,
  Zeitraum 7 Tage.

### 3.2 Leerzustände
| Lage | Anzeige |
|---|---|
| Noch kein Wert dieses Typs | Karte „Letzte Messung" mit „Noch kein Wert" |
| 1–2 Messungen in 7 Tagen | „Zu wenige Messungen · Ø erst ab 3 Messungen" (Puls nur „Zu wenige Messungen") |
| Keine Messung in 7 Tagen | „Keine Messung · in den letzten 7 Tagen", die letzte Messung bleibt oben sichtbar |
| Gar keine Werte | „Noch keine Messung erfasst." mit Hinweis auf das + |

---

## 4. Verlauf und Diagramm

- **Gemeinsamer Umschalter** Blutdruck · Temperatur · Sauerstoff. Er gilt für beide Ansichten, ist
  flüchtig (nicht in `settings`, nicht im Backup) und startet bei Blutdruck.
- **Gemeinsamer Zeitraum** wie bisher (`verlaufRange`, `applyVerlaufRange`, `filters.from/to`), Standard 30 Tage.
  Die übrigen Felder in `filters` (`sysMin` usw.) gelten für die neuen Werte nicht.

### 4.1 Verlauf
- Neueste zuerst. Zeile: Datum, Uhrzeit, Wert in Ampelfarbe, Notiz-Zeichen. Tippen öffnet das Detail.
- Kopfzeile: Zeitraum und Anzahl.
- **Leer:** kein Wert dieses Typs → „noch kein Wert erfasst"; im Zeitraum leer → „keine Werte in diesem Zeitraum".

### 4.2 Diagramm
- **Eigene Grafik, zeitgetreue Achse** (Berechnung aus `rpChart`). Ein einzelner Wert steht in der Mitte.
  `buildDiagChart` bleibt unberührt.
- **Inhalt:** Verbindungslinie, Punkte in Ampelfarbe (`catMetric`), gestrichelte Ø-Linie über den Zeitraum,
  keine Schwellen-Linien. Kopf: Ø mit Ampel-Text, Zeitraum, Anzahl.
- **Knöpfe Sys/Dia/Beide/Puls** werden ausgeblendet.
- **Höhen-Achse:** Sie umschließt immer alle Werte. Damit kleine Schwankungen nicht dramatisch wirken, gilt
  eine Mindest-Spanne:

  | Wert | Untere Grenze | Obere Grenze | Mindest-Spanne |
  |---|---|---|---|
  | Temperatur | kleinster Wert − 0,3, abgerundet auf ganze Grad | größter Wert + 0,3, aufgerundet auf ganze Grad | 2 °C |
  | Sauerstoff | kleinster Wert − 2, abgerundet auf 5er-Schritte | immer 100 | 10 % |
- **Leer:** „Noch keine Daten im gewählten Zeitraum." wie bisher.

---

## 5. Detail

- Großer Wert mit Einheit in Ampelfarbe, Ampel-Text, Datum/Uhrzeit, Notiz.
- **Position auf der Ampel-Skala:** Bereich Temperatur 34–42, Sauerstoff 85–100, in den Grenzen aus `settings.thr`.
  Die vorhandene Hilfsfunktion `grad` reicht nicht: Die Temperatur hat Gelb auf beiden Seiten, beim Sauerstoff
  ist die Reihenfolge umgedreht.
- **Bearbeiten und Löschen** wie beim Blutdruck (`startCapture`, `askConfirm` mit Vorschau).
- **Nur beim Sauerstoff:** sachlicher Hinweis, dass kalte Finger, Nagellack oder Bewegung den Wert verfälschen können.

---

## 6. Backup und Daten

### 6.1 Format Version 3
```
{ app:'blutdruck', version:3, exportedAt, entries:[…], vitals:[…], settings:{…} }
```
- `app` bleibt `'blutdruck'`. Die App liest das Feld nirgends aus, eine Änderung hätte keinen Nutzen.
- `settings.thr` enthält die neuen Grenzen mit. Die alte App kann damit umgehen, sie behält die
  zusätzlichen Schlüssel einfach.

### 6.2 Zusammenführen (`mergeEntriesFromData`)
- Führt `entries` und `vitals` zusammen. Die Statistik „X neu, Y aktualisiert" zählt beide.
- Akzeptiert auch Backups ohne Blutdruck-Werte. Ungültig ist eine Datei erst, wenn **beide** Listen keinen gültigen Eintrag haben.
- **Gültiger Vitalwert:** bekannter `type`, Zahl als `value`, lesbares `ts`, beim Sauerstoff höchstens 100. Ungültige
  Einträge werden übersprungen.
- **Grenzen beim Übernehmen der Einstellungen:** `applyBackupSettings` führt sie zusammen (Standard ← aktuelle Werte ←
  Backup). Fehlen sie im Backup (Backup der alten App), bleiben die aktuellen Werte erhalten. `plusMode` wird mit
  übernommen, ein unbekannter Wert wird zu `'c'`.
- Wie beim Blutdruck gibt es kein Lösch-Protokoll: Ein gelöschter Wert, der noch in der Datei steht, kann
  beim Zusammenführen zurückkommen.

### 6.3 Zwischen den Apps
| Backup von → nach | Ergebnis |
|---|---|
| Alte App → Pro | Alles kommt an |
| Pro → Pro | Alles kommt an |
| Pro → alte App | Blutdruck und Einstellungen kommen an, Temperatur und Sauerstoff werden ignoriert |
| Pro-Backup nur mit neuen Werten → alte App | Meldung „ungültige Datei", nichts geht kaputt |

**Achtung Android:** Beim automatischen Backup nie dieselbe Datei in beiden Apps verknüpfen. Die alte App würde
sie sonst ohne Temperatur und Sauerstoff überschreiben. Dieser Hinweis steht an **zwei** Stellen (Wunsch des Nutzers;
ursprünglich war nur die Anleitung geplant):

- **Menü → Backup**, Karte „Automatisches Backup": gelbes Warn-Dreieck mit „Diese Datei nie zusätzlich in der alten
  Blutdruck-App verknüpfen. Sie würde die Datei ohne Temperatur und Sauerstoff überschreiben." Sichtbar, **sobald das
  automatische Backup verfügbar ist** (`FS_SUPPORTED`), verknüpft oder nicht, also auch schon beim Verknüpfen. Auf
  dem iPhone gibt es das automatische Backup nicht, die Karte bleibt ausgegraut und ohne Warnung.
- **Anleitung**, Thema „Backup: nichts verlieren": gelber Kasten „Achtung Android".

Daneben steht im Backup-Abschnitt der Hinweis, dass Backups erst an einem **zweiten Ort** (Cloud, Mail, Computer)
sicher vor Verlust sind.

### 6.4 Löschen
„Alle Daten löschen" löscht auch `vitals`, die Meldungen zählen alle Werte zusammen.

---

## 7. CSV

- Spalten: `Datum; Uhrzeit; Systolisch; Diastolisch; Puls; Temperatur (°C); SpO2 (%); Notiz`.
- Eine Zeile je Datensatz, nach Zeit sortiert. Spalten anderer Werte bleiben leer. Es wird nichts anhand gleicher
  Uhrzeiten zusammengelegt.
- Temperatur mit Dezimalkomma und immer einer Nachkommastelle (`36,8`, `37,0`) für das deutsche Excel.

---

## 8. Arzt-Report

Umgesetzt 2026-11-08, Einzelheiten in der [arzt-report-spezifikation.md](arzt-report-spezifikation.md) (Abschnitte 9
und 10). Kurz:

- **Schalter „Temperatur & Sauerstoff einbeziehen":** Standard **an**, flüchtig wie der übrige `reportState`. Die
  Unterzeile zählt die Werte im Zeitraum; ohne Werte entfällt die Seite („Keine Werte im Zeitraum").
- **Eigene A4-Seite** (Seite 2): je Wert Ø mit Ampel-Wort, Tiefst–Höchst, Anzahl und Verlauf, dazu die Werteliste und
  die angewendeten Grenzen. Fehlt ein Wert im Zeitraum, steht dort „Keine Werte im Zeitraum." bzw. „—" in der Tabelle.
- **Anhang im Querformat** für Temperatur & Sauerstoff (beide auf einer Seite), zusammen mit dem Blutdruck-Anhang über
  „Anhangseiten drucken".
- **Seite 1 und `reportData` bleiben unverändert.**
- **Druckweg:** „Drucken" (`window.print`) und daneben **„Als Datei teilen"** (eigenständige HTML-Datei). Ob
  `window.print()` in der installierten iPhone-App den Druckdialog öffnet und ob die geteilte Datei sich als PDF
  drucken lässt, ist **unbestätigt** und gehört in die Gerätetests.

---

## 9. Das große + (alle drei wählbar)

Entschieden 2026-11-06 zunächst nur C, am 2026-11-07 erweitert: **Alle drei Varianten sind wählbar, Standard C.**
Ort: Menü → „Anzeige" → Block „Neue Messung (Plus-Button)", der **zweite Block unter „Design"** (seit der Zielbereich
ein eigener Menü-Abschnitt ist). Vorliebe `settings.plusMode` (`'a'|'b'|'c'`, fehlend oder unbekannt → `'c'`), gilt
**sofort beim Antippen** wie die Akzentfarbe (kein Übernehmen-Knopf) und kommt ins Backup. Die alte App kennt den
Schlüssel nicht und übernimmt ihn einfach nicht.

| | Name im Menü | Satz im Menü | Ablauf |
|---|---|---|---|
| A | Erst wählen | „Nach dem + wählst du, was du misst." | Auswahl-Blatt `#plusSheet` Blutdruck · Temperatur · Sauerstoff, danach die Eingabe |
| B | Direkt starten | „Startet mit Blutdruck. Oben wechselst du den Wert." | Eingabe Blutdruck, oben ein Umschalter zu Temperatur und Sauerstoff, zusätzlich per Wischen |
| C | Alles nacheinander | „Alle Werte in einem Durchgang. Was fehlt, überspringst du." + Pille „Standard" | Sys → Dia → Puls → Temperatur → Sauerstoff, was fehlt, wird übersprungen |

Jede Wahlzeile zeigt ein kleines Bild des Bildschirms, Name, Satz und rechts den Häkchen-Kreis. Das große + ruft
`openPlus()` auf, das nach `plusModeNow()` verzweigt. Die Anleitung erklärt die drei Wege im Thema „Plus-Button".

**Das Datenmodell bleibt bei allen gleich.** Bearbeiten öffnet immer nur die Felder des einen Datensatzes. Bei C:
Jeder ausgefüllte Wert wird ein eigener Datensatz mit gleichem `ts`, leere Felder erzeugen keinen Datensatz, und die
Notiz wird in alle in diesem Durchgang angelegten Datensätze kopiert. Systolisch und Diastolisch gehören zusammen;
der Puls lässt sich in C überspringen (der Blutdruck-Datensatz hat dann `pulse:null`).

Neue Blätter müssen über `navPush` laufen und in `NAV_SHEETS` stehen, damit der Android-Zurück-Knopf funktioniert.

---

## 10. Stellen im Code, die früher nur Blutdruck kannten (erledigt 2026-11-07)

Checkliste für den Umbau, **alle Punkte umgesetzt**. Bleibt als Nachschlage-Liste, wo die neuen Werte angeschlossen sind:

| Stelle | Was sich geändert hat |
|---|---|
| `openDB`, `initStorage` | Neuer Store `vitals` (`DB_VER` 2) und Laden von `vitals` |
| `renderDashboard` | Neu aufgebaut, bricht nur ab, wenn **gar keine** Werte da sind (`totalCount`) |
| `meanKey`, `trendChip` | Temperatur über `meanMetric`/`fmtMetric` mit Nachkommastelle; `trendChip` entfiel mit dem Trend |
| `animateDashboard` | Hochzählen nur für ganze Zahlen, die Temperatur bleibt ohne Animation |
| `startCapture`, `capUpdate`, `capPressDigit`, `capSkip`, `capSave`, `capPressBack` | Feldliste je Art über `CAP_MODES` |
| `renderTable`, `renderChart` | Umschalter (`viewMetric`), `getFilteredVitals`, `renderMetricChart`, neue Leerzustände |
| `renderDetail`, `#detEdit`, `#detDelete` | Suchen über `findRecord` in beiden Listen, `renderVitalDetail` |
| `exportCSV`, `exportJSON`, `shareBackup` | „Noch keine Werte" nur, wenn beide Listen leer sind (`totalCount`) |
| `clearAllData` | Zählt und löscht beide Listen |
| Backup-Erinnerung, Zähler `#csvNote` | Zählen alle Werte (`countParts`) |
| `applyBackupSettings` | Grenzen zusammenführen statt ersetzen (siehe 6.2) |

---

## 11. Bewusst nicht enthalten

Messort bei der Temperatur · Puls beim Sauerstoff · Apple Health und Bluetooth (auf dem iPhone nur mit nativer App möglich) ·
Fahrenheit · gemeinsames Diagramm aller Werte.

---

## 12. Trennung Logik ↔ Design (Zusammenfassung)

| Fix (im Code) | Mit Claude Design entschieden (Zeichenfläche, umgesetzt) |
|---|---|
| Datenmodell, Speicher, Backup | Großes +: **A, B und C wählbar, Standard C** (Abschnitt 9), Wahl im Menü → Anzeige |
| Eingabe-Regeln, Ziffern-Logik, Plausibilität, Sperre | Eingabe mit großer Vorschauzahl, Segment-Kacheln und eigenem Ziffernblock |
| Berechnung, Zeitfenster, Rundung | Dashboard „Letzte Messung + 7 Tage" im Kachel-Stil, ohne Trend, Ring und Punktreihe |
| Ampel-Regeln und Grenzen | Zielbereich als Ampel-Leisten in einem eigenen Menü-Abschnitt; Farben und Schrift im Rahmen der Tokens ([arzt-report-spezifikation.md](arzt-report-spezifikation.md), Abschnitt 8) |
| Leerzustände (Regeln) | Text-Formulierungen in App, Menü und Anleitung (vom Nutzer abgestimmt) |
| Diagramm: Zeitachse, Punkte, Ø-Linie, Höhen-Achse | Umschalter Blutdruck · Temperatur · Sauerstoff, Sauerstoff-Symbol „Bläschen", App-Icon **7a** |

Offen ist nur noch, wie einiges auf echten Geräten wirkt (iPhone und Android, siehe Gerätetests in der `CLAUDE.md`).
