# Vitalwerte – Datenspezifikation

Stand: 2026-11-04. Diese Datei beschreibt **was** die App bei Körpertemperatur und
Sauerstoffsättigung (SpO₂) rechnet, speichert und anzeigt – nicht wie es aussieht. Gleiche
Aufteilung wie die [dashboard-spezifikation.md](dashboard-spezifikation.md):

- **Fix (Logik/Daten):** Datenmodell, Eingabe-Regeln, Berechnung, Zeitfenster, Ampel-Regeln,
  Leerzustände, Backup. Das ist hier festgelegt, damit kein Entwurf an den Datenregeln vorbeigeht.
- **Offen (Aussehen → Claude Design):** das große +, Anordnung/Hierarchie, Farben, Kachel- und
  Diagramm-Gestaltung, genaue Text-Formulierungen, App-Icon.

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
- **Zeitfenster rollierend ab jetzt**, wie im Dashboard (`ageDays`): „7 Tage" = 0–7, „Vorwoche" = über 7 bis 14.
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
  des plausiblen Bereichs liegt. Er erscheint erst, wenn genug Ziffern da sind, und verhindert das
  Speichern nicht.
- **Einzige Sperre:** Sauerstoff über 100 % ist unmöglich und lässt sich nicht speichern.
- **Bearbeiten:** Der Wert wird wieder in Ziffern zerlegt. Vorsicht: `String(37.0)` ergibt `"37"`.
  Deshalb über `Math.round(value*10)` gehen, sonst wird aus 37,0 beim Bearbeiten etwas Falsches.
- **Der Typ lässt sich nicht ändern:** Eine Temperatur bleibt beim Bearbeiten eine Temperatur.

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

**Zielbereich (Menü → Anzeige):**

- Neue Ampel-Chips für alle fünf Grenzen. Eine Änderung wirkt sofort überall.
- Temperatur-Felder als Textfeld mit `inputmode="decimal"`. Komma und Punkt zählen beide, damit das
  Komma der iPhone-Tastatur sicher ankommt.
- Die Reihenfolge muss stimmen: `tempLow < tempY < tempR` und `spo2Y < spo2G ≤ 100`. Sonst wird die
  Eingabe nicht übernommen.
- „Standardwerte wiederherstellen" setzt wie bisher alle Grenzen zurück, also auch die neuen.

**Noch nicht abgesichert, nicht als Tatsache darstellen:** Das sind gängige Richtwerte. Die
Sauerstoff-Stufen stammen aus Gesundheitsratgebern. Für die Fieber-Grenzen wurde keine offizielle
Leitlinie gefunden. Deshalb sind sie änderbar, was z. B. bei Lungenerkrankungen mit anderem Zielbereich
wichtig ist. Der Nutzer will sie mit seiner Ärztin oder seinem Arzt besprechen.

**Bewusst einfach:** Nach unten gibt es bei der Temperatur keine rote Stufe. Auch sehr niedrige Werte
bleiben gelb „Niedrig", unter 34 kommt der Prüf-Hinweis dazu.

---

## 3. Dashboard

Zwei neue Bereiche, je Wert einer. Die vorhandenen Blutdruck-Kennzahlen und der Ampel-Ring (nur Blutdruck) bleiben.

### 3.1 Kennzahlen je Wert
- **Letzter Wert:** Zahl mit Einheit, Ampel (Farbe + Text), Zeitpunkt (`relTime`).
- **Ø 7 Tage:** Temperatur auf eine Nachkommastelle, Sauerstoff ganzzahlig.
- **Trend zur Vorwoche:** gerundeter Ø (7 Tage) minus gerundeter Ø (Vorwoche), wie beim Blutdruck.
  Bei der Temperatur in Zehnteln rechnen, damit 36,8 − 36,6 genau `0,2` ergibt.
- **Neutral:** Ø und Trend ohne Ampelfarbe, der Pfeil wertet nicht. Nur der letzte Wert trägt die Ampel.

### 3.2 Leerzustände
| Lage | Anzeige |
|---|---|
| Noch kein Wert dieses Typs | „–" und kurzer Hinweis, dass noch kein Wert erfasst ist |
| Letzter Wert älter als 7 Tage | Letzter Wert bleibt sichtbar, Ø „–", kein Trend |
| Nur eines der beiden Fenster hat Werte | Ø falls vorhanden, kein Trend |
| Keine Blutdruck-Werte, aber Temperatur oder Sauerstoff | Neue Bereiche normal, Blutdruck-Bereich mit Leerzustand |
| Gar keine Werte | Wie bisher „Noch keine Messung erfasst." |

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
- **Grenzen beim Übernehmen der Einstellungen:** Fehlen sie im Backup (Backup der alten App), bleiben die
  aktuellen Werte erhalten. Heute würde `applyBackupSettings` sie auf den Standard zurücksetzen.
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
sie sonst ohne Temperatur und Sauerstoff überschreiben. Dieser Hinweis kommt in die Anleitung.

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

Die Details kommen in die [arzt-report-spezifikation.md](arzt-report-spezifikation.md), wenn der Report umgebaut wird. Fest ist:

- **Schalter „Temperatur & Sauerstoff einbeziehen":** Beim Öffnen aus, flüchtig wie der übrige `reportState`. Gibt es im
  Zeitraum keine solchen Werte, ist er ausgegraut mit kurzer Begründung.
- **Eigene A4-Seite:** je Wert Ø mit Ampel-Text, Min/Max, Anzahl und Verlauf, dazu eine Wertetabelle und die angewendeten
  Grenzen. Fehlt ein Wert im Zeitraum, steht dort „—".
- **Seite 1 und `reportData` bleiben unverändert.**
- **Druckweg noch offen:** Er hängt vom iPhone-Test ab (Test 3). Klappt `window.print()` in der installierten App
  nicht, teilt die App den Bericht als eigene Datei.

---

## 9. Das große + (Design entscheidet)

Drei Varianten, Entscheidung nach den Mockups: **A** Auswahl-Blatt · **B** Direkt mit Umschalter · **C** Alles in einem Durchgang.

**Das Datenmodell bleibt bei allen gleich.** Bearbeiten öffnet immer nur die Felder des einen Datensatzes. Falls C gewählt wird:
Jeder ausgefüllte Wert wird ein eigener Datensatz mit gleichem `ts`, leere Felder erzeugen keinen Datensatz, und die Notiz gilt für alle in
diesem Durchgang angelegten Datensätze.

Neue Blätter müssen über `navPush` laufen und in `NAV_SHEETS` stehen, damit der Android-Zurück-Knopf funktioniert.

---

## 10. Stellen im Code, die heute nur Blutdruck kennen

Damit beim Umbau nichts übersehen wird:

| Stelle | Was sich ändert |
|---|---|
| `openDB`, `initStorage` | Neuer Store und Laden von `vitals` |
| `renderDashboard` | Bricht heute ab, wenn `entries` leer ist. Das darf die neuen Bereiche nicht mehr verhindern |
| `meanKey`, `trendChip` | Runden auf ganze Zahlen bzw. zeigen Rohzahlen, die Temperatur braucht eine Nachkommastelle |
| `animateDashboard` | Das Hochzählen rundet und kennt kein Komma, für die Temperatur nicht so verwenden |
| `startCapture`, `capUpdate`, `capPressDigit`, `capNext`, `capSave`, `capPressBack` | Fest auf 3 Felder ausgelegt, sie bekommen eine Feldliste je Wert |
| `renderTable`, `renderChart` | Umschalter und neue Leerzustände |
| `renderDetail`, `#detEdit`, `#detDelete` | Suchen nur in `entries` |
| `exportCSV`, `exportJSON`, `shareBackup` | „Noch keine Werte" darf nur erscheinen, wenn beide Listen leer sind |
| `clearAllData` | Anzahl und Löschen beider Listen |
| Backup-Erinnerung, Zähler `#csvNote` | Prüfen bzw. zählen nur `entries` |
| `applyBackupSettings` | Grenzen zusammenführen statt ersetzen (siehe 6.2) |

---

## 11. Bewusst nicht enthalten

Messort bei der Temperatur · Puls beim Sauerstoff · Apple Health und Bluetooth (auf dem iPhone nur mit nativer App möglich) ·
Fahrenheit · gemeinsames Diagramm aller Werte.

---

## 12. Trennung Logik ↔ Design (Zusammenfassung)

| Fix (im Code) | Offen (mit Claude Design) |
|---|---|
| Datenmodell, Speicher, Backup | Das große + (A, B oder C) |
| Eingabe-Regeln, Plausibilität, Sperre | Aussehen von Eingabe und Vorschau |
| Berechnung, Zeitfenster, Rundung | Anordnung und Größe der neuen Dashboard-Bereiche |
| Ampel-Regeln und Grenzen | Farben und Schrift im Rahmen der Tokens ([arzt-report-spezifikation.md](arzt-report-spezifikation.md), Abschnitt 8) |
| Leerzustände (Regeln) | Genaue Text-Formulierungen |
| Diagramm: Zeitachse, Punkte, Ø-Linie, Höhen-Achse | Diagramm-Feinschliff, Aussehen des Umschalters, App-Icon |
