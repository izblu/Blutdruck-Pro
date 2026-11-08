# Blutdruck Pro – Projektkontext für Claude

Eine kleine PWA zum Erfassen von **Blutdruck und Puls, Körpertemperatur, Sauerstoffsättigung (SpO₂) und Körpergewicht**.
Weiterentwicklung der alten App [izblu/Blutdruck](https://github.com/izblu/Blutdruck) im eigenen Repo
**izblu/Blutdruck-Pro**, live unter https://izblu.github.io/Blutdruck-Pro/ (GitHub Pages). **Jeder Push ist kurz
darauf live.** Hauptgerät ist das **iPhone**, Android muss weiter funktionieren.

Aufgeteilt in [index.html](index.html) (HTML-Struktur), [styles.css](styles.css) (Gestaltung/CSS),
[vitals.js](vitals.js) (Grundlagen für Temperatur, Sauerstoff & Gewicht) und [app.js](app.js) (Logik/JavaScript), dazu
[sw.js](sw.js) (Offline) und [manifest.webmanifest](manifest.webmanifest) (Installation). **Kein Build, kein
Framework, keine Abhängigkeiten, kein Server.**

Fachliche Regeln stehen in eigenen Spezifikationen:
[vitalwerte-spezifikation.md](vitalwerte-spezifikation.md) (Temperatur, Sauerstoff & Gewicht, Ziffern-Logik, großes +),
[dashboard-spezifikation.md](dashboard-spezifikation.md) und
[arzt-report-spezifikation.md](arzt-report-spezifikation.md).

## Sprache
- Mit dem Nutzer immer auf **Deutsch** kommunizieren.
- Den Nutzer **nicht mit Namen** ansprechen.

## Zusammenarbeit / Erklärstil
Der Nutzer ist **Programmier-Anfänger**. Deshalb:
- Erklärungen **einfach und verständlich** halten, nah am Anwender.
- **Fachbegriffe in Klammern** hinter die einfache Erklärung setzen, z. B. „Browser-Datenbank
  (IndexedDB)", damit der Nutzer die Fachsprache nebenbei mitlernt.
- Vor größeren Änderungen kurz Optionen/Plan zeigen statt sofort drauflos zu bauen.
- **Unbestätigtes nicht als Tatsache darstellen.** Offen sind vor allem: das Teilen-Menü auf dem iPhone, ob
  Safari-Daten in der installierten App ankommen, ob `window.print` in der installierten App druckt, die
  Fieber-Grenzen (keine Leitlinie gefunden) und die Wirkung der iPhone-Meta-Tags (Statusleiste).
- **Kontext im Blick behalten:** Ab etwa 150k Token von selbst eine Übergabe-Notiz schreiben und eine neue
  Sitzung mit frischem Kontext vorschlagen bzw. starten (nach einem Commit, vor dem nächsten Schritt).

## Commit-Ablauf (WICHTIG – ausdrücklicher Wunsch des Nutzers)
- Wenn ein abgeschlossener, getesteter Stand erreicht ist: **zuerst fragen**, ob committet und gepusht werden soll.
- **Nach dem Ja committet und pusht Claude selbst** (der Nutzer muss nichts im Terminal eingeben). Commit-Text:
  kurze Betreffzeile, darunter Stichpunkte mit den Details.
- Grund für die Rückfrage: Jeder Push ist kurz darauf auf GitHub Pages live.
- Nur eigene Dateien committen. **`izblu/Blutdruck` und `izblu/File-Compressor` nie anfassen.**

## Arbeitsumgebung und Test
- **Python** nur mit vollem Pfad: `C:/Users/Guenay/AppData/Local/Programs/Python/Python314/python.exe`.
  **Node ist nicht installiert.**
- **Lokaler Server:** `.claude/launch.json` → `blutdruck-static` (Python `http.server`, Port **5173**,
  `http://localhost:5173/`). Ist 5173 schon belegt, läuft dort meist schon ein Server für diesen Ordner – dann
  einfach die Adresse direkt öffnen.
- **Prüfen im eingebauten Browser** in Handygröße 375×812, **hell und dunkel**. Vorher den Service Worker abmelden
  und die Caches leeren. Handygröße per Preset „mobile" meldet sich als **Android** → der Installations-Assistent
  öffnet sich (per JS `$('#instDlg').close()` schließen; andere Wege mit `instOpen('ios'|'iosOther'|'android'|
  'androidMenu'|'import')`). Für Screenshots Animationen abschalten:
  `*{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}`
  (nicht `animation:none`, sonst bleiben die Diagrammlinien unsichtbar).
- **iPhone kann Claude nicht testen.** Gerätetests macht der Nutzer selbst (siehe „Geparkte Aufgaben").

## Aktueller Stand

### Trennung von der alten App
Pro startete als Kopie der alten App und hat **eigene interne Namen**, damit beide unter `izblu.github.io`
nebeneinander laufen, ohne sich Daten zu teilen. Werte wandern nur per Backup-Datei.

| Wofür | Alte App | Blutdruck Pro |
|---|---|---|
| Browser-Datenbank (IndexedDB) | `blutdruck` | `blutdruck-pro` (Version 2) |
| Kopie im `localStorage` | `bp_entries`, `bp_settings` | `bpp_entries`, `bpp_settings`, `bpp_vitals` |
| Offline-Speicher (Cache) | `blutdruck-v…` | `blutdruck-pro-v…` |
| Backup-Dateiname | `blutdruck-backup-…` | `blutdruck-pro-backup-….txt` |

`sw.js` löscht beim Aktualisieren **nur eigene** Offline-Speicher (Präfix `blutdruck-pro-`). Die Service Worker
der alten App und von File-Compressor räumen fremde Caches weg – harmlos, Pro lädt seine Dateien dann online neu.

### Code-Struktur
- `index.html` (~680 Z.), `styles.css` (~990 Z.), `vitals.js` (~230 Z.), `app.js` (~2660 Z.), `sw.js`.
  Eingebunden per `<link rel="stylesheet">` und `<script defer>` – **`vitals.js` vor `app.js`**.
- `sw.js`: Cache **`blutdruck-pro-v19`**, network-first, `fetch` revalidiert per `cache:'no-cache'` (sonst kann ein
  Update alte Dateien mischen). Cacht alle Dateien inkl. Icons und `fonts/hanken-grotesk.woff2`. **Bei jeder
  Änderung an App-Dateien die Cache-Version erhöhen.**

### Temperatur, Sauerstoff & Gewicht (`vitals.js`, Details in der Vitalwerte-Spezifikation)
- **Eigene Liste `vitals`**, getrennt von den Blutdruck-Einträgen `entries` (so bleibt ein Pro-Backup für die alte
  App lesbar). Ein Datensatz, ein Wert: `{id, ts, type:'temp'|'spo2'|'weight', value, note}`, `value` immer als Zahl.
  Eigener Bereich der Browser-Datenbank (IndexedDB-Store `vitals`, `DB_VER` 2) plus `localStorage`-Kopie.
- `vitals.js` enthält nur Definitionen: `METRICS` (Name, Einheit, Nachkommastellen, Plausibel-Bereich),
  `VITAL_THR_DEFAULT`, `catMetric(type,v)` (Ampel **mit** Wort, weil Gelb bei der Temperatur zwei Bedeutungen hat),
  `fmtMetric`/`meanMetric`, Ziffern-Logik (`CAP_DEF`, `digitTarget`, `rawComplete`, `capFieldCat`, `capFieldOdd`),
  Speicher (`addVital`/`updateVital`/`removeVital`/`normVital`), Zählen (`totalCount`, `countParts`) und die
  zeitgetreue Grafik (`buildMetricChart`, `metricScale`).
- **Symbol Gewicht:** Gewichtsstein mit „KG“ (`IC_PATH_WEIGHT`, zweite Kopie im Plus-Blatt in `index.html`). Zwei
  Linienstärken, deshalb darf `icSvg` statt eines Pfads eine Liste `[Pfad, Stärke]` bekommen.
- **Gewicht** (kg, eine Nachkommastelle) hat **keine Ampel** (`hasAmpel`, wie der Puls): nur die Zahl in `--ink`, kein Punkt, kein
  Wort, kein Zielbereich; Schriftfarbe über `metricInk`. Nicht dabei: Zielgewicht, BMI, Pfund, Trend, Körpergröße.
- **Ampel:** Temperatur Niedrig · Normal · Erhöht · Fieber, Sauerstoff Zu niedrig · Niedrig · Im Ziel. Grenzen in
  `settings.thr` (`tempLow`, `tempY`, `tempR`, `spo2Y`, `spo2G`) zusätzlich zu `sysY/sysR/diaY/diaR`. Die
  Standardwerte sind gängige Richtwerte, die **Fieber-Grenzen sind nicht gegen eine Leitlinie bestätigt**.
- Sauerstoff über 100 % ist die einzige Sperre; sonst gibt es nur den Prüf-Hinweis „Ungewöhnlicher Wert – bitte prüfen."

### Messwerte ein- und ausschalten (Details in der Vitalwerte-Spezifikation, Abschnitt 13)
- **Blutdruck und Puls immer an.** Temperatur, Sauerstoff, Gewicht einzeln abwählbar, Standard alle an, unter Menü → „Messwerte".
  Speicher: `settings.hiddenVitals` (Liste der **ausgeblendeten** Arten, im Backup). Abfrage: `vitalOn`, `activeVitals`, `visibleVitals`
  (`vitals.js`), `metricOrder`, `capFieldsOf`, `shownThrRows` (`app.js`).
- **Ausschalten heißt nur ausblenden:** nichts wird gelöscht, keine Rückfrage, wirkt sofort. Ausgeblendet in Erfassen, Dashboard, Verlauf,
  Diagramm, Zielbereich, Arzt-Report, CSV. **Nicht** in Backup, Backup-Erinnerung, Stand-Zeile „Daten" und „Alle Daten löschen" (`totalCount`).
- **Abhängig davon:** Umschalter und Wischen (`.metric-seg`, `#capSwitch`, Breite der Markierung über `--n`, bei nur Blutdruck weg), `#plusSheet`,
  Dashboard-Anordnung (`lastVital`), Report-Schalter und Seitentitel (`reportVitals`), `#csvNote`, Löschen-Rückfrage (`countParts('shown'|'hidden'|'all')`).
- **Wiederherstellen:** `restoreDone` → `offerSettingsRestore` → `finishRestore`; Zusatzmeldung „Ausgeblendet: …" erst nach der Wahl (`hiddenInFileNote`).

### Design-Tokens, Dark Mode, Akzentfarben
- **Design-Tokens** (`:root` in [styles.css](styles.css)): `--bg/--surf/--surf2/--ink/--muted/--line/--accent`,
  `--accent-soft` (getönte Flächen, per `color-mix`), `--scrim` (Abdunkelung hinter Fenstern), Ampel je Kategorie
  `--g/y/r-ink/-soft/-bar`, Puls `--pulse-*`. Alte Namen (`--surface/--text/--border/--primary` …) bleiben als Aliasse.
- **Echter Dark Mode** per `@media (prefers-color-scheme)` **und** `:root[data-theme]` (Hell/Dunkel/Auto im Menü).
- **Kontrast hell und dunkel (Entwurf G, 2026-11-08):** Karten (`--surf`) sind heller als der Grund, Innenkarten (`--surf2`)
  liegen dunkler darin wie eine Mulde, Knöpfe darauf wieder hell. Knöpfe auf Innenkarten `--btn/--btn-bd`, Knöpfe auf Karten
  und Leisten `--chip`. Der offene Menü-Abschnitt hängt an `--open-*` (Akzent-Rahmen, getöntes Kopfband, gefülltes Symbol; hell
  zeigt das Symbol `--accent-ink`, dunkel `--bg`), die Fläche hinter Fenstern an `--dlg-backdrop`. Im Hellen liegen die Ampel-Schrift auf dem
  Grund (Verlauf) und Kobalt auf den Mulden knapp über 4,5:1, `--bg` und `--surf2` also nicht dunkler machen, ohne die Schrift
  nachzurechnen. Textknöpfe (`.btn-text`) nutzen `--btn-link`: hell die Akzentfarbe mit 18 % Schwarz, damit sie auch auf Grund
  und Mulden lesbar bleiben, dunkel unverändert `--accent`.
- **Akzentfarben pro Modus** (`settings.accent`, Standard `kobalt`): Hell und Dunkel haben je eine eigene 6-Farben-Liste
  (`ACCENTS_LIGHT`/`ACCENTS_DARK`). `--accent` und `--accent-ink` (Schrift darauf, schwarz oder weiß) setzt JS
  (`applyAccent`/`applyTheme`/`resolveAccent`). Fehlt die Farbe im anderen Modus, fällt nur die **Anzeige** auf den
  Standard zurück, die Wahl bleibt gespeichert.
- **Statusleiste (`theme-color`):** zwei Meta-Tags mit `media` (hell `#d9e0ea`, dunkel `#0a0e15` = `--bg`). Bei fest
  „Hell"/„Dunkel" setzt `applyThemeColor()` (aus `applyTheme`) beide auf das aktuelle `--bg`.
- Schrift **Hanken Grotesk** lokal (`fonts/`, offline, keine Google-Fonts-Anfrage).

### Navigation
Feste Tab-Bar unten **Dashboard · Verlauf · [ + ] · Diagramm · Menü** mit zentralem „+"-Knopf (FAB). Screen-Router
`showTab(name)` (`dashboard/capture/table/detail/chart/report`). Blätter und Ebenen laufen über `navPush`/`navBack`
(Browser-Verlauf), damit der **Android-Zurück-Knopf** funktioniert; Blätter stehen in `NAV_SHEETS`
(`#capDtSheet`, `#capNoteSheet`, `#rangeSheet`, `#dgPop`, `#plusSheet`).

### Großes + und Erfassen (`#tab-capture`)
- **Das große + hat drei wählbare Wege** (`settings.plusMode`, Standard **`'c'`**, kommt ins Backup), gewählt unter
  Menü → Anzeige → „Neue Messung (Plus-Button)". Überall nur eingeschaltete Werte; sind nur Blutdruck und Puls an, startet es sofort die
  Eingabe und die Wahl ist ausgegraut (`#plusPickNote`). `openPlus()` verzweigt:
  - **A „Erst wählen"**: Auswahl-Blatt `#plusSheet` Blutdruck · Temperatur · Sauerstoff · Gewicht.
  - **B „Direkt starten"**: Blutdruck, oben ein Umschalter zu Temperatur/Sauerstoff/Gewicht, zusätzlich per Wischen.
  - **C „Alles nacheinander"**: Sys → Dia → Puls → Temperatur → Sauerstoff → Gewicht; Fehlendes wird übersprungen. Jeder Wert
    wird ein eigener Datensatz mit gleichem `ts`, die Notiz wird in alle kopiert. Puls lässt sich überspringen
    (`pulse:null`, alle Puls-Stellen kommen damit klar).
- **Geführte Eingabe** mit eigenem Ziffernblock, großer Vorschauzahl, Segment-Kacheln mit Ampel, Datum/Uhrzeit- und
  Notiz-Blatt, Speichern-Häkchen. Feldliste je Art über `CAP_MODES`, Einstieg `startCapture({mode|entry|vital,
  switcher},returnTab)`. Bearbeiten öffnet nur die Felder des einen Datensatzes; der Typ bleibt.
- **Ziffern-Logik:** erkennt 2 oder 3 Stellen selbst (Sys mit 1/2 am Anfang dreistellig, Dia/Puls/SpO₂ mit 1,
  Temperatur immer drei Ziffern, das Komma setzt die App: `368` → 36,8; Gewicht drei Ziffern, mit 1/2 am Anfang vier: `825` → 82,5,
  `1025` → 102,5), 0 am Anfang wird ignoriert, vollständig →
  automatisch weiter. Ampel erst bei vollständigem Wert.
- **Notiz-Feld** (`#capNoteBtn`, Aussehen eines Eingabefelds) über die ganze Breite direkt über dem Ziffernblock, zeigt
  eine vorhandene Notiz einzeilig an und öffnet das Notiz-Blatt. Bleibt beim Wischen stehen. Das Notiz-Blatt steht dank
  `capFitNote` (`visualViewport`, `resize` + `scroll`) immer direkt über der Handy-Tastatur.
- **Knopfzeile über dem Ziffernblock (in Daumen-Reichweite):** links Datum/Uhrzeit (`#capDateChip`, an einem anderen
  Tag als heute kräftiger markiert, `.past`), rechts „Überspringen" (immer genau ein Feld nach rechts, auch bei
  ausgefüllten Feldern, `capSkip`) bzw. auf dem letzten Feld „Speichern" (`#capDone`). Den Knopf „Weiter" gibt es nicht
  mehr. Fehlt am Ende etwas Früheres, sagt der Hinweis über dem Ziffernblock, was. Unter 730 px Höhe rücken große Zahl
  und Tasten zusammen, damit die Zahl trotz Notiz-Feld nicht abgeschnitten wird.
- **Wischen** (`onMetricSwipe`, `swipePager`): nach links = Wert rechts daneben, kein Umlauf, gilt in Verlauf, Diagramm
  und Erfassen Variante B. Passive Touch-Ereignisse, also bleibt senkrechtes Scrollen frei; am Bildschirmrand (24 px)
  gehört die Geste dem System. In allen drei Screens folgt der Inhalt (`.swipe-stage`: `#capStage`, `#vStage`,
  `#dgStage`) dem Finger, die Markierung im Umschalter (`#capSwitchInk`, `.metric-seg-ink`) läuft mit; beim Loslassen
  gleitet eine Kopie der alten Seite hinaus und die neue herein (`slideTo`, auch beim Antippen des Umschalters), zu kurz
  oder am Ende der Reihe federt er zurück (`back`). Die Kopie spielt keine Einblend-Animation ab (`.swipe-stage-old`),
  die Verlauf-Zeilen blenden beim Seitenwechsel nicht einzeln ein (`vRowIntro`). Sonst gibt es nur noch das Wegwischen
  von Meldungen (`swipeToast`, folgt ebenfalls dem Finger).

### Dashboard (`renderDashboard`, Startseite)
„Letzte Messung + 7 Tage", alle Werte im selben Aufbau ([dashboard-spezifikation.md](dashboard-spezifikation.md)):
- **Letzte Messung:** Karten Blutdruck + Puls · Temperatur · Sauerstoff, darunter Gewicht über die ganze Breite (`.dlm-wide`,
  ohne Ampel; Anordnung passt sich an die eingeschalteten Werte an, siehe Dashboard-Spezifikation 1.1), Zahl in Ampelfarbe mit Ampel-Punkt und
  Ampel-Wort, Zeitpunkt relativ („vor 2 Std.", `relTime`). Antippen → Detail.
- **Letzte 7 Tage** (rollierend, fest): je Wert nur der **Ø in Ampelfarbe + Wort** (Puls ohne Ampel), **erst ab 3
  Messungen** (`DASH_MIN`), sonst „Zu wenige Messungen" bzw. „Keine Messung in den letzten 7 Tagen". Antippen →
  Diagramm mit diesem Wert, 7 Tage.
- **Entfallen:** Trend zur Vorwoche, Ampel-Ring 30 Tage, „x von y im Ziel", Punktreihe, jede Verlaufsgrafik
  (Verläufe gehören in den Tab „Diagramm").
- **Einblend-Animation** (`animateDashboard`, 680 ms): die Zahlen der letzten Messung zählen hoch (Temperatur mit
  Komma über `fmtMetric`), Karten blenden gestaffelt ein. Alles hinter `prefers-reduced-motion`.

### Verlauf, Detail und Diagramm
- **Umschalter** Blutdruck · Temperatur · Sauerstoff · Gewicht (`.metric-seg` oder Wischen, Zustand `viewMetric`, flüchtig) und
  **gemeinsamer Zeitraum** 7/30/90 + Von–Bis (`applyVerlaufRange`, `filters.from/to`) gelten für Verlauf **und**
  Diagramm.
- **Verlauf** (`renderTable`, Screen-Id bleibt `#tab-table`): neueste zuerst, Werte in Ampelfarbe (Blutdruck per Wert
  `catVal`, Zeilenpunkt = schlechterer). Zeile → **Detail** (`showDetail`/`findRecord`, `renderDetail` bzw.
  `renderVitalDetail`): großer Wert in Ampelfarbe, Ampel-Skala, Kontext, Notiz, Bearbeiten → Erfassen, Löschen →
  `askConfirm`. Beim Sauerstoff ein sachlicher Hinweis (kalte Finger, Nagellack, Bewegung).
- **Diagramm Blutdruck** (`renderChart`/`buildDiagChart`, SVG): Sys/Dia/Beide + Puls-Umschalter, Ampel-Farbpunkte,
  gestrichelte Ø-Linie, keine Schwellen-Linien. Der Puls-Umschalter baut nur die Puls-Ebene ein/aus
  (`setDiagPulseLayer`/`diagPulseLayer`), Sys/Dia spielen ihre Animation nicht erneut ab.
- **Diagramm Temperatur/Sauerstoff/Gewicht** (`renderMetricChart`/`buildMetricChart`; Gewicht mit Punkten in Akzentfarbe, ohne
  Ampel-Wort und Zählung): eigene Grafik mit **zeitgetreuer
  Achse**, Ampel-Punkte (`catMetric`), Ø-Linie, Mindest-Spanne der Höhenachse; Sys/Dia/Puls-Knöpfe ausgeblendet.
- **Ampel Blutdruck:** `catVal(v,y,r)` je Wert, `category(e)` = schlechterer von Sys/Dia.

### Menü (`#menuDlg`, Aussehen A „Verfeinert")
- **Bottom-Sheet** unten am Bildschirmrand mit Griffleiste, schließt nur bei echtem Tippen auf die Fläche daneben
  (`e.target===dialog`). Nur der Inhalt scrollt, Kopf und „Menü schließen" bleiben fest.
- **Reihenfolge:** **Backup · Daten · Messwerte · Zielbereich · Anzeige**, darunter die Karten **Anleitung** („11 Themen") und
  **App installieren** (`#mInstall`, nur im Handy-Browser sichtbar). Immer nur ein Abschnitt offen.
- **Jeder Abschnitt ist eine eigene Karte** (`--surf`, Rand, Radius 18 px; geöffnet mit Schatten, im Dunklen mit Akzent-Rahmen und Kopfband), Symbol im getönten
  Quadrat, darunter eine **Stand-Zeile**: Backup = Stand in Ampelfarbe (ausgeblendet, solange Backup offen ist),
  Daten = Anzahl Messungen, Messwerte = „Alle Werte an"/„Ohne Gewicht"/„Nur Blutdruck und Puls", Zielbereich = „Standardwerte"/„Eigene Werte", Anzeige = „Auto · Kobalt".
- Größere Schrift, Blocküberschriften in normaler Schreibweise, Knöpfe mindestens 44–48 px hoch.
- `openMenu()` frischt alle Stand-Zeilen auf. Wurden Zielbereich oder Messwerte-Schalter geändert (`_viewsStale`), rechnet beim
  Schließen `refreshData()` alles neu.

### Backup (Menü-Abschnitt)
- **Oben: Stand-Block mit Erinnerung** (`backupState`/`renderBackupState`): grün „Alles gesichert", gelb „Seit N Tagen
  nicht gesichert" mit „Erinnerung in …"/„Erinnerung ist fällig"/„Erinnerung ist aus". Darunter „Erinnerung" mit
  **− / +** (`stepReminder`, 0–30 Tage). Hängt an `settings.firstDirtyAt` und `settings.reminderDays`. „Gesichert"
  zählt jedes Backup (`markBackedUp`), weil die App nicht erkennt, wohin eine Datei wirklich geht.
- **Karte „Automatisches Backup"** (immer dieselbe Datei via File System Access API, nur Chromium, auf dem iPhone
  ausgegraut). Status grün „Verknüpft: ‹Dateiname›" bzw. rot „Keine Datei verknüpft". Knöpfe: nicht verknüpft
  **„Neu anlegen"** (`showSaveFilePicker`) / **„Auswählen"**; verknüpft **„Lösen"** / **„Ändern"**. „Auswählen"/„Ändern"
  nutzen den Öffnen-Dialog und **führen** den Datei-Inhalt mit den App-Daten **zusammen**, bevor verknüpft und
  zurückgeschrieben wird. Danach schreibt jede Änderung automatisch (`scheduleAutoBackup`/`autoBackupIfLinked`).
  **Android-Warnung** (gelb, immer wenn `FS_SUPPORTED`): diese Datei nie zusätzlich in der alten App verknüpfen,
  die würde sie ohne Temperatur, Sauerstoff und Gewicht überschreiben.
- **Karte „Manuelles Backup":** „Speichern" (Download) / „Wiederherstellen" (.txt oder ältere .json, Statistik
  „X neu, Y aktualisiert"; Merge-Kern `mergeEntriesFromData`, geteilt mit „Auswählen").
- **Hinweis** (Info-Symbol): Backups liegen auf diesem Handy, sicher erst an einem zweiten Ort. Darunter breiter Knopf
  **„Backup teilen"** (Web Share API; klappt das nicht, fragt ein Dialog nach Download).
- **Format Version 3:** `{app:'blutdruck', version:3, exportedAt, entries, vitals, settings}` (`backupData()`).
  `vitals` enthält immer alle Werte, auch ausgeblendete (kein Platzhalter). Gesichert werden nur Vorlieben (`colorDots`, `guideLines`,
  `theme`, `accent`, `reminderDays`, `thr`, `plusMode`, `hiddenVitals`), nicht `firstDirtyAt`/`snoozeUntil`. Ältere Backups (v2, reines Array) bleiben lesbar. Beim Übernehmen der
  Einstellungen (`applyBackupSettings`) werden die Grenzen **zusammengeführt** (Backup der alten App ohne neue Grenzen
  setzt nichts zurück); fehlt `hiddenVitals`, bleiben die aktuellen Schalter. Zwischen den Apps: Alte → Pro und Pro → Pro alles, Pro → alte App nur Blutdruck und
  Einstellungen (Tabelle in der Vitalwerte-Spezifikation, 6.3).
- **Einstellungen-Rückfrage** (`#restoreDlg`, `offerSettingsRestore()`): enthält ein Backup Einstellungen, „Werte und
  Einstellungen übernehmen" / „Nur die Werte übernehmen" (Raustippen/Esc = nur Werte).
- Kein Lösch-Protokoll: Ein gelöschter Wert, der noch in einer Backup-Datei steht, kann beim Zusammenführen zurückkommen.

### Daten (Menü-Abschnitt)
- „Als CSV exportieren (Excel)": Spalten `Datum; Uhrzeit; Systolisch; Diastolisch; Puls; Temperatur (°C); SpO2 (%);
  Gewicht (kg); Notiz`, Dezimalkomma, ausgeblendete Werte fehlen samt Spalte. Darunter `#csvNote` mit der Anzahl je exportiertem Wert
  („42 Blutdruck · 7 Temperatur · 7 Sauerstoff") und ggf. „Nicht in der CSV, weil ausgeblendet: 5 Gewicht".
- „Arzt-Report (Drucken/PDF)" (`#mReport`).
- „Alle Daten löschen" löscht `entries` **und** `vitals`; die Rückfrage zählt alle Werte je Art und markiert „(ausgeblendet)",
  Pflicht-Häkchen, Hinweis, dass eine Backup-Datei erhalten bleibt. Die Messwerte-Schalter bleiben.
- Info-Zeile mit der **Speicherbelegung** (sofern der Browser eine Quota liefert).

### Zielbereich (eigener Menü-Abschnitt)
Je Wert eine **Ampel-Leiste** mit den Grenzen als Eingabe-Chips an den Übergängen (`THR_ROWS`, `renderThrBars`),
zusammen **neun Grenzen**. Regel: Jede Zahl gehört zum Bereich rechts davon („ab"). Temperatur mit
`inputmode="decimal"` (Komma und Punkt), sonst `numeric`. Prüfung (`thrCheck`): Zahlen müssen von links nach rechts
größer werden – **auch beim Blutdruck** –, Sauerstoff höchstens 100. Fehlermeldung erst bei fertig aussehender Eingabe;
beim Verlassen eines ungültigen Felds zurück auf den alten Wert + Hinweis-Toast. Leisten ausgeblendeter Werte fehlen (`shownThrRows`),
Stand-Zeile und „Standardwerte wiederherstellen" betreffen nur sichtbare Grenzen.

### Anzeige (Menü-Abschnitt)
„Design" (Hell/Dunkel/Auto mit Symbolen + Akzentfarben-Raster) und „Neue Messung (Plus-Button)" (A/B/C mit
Mini-Bild, gilt sofort beim Antippen wie die Akzentfarbe).

### Anleitung (`#helpDlg`)
**11 Themen zum Aufklappen** (immer nur eins offen, das geöffnete rutscht nach oben; `openHelp`/`closeHelpTopics`),
Wortlaut vom Nutzer abgestimmt, bleibt für alle gleich und passt sich nicht an die Schalter an: Werte eintragen · Plus-Button · Messwerte ein- und ausschalten · Dashboard · Farben und Zielbereich · Verlauf und
Diagramm · Backup: nichts verlieren · Wiederherstellen und neues Handy · Daten · Aussehen · App installieren. Der
Backup-Text sagt richtig, dass Backups erst an einem **zweiten Ort** verlustsicher sind („Backup teilen"), und
enthält die Android-Warnung. Unten „‹ Zurück" (ins Menü) und „Menü schließen".

### Arzt-Report (Druck/PDF)
Aufbereiteter, **druckbarer** A4-Bericht für den Arztbesuch. **Reine Datenaufbereitung, keine Diagnose/Bewertung.**
Einstiege: Icon im Diagramm-Kopf (`#rpOpenChart`) und Menü → Daten (`#mReport`), beide `openReport()`.
- **Report-Menü** (Vollbild-Screen `#tab-report`): Zeitraum 30/90/Eigener, Report-Farbe (5 Swatches), Schalter
  **Namensfeld**, **Puls einbeziehen**, **Temperatur einbeziehen**, **Sauerstoff einbeziehen**, **Gewicht einbeziehen** (Standard an, je nur sichtbar, wenn
  der Wert unter Messwerte an ist) und **Anhangseite(n) drucken**, verkleinerte Live-Vorschau, Knöpfe **„Drucken"** und **„Als Datei teilen"**. Das Menü
  folgt dem App-Theme, die A4-Seiten sind **immer hell**.
- **Seiten:** Seite 1 „Kompakt" Blutdruck (`rpPage`) · Seite 2 Temperatur, Sauerstoff & Gewicht (`rpVitalPage`, Titel nach Inhalt, entfällt
  ohne Werte im Zeitraum) · Anhang Blutdruck im Querformat (`rpLandscape`) · Anhang Temperatur, Sauerstoff & Gewicht im
  Querformat (`rpVitalLandscape`, alle Werte auf einer Seite in bis zu drei Bändern, gemeinsame Datumsachse). Reihenfolge über `rpPages`.
- **Technik:** `reportData`/`reportVitals` bündeln die Kennzahlen aus vorhandener Logik, eigener Bereichsfilter
  (nicht `filters`). Feste helle Palette `RP`, eigene Grafiken (`rpChart`, `rpMetricChart`, `rpVitalChartDetail`).
  `reportState` ist **bewusst flüchtig** (bei jedem Öffnen Standard, nichts in `settings`/Backup). Druck über
  `@media print` mit **benannten `@page`** (hoch + quer), jede weitere Seite auf neuem Blatt.
- **„Als Datei teilen"** (`rpShareFile`): eigenständige HTML-Datei mit eingebetteter Schrift, per Web Share, sonst
  Download. Ersatzweg, weil **unbestätigt** ist, ob `window.print` in der installierten iPhone-App druckt.
- Grenzwerte liest der Report aus `settings.thr`; geändert wird unter **Menü → Zielbereich**.

### Installations-Assistent (`#instDlg`)
- Erscheint beim Start **nur im Handy-Browser** (`IS_IOS`/`IS_ANDROID`, nicht in der installierten App, nicht am PC),
  als modales Vollbild-Fenster (App dahinter gesperrt). „Später" schließt, beim nächsten Start kommt er wieder; im
  Menü öffnet „App installieren" ihn erneut. Funktionen `instOpen`/`instRender`/`instInstall`/`instCopy`/`initInstall`.
- **iPhone/Safari:** 3 Schritte über die **Safari-Teilen-Taste** (Pfeil zur Safari-Leiste), dann „Fast geschafft".
  Der Weg über `navigator.share` ist **bewusst nicht gebaut** (unbestätigt). **Anderer Browser/In-App:** „Öffne diese
  Seite bitte in Safari" + „Link kopieren".
- **Android:** „Installieren" → `beforeinstallprompt`; ohne Ereignis der Weg übers Browser-Menü; danach „Installiert".
- **Erster Start der installierten App ohne Werte:** Angebot „Hast du schon Werte?" → Backup-Datei einlesen (Merker
  `localStorage['bpp_import_offered']`).

### App-Icon und iPhone-Feinschliff
- **App-Icon 7a** (Marine-Blau `#173366`, schmale weiße PRO-Pille): `icon-192/512.png` (abgerundet, `purpose any`),
  `icon-maskable-192/512.png` (vollflächig), `apple-touch-icon.png` (180×180), Header-Logo als `SVG_ICON` in app.js.
- **Meta-Tags** in `index.html`: `apple-mobile-web-app-capable` (+ `mobile-web-app-capable`),
  `apple-mobile-web-app-title` „Blutdruck Pro", `apple-mobile-web-app-status-bar-style` `default` (die App hat eigene
  helle und dunkle Flächen), `theme-color` je Modus (siehe Design-Tokens). Wie das auf dem iPhone wirkt, ist **erst
  am Gerät sicher**.
- **Manifest:** `theme_color` und `background_color` `#d9e0ea` (heller App-Hintergrund, z. B. Startbild auf Android).

### Allgemeine Bausteine
- **Speicher:** Messwerte und Einstellungen in der Browser-Datenbank (IndexedDB, Stores `entries`, `vitals`, `meta`),
  `localStorage` als Spiegel/Fallback mit einmaliger automatischer Migration. Einstellungen im `meta`-Store unter
  `'settings'` (`idbGetMeta`/`idbSetMeta`). Speichern ist zweigeteilt: `persistSettings()` (nur ablegen) vs.
  `saveSettings()` (ablegen **+** Auto-Backup planen) – interne Buchhaltung (`markDirty`/`markBackedUp`/Snooze) nutzt
  bewusst `persistSettings()`, sonst entstünde eine Endlosschleife. Beim Start `navigator.storage.persist()`.
- **Zoom-Schutz (Mobil):** Eingabefelder mind. 16 px Schrift, `*{touch-action:manipulation}` gegen Doppeltipp-Zoom.
  Zwei-Finger-Zoom bleibt erlaubt (Barrierefreiheit).
- **Nicht unterstützte Funktionen** werden nicht versteckt, sondern **ausgegraut** mit kurzer Begründung.
- **Speicher voll** (QuotaExceededError): Hinweis statt stillem Fehlschlag (`quotaToast`).
- **Meldungen (Toasts):** `toast(msg, kind)` mit `kind ∈ success | notice | error`, 4 s sichtbar, per Wischen
  schließbar. Bei offenem Fenster wird der Toast **in das Fenster** gerendert (sonst wäre er „inert"), beim Schließen
  wandert er zurück in den Body.
- **Bestätigen-Dialoge (`askConfirm`, `#confirmDlg`):** ein gestaltbarer Dialog statt Browser-`confirm()`, Promise →
  `true`/`false`. Optionen u. a. `icon`/`tone`, `title`, `message` oder `messageHTML`, `confirmLabel`/`cancelLabel`,
  `danger`, `previewHTML`, `detailsText`, `noteText`, `requireCheck`. Aufrufe: Eintrag löschen (Detail),
  Teilen-Fallback (`shareBackup`), Alle Daten löschen (`clearAllData`). `#confirmDlg` steht im HTML **nach** den
  anderen Fenstern (Toast-im-Dialog). Aufräumen von `#confirmExtra` beim **Aufbau**, nicht im `close`-Handler.
- **Obsolet, aber im Backup behalten:** `colorDots` und `guideLines` (Schalter entfallen, Rückwärtskompatibilität).

## Namens-Konvention (Backup vs. CSV)
„Backup …" = vollständige Sicherung/Wiederherstellung (Dateiendung **.txt**, Inhalt JSON, originalgetreu;
.txt wegen Android-Teilen-Kompatibilität – Wiederherstellen akzeptiert .txt **und** ältere .json).
„… CSV …" = für Excel/Auswertung (einseitig, nicht originalgetreu).

## Geparkte Aufgaben

Stand 2026-11-08: Der Umbau „Temperatur & Sauerstoff" (Schritte 1–10) und das Körpergewicht als vierter Messwert sind fertig, inklusive neuem Dashboard, Menü,
Anleitung, Icon, Installations-Assistent, Arzt-Report-Seiten und iPhone-Feinschliff.
*Legende — Aufwand: klein / mittel / groß · Machbarkeit: problemlos / mit Hürde / heikel.*

### 1. Gerätetests (macht der Nutzer, Claude hat kein iPhone)
- **Android ist abgeschlossen (2026-11-08), das iPhone steht noch aus.**
- **iPhone** nach der Geräte-Checkliste aus der Abschluss-Sitzung (2026-11-08): Assistent bis zur
  Installation, Start im Flugmodus, Statusleiste/Ränder/Icon hell und dunkel, Backup teilen → wiederherstellen,
  Arzt-Report drucken bzw. „Als Datei teilen" → PDF, Umzug von der alten App, beide Apps parallel.
- **iPhone, abwählbare Messwerte (eingebaut 2026-11-08, nur im Browser am PC geprüft):** Schalter unter Menü → Messwerte antippen (Tippfläche
  groß genug?), je ein Wert aus: Dashboard, Umschalter und Wischen in Verlauf/Diagramm, großes + (A/B/C). Alle drei aus: + startet direkt, kein
  Umschalter, kein Federn. Backup teilen → auf dem iPhone wiederherstellen: Fenstertext und Meldung „Ausgeblendet: …" prüfen.
- Die Testseite `iphone-test/` wurde am 2026-11-08 auf Wunsch des Nutzers gelöscht (im Git-Verlauf noch vorhanden).
  Die offenen Fragen deshalb an der echten App klären und danach anpassen: Kommt ein in Safari eingetragener Wert in
  der installierten App an? Öffnet „Drucken" im Arzt-Report in der installierten App das Drucken-Fenster? Ob
  `navigator.share` „Zum Home-Bildschirm" anbietet, bleibt offen (der Assistent nutzt es bewusst nicht).

### 2. Offen geblieben aus der UI/UX-Modernisierung
- **Detail-Filter + Sortierung wieder einbauen** — mittel · mit Hürde. Verlauf und Diagramm haben nur den
  **Zeitraum**-Filter. Die frühere Tabelle konnte nach Wertebereichen (Sys/Dia/Puls min–max) und Notiz-Text filtern
  und nach Spalten sortieren. Die Filter-Basis existiert noch (`filters` mit `sysMin/…/note`, `getFiltered`), es fehlt
  die Bedienoberfläche; für Temperatur/Sauerstoff gelten diese Felder noch nicht. Bei Wiedereinführung an **beide**
  Ansichten denken; `getSorted` müsste neu angelegt werden.

### 3. Weitere Features
- **Auto-Wiederherstellung** — mittel · mit Hürde. Beim Start, wenn App leer **und** Datei verknüpft
  (`idbGetMeta('backupHandle')`): Berechtigung prüfen → bei `granted` lesen + `mergeEntriesFromData`.
  *Hürde:* Datei-Berechtigung erlischt oft nach Browser-Neustart und braucht eine Nutzer-Geste → Fallback-Knopf nötig.
  *Voraussetzung – Lösch-Protokoll (Tombstones):* gelöschte IDs protokollieren, damit sie beim Zusammenführen nicht
  wieder auftauchen.
- **Vollständige App-Dokumentation** — mittel · problemlos. Quelle ist die gesamte Codebase (`index.html`,
  `styles.css`, `vitals.js`, `app.js`, `sw.js`, `manifest.webmanifest`). *Anwender-Teil:* alle Funktionen + Tipps.
  *Technischer Teil:* die wichtigsten verknüpften Abläufe (z. B. `saveEntries → idbWriteAll → scheduleAutoBackup →
  autoBackupIfLinked → writeToHandle`; Merge-Kern `mergeEntriesFromData`; Start `init → requestPersistence →
  initStorage`). *Visualisierung:* Flows als Grafiken (build-frei, z. B. Mermaid). Danach kann diese CLAUDE.md
  verschlankt werden.
- **Medikamenten-Erinnerung (Einnahme)** — groß · heikel. Zu einer festen Uhrzeit eine **echte Handy-Benachrichtigung**
  (Ton, Benachrichtigungs-Menü), auch wenn die App nicht offen ist. *Kernhürde:* Eine reine PWA **ohne Server** kann
  das im Hintergrund **nicht zuverlässig**. Bausteine: Benachrichtigungs-Erlaubnis + Service Worker
  (`showNotification`); lokaler Zeit-Auslöser (`TimestampTrigger`) experimentell und nicht überall (v. a. iOS);
  Web Push bräuchte Server + VAPID (widerspricht „kein Server"); bei offener App geht ein Timer; „wecker-echt" evtl.
  nur mit nativer Hülle (TWA/Capacitor). **Vorgehen:** zuerst Machbarkeit klären, dann Umfang festlegen.
- **Einnahme-Tracking** — mittel · problemlos. Festhalten, ob die Medikamente heute genommen wurden (genommen/offen,
  Abhaken, kleiner Verlauf). Eigener Bereich in der Browser-Datenbank, ins Backup aufnehmen. Technisch unabhängig von
  der Erinnerung umsetzbar.

### 4. Zurückgestellt (niedrige Priorität)
- **JS in Module aufteilen** (`storage.js`/`backup.js`/`chart.js`/`ui.js`, `<script type="module">`) — mittel ·
  problemlos, aber Sorgfalt wegen vieler gegenseitiger Abhängigkeiten (Backup/Auto-Backup, Einstellungen/Theme).
  `vitals.js` ist schon ausgelagert; `app.js` hat inzwischen ~2660 Zeilen. Kein `file://`-Problem, weil die PWA
  ohnehin http(s)/localhost braucht; `sw.js` müsste um die neuen Dateien ergänzt werden. Zurückstellen, bis `app.js`
  spürbar unhandlich wird oder größere Eingriffe an Speicher/Backup anstehen.

### 5. Bewusst nicht enthalten / gestrichen
- **Bewusst nicht enthalten:** Messort bei der Temperatur · Puls beim Sauerstoff · Apple Health und Bluetooth (auf dem
  iPhone nur mit nativer App) · Fahrenheit · gemeinsames Diagramm aller Werte · beim Gewicht Zielgewicht, BMI, Körpergröße, Pfund, Trend.
- **CSV-Import** — redundant zu „Backup → Wiederherstellen"; CSV hat keine `id` → Dubletten, fehleranfälliges
  Datums-Parsen. (CSV-**Export** bleibt.)
- **Personalisierung (Alter/Fitness → Zielwerte)** — der Zielbereich-Editor (`settings.thr`) deckt den Bedarf ab;
  automatische Ableitung medizinisch heikel.
- **Profile** (mehrere Personen) — Grundsatzentscheidung 2026-07-01: wird nicht umgesetzt.
- **Erledigt und deshalb ausgetragen:** Arzt-Report (2026-07-14, Seiten für Temperatur & Sauerstoff 2026-11-08),
  Anleitungs-Text „Backup-Sicherheit richtigstellen" (mit der neuen Anleitung 2026-11-07), Backup-teilen-Logik
  geprüft (Dateien werden immer frisch aus den Daten gebaut, `backupBlob`).
