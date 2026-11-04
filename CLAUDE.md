# Blutdruck – Projektkontext für Claude

Eine kleine PWA zum Erfassen von Blutdruck-Werten. Aufgeteilt in [index.html](index.html)
(HTML-Struktur), [styles.css](styles.css) (Gestaltung/CSS) und [app.js](app.js)
(Logik/JavaScript), dazu `sw.js` (Offline) und `manifest.webmanifest` (Installation).
Kein Build, kein Framework, keine Abhängigkeiten.

## Sprache
- Mit dem Nutzer immer auf **Deutsch** kommunizieren

## Zusammenarbeit / Erklärstil
Der Nutzer ist **Programmier-Anfänger**. Deshalb:
- Erklärungen **einfach und verständlich** halten, nah am Anwender.
- **Fachbegriffe in Klammern** hinter die einfache Erklärung setzen, z. B. „Browser-Datenbank
  (IndexedDB)", damit der Nutzer die Fachsprache nebenbei mitlernt.
- Vor größeren Änderungen kurz Optionen/Plan zeigen statt sofort drauflos zu bauen.

## Commit-Ablauf (WICHTIG – ausdrücklicher Wunsch des Nutzers)
- Wenn ein abgeschlossener, getesteter Stand erreicht ist: **NICHT sofort** Commit-Texte erzeugen.
- **Zuerst fragen**, ob der Nutzer zum Committen bereit ist.
- **Erst nach seiner Bestätigung** zwei Texte liefern – jeweils in einem **eigenen Code-Block**
  (damit die Kopier-Funktion funktioniert):
  1. **Zusammenfassung** – eine kurze Betreffzeile.
  2. **Beschreibung** – Stichpunkte mit den Details der Änderung.
- Der Nutzer committet/pusht selbst über **GitHub Desktop**

## Aktueller Stand / bisherige Überarbeitungen
- **UI/UX-Modernisierung (Stufen 1–6, erledigt 2026-07-11):** Die gesamte sichtbare Schicht wurde
  nach dem „Claude-Design"-Entwurf neu gebaut (reines HTML/CSS/JS, kein Build). **Datenmodell,
  Speicher, Backup und Einstellungen blieben unverändert** – nur neu verkabelt. Kernpunkte:
  - **Design-Tokens** (`:root` in [styles.css](styles.css)): Struktur
    `--bg/--surf/--surf2/--ink/--muted/--line/--accent`, Ampel je Kategorie `--g/y/r-ink/-soft/-bar`,
    Puls `--pulse-*`. Echter **Dark Mode** (per `@media (prefers-color-scheme)` **und**
    `:root[data-theme]`) plus **Akzentfarben pro Modus** (`settings.accent`, Standard `kobalt`):
    Hell und Dunkel haben je eine eigene, kuratierte 6-Farben-Liste (`ACCENTS_LIGHT`/`ACCENTS_DARK`
    in app.js) statt gemeinsamer Töne nur auf-/abgehellt – einzelne Farben kommen bewusst nur in
    einem Modus vor (z. B. „Iris" nur hell, „Aqua" nur dunkel). `--accent` (Fläche) **und**
    **`--accent-ink`** (Schrift/Icon darauf – schwarz oder weiß, je nach Helligkeit der Fläche)
    werden gemeinsam per JS gesetzt (`applyAccent`/`applyTheme`/`resolveAccent`); wählt man eine
    Farbe, die im anderen Modus fehlt, fällt nur die **Anzeige** auf den Standard zurück (die
    eigentliche Wahl bleibt gespeichert und gilt wieder, sobald der Modus zurückwechselt). Alte
    Token-Namen (`--surface/--text/--border/--primary` …) bleiben als Aliasse. Schrift
    **Hanken Grotesk** lokal (`fonts/`, offline – keine Google-Fonts-Anfrage).
  - **Navigation:** feste Tab-Bar unten **Dashboard · Verlauf · [ + ] · Diagramm · Menü** mit zentralem
    „+"-Knopf (FAB, → neue Messung); Screen-Router `showTab(name)`
    (`dashboard/capture/table/detail/chart`) blendet die passenden Vollbild-Screens ein. „Tabelle"
    heißt jetzt **„Verlauf"** (Screen-Id bleibt `#tab-table`).
  - **Dashboard** (Startseite, `renderDashboard`): letzte Messung mit Ampel-Status, Ø 7 Tage + Trend
    (vs. Vorwoche), Ø Puls, Ampel-Verteilungs-Ring 30 Tage. Kennzahlen nach
    [dashboard-spezifikation.md](dashboard-spezifikation.md). **Einblend-Animation** beim Öffnen
    (`animateDashboard`, per `requestAnimationFrame`, 680 ms, weiches Auslaufen): die großen Werte der
    letzten Messung **zählen hoch** (Count-up) und der Verteilungs-Ring wird **kreisförmig aufgedeckt**
    (der Farb-Kreis liegt als eigene Ebene `.ring-fill` unter der Mitte, eine `conic-gradient`-Maske
    `--sweep` dreht von 0° auf 360°) samt hochzählender Prozentzahl. Respektiert
    `prefers-reduced-motion` (dann sofort Endwert). Die übrigen Screens nutzen die
    Entwurfs-Animationen (CSS-Keyframes, ebenfalls hinter `prefers-reduced-motion`):
    **gestaffeltes Einblenden** (Dashboard-Karten via `nth-child`-Delay, Verlauf-Zeilen und
    Diagramm-Punkte je mit `animation-delay` beim Rendern), **eingleitende Ampel-Marker** im
    Detail (`markerGlide`, seitlicher Glide, versetzt 0,06/0,14 s) und **Bottom-Sheet-Slide**
    fürs Öffnen von Menü/Anleitung (`#menuDlg/#helpDlg[open]` → `sheetSlide` + `scrimIn`).
  - **Erfassen** (`#tab-capture`, geführte Eingabe): Sys → Dia → Puls einzeln über einen **eigenen
    Ziffernblock**, große Vorschauzahl, Segment-Kacheln mit Ampel-Rückmeldung, Datum/Uhrzeit- und
    Notiz-Sheet, Speichern-Häkchen. Verkabelt mit `addEntry`/`updateEntry`. Ersetzt die alte
    Freitext-Eingabe **und** den früheren Bearbeiten-Dialog (`editDlg` entfiel).
  - **Verlauf** (Liste) + **Detail-Screen:** chronologische Liste (Sys/Dia je in `catVal`-Farbe,
    Zeilenpunkt = schlechterer), Zeitraum-Pillen 7/30/90 + eigener Von–Bis-Wähler; Zeile → Detail
    (großer Wert in Ampelfarbe, Status, Position auf der Ampel-Skala, Kontext-Satz, Notiz;
    Bearbeiten → Erfassen-Edit / Löschen → `askConfirm` + `removeEntry`).
  - **Diagramm** (`renderChart`, SVG): Steuerleiste Sys/Dia/Beide + Puls-Umschalter + geteilter
    Zeitraum; Verbindungslinien + **Ampel-Farbpunkte** (`catVal`) + gestrichelte Ø-Linie, **keine**
    Schwellen-Linien/Zonen mehr. Ersetzt das alte 7-Linien-Diagramm samt `renderStats`. Der
    Puls-Umschalter baut dafür **nicht** jedes Mal das ganze Diagramm neu: `setDiagPulseLayer`
    fügt nur die rosa Puls-Ebene (`<g class="dg-pulse-g">` – Linie, Punkte, „bpm"-Beschriftung,
    gebaut von `diagPulseLayer`) ein bzw. blendet sie aus (Fade-out per CSS, danach entfernt) und
    verschiebt Höhe/Datumszeile der Grafik mit; die Sys-/Dia-Linien und -Punkte bleiben dabei
    unangetastet und spielen ihre Einblend-Animation nicht erneut ab. `renderChart`/`buildDiagChart`
    laufen weiterhin komplett bei Wechsel von Reihe oder Zeitraum.
  - **Ampel pro Wert:** `catVal(v,y,r)` (Sys/Dia getrennt) neben der Gesamt-Ampel `category(e)`
    (schlechterer von beiden). Schwellenwerte `settings.thr` – editierbar unter Menü → Anzeige →
    „Zielbereich" (Ampel-Chips); „Design" dort für Hell/Dunkel/Auto + Akzentfarbe.
  - **Obsolet:** die Schalter **„Werte-Ampel" (`colorDots`)** und **„Schwellenwert-Linien"
    (`guideLines`)** sind aus der UI verschwunden (Verlauf färbt immer pro Wert, Diagramm nutzt immer
    Farbpunkte); die Schlüssel bleiben in `settings`/Backup (Rückwärtskompatibilität), `updateThrEnabled`
    entfiel. Toter Code aus dem Umbau wurde entfernt (u. a. `getSorted`, alte Tabellen-/Menü-CSS).
- **Arzt-Report (Druck/PDF)** (erledigt 2026-07-14, aus dem „Claude-Design"-Entwurf umgesetzt):
  ein aufbereiteter, **druckbarer** A4-Bericht für den Arztbesuch (`window.print`). **Reine
  Datenaufbereitung, keine Diagnose/Bewertung.** Erreichbar über **zwei Einstiege**: Icon im
  Diagramm-Kopf (`#rpOpenChart`) **und** Menü → Daten (`#mReport`), beide rufen `openReport()`.
  - **Report-Menü** (eigener Vollbild-Screen `#tab-report`, geöffnet per `navPush('report')`):
    Zeitraum-Pillen **30/90/Eigener** (+ Von–Bis-Datumsfelder), **Report-Farbe** (5 Swatches
    Kobalt/Indigo/Petrol/Violett/Graphit), Schalter **Namensfeld/Puls einbeziehen/Anhangseite**,
    **verkleinerte Live-Vorschau** der A4-Seite(n) und **Drucken**. Das Menü-Chrome folgt dem
    App-Theme; die A4-Seiten sind **immer hell** (Druck auf Weiß).
  - **A4-Seite 1 „Kompakt"** (`rpPage`): Kopf + Meta-Kachel (Zeitraum/Messungen, optional
    Namens-/Geburtsdatumsfeld), **Gesamt-Durchschnitt gesplittet** (Sys/Dia + Ampel-Chip · Puls),
    **Tageszeit** (morgens/tagsüber/abends, „—" wenn leer), **Ampel-Verteilung als Ring/Donut** +
    „% über Ziel" neben **Höchst/Tiefst**, **Verlaufs-Diagramm**, **Wertetabelle** (Sys = gefüllte
    Scheibe, Dia = hohler Ring), **Fußnote** (angewendete Grenzwerte + Tageszeit-Definition +
    Haftungshinweis). **Anhang „Seite 2" (Querformat, `rpLandscape`)** nur auf Wunsch: großes
    Detail-Diagramm mit **Wert + Datum je Messpunkt**.
  - **Technik:** `reportData(from,to)` bündelt alle Kennzahlen aus **vorhandener** Logik
    (`meanKey`/`category`/`catValFor`/`todOf`/`roundTo100`, Grenzwerte `settings.thr`); eigener
    Bereichsfilter, **nicht** das geteilte `filters`-Objekt. Feste helle Palette `RP` (Ausdruck
    theme-unabhängig hell); **eigene** Grafik `rpChart` (zeit-proportionale X-Achse, `detailed`-Modus
    für Seite 2) – das App-Diagramm `buildDiagChart` bleibt unberührt. Der Report-Zustand
    (`reportState`) ist **bewusst flüchtig**: bei jedem Öffnen auf Standard (Kobalt, 30 Tage,
    Puls+Namensfeld an, Anhang aus), **nichts** landet in `settings`/Backup. **Druck:** `@media print`
    zeigt nur den Container `#reportPrint` (naturgroße Seiten) über **benannte `@page`** (portrait +
    landscape für den Anhang), `print-color-adjust:exact`, `break-inside`-Schutz gegen unschöne
    Umbrüche. **Bewusst (noch) nicht:** ein **Teilen-Knopf** (build-frei nicht sauber; Weg =
    „Drucken → Als PDF speichern → teilen") und ein **zweiter Grenzwerte-Editor** im Report-Menü
    (der Report liest `settings.thr`; geändert wird unter Menü → Anzeige → „Zielbereich").
- **Code-Struktur:** `index.html` (~415 Z.), `styles.css` (~755 Z.) und `app.js` (~1815 Z.); eingebunden
  per `<link rel="stylesheet">` und `<script src="./app.js" defer></script>`. `sw.js` cacht alle Dateien
  offline (Cache **`blutdruck-pro-v1`**, `fetch` revalidiert per `cache:'no-cache'` gegen alte Zwischen-
  speicher), inkl. `fonts/hanken-grotesk.woff2`. Kein Build, kein Framework,
  keine Abhängigkeiten.
- **Speicher:** Messwerte **und Einstellungen** liegen in der Browser-Datenbank (IndexedDB), mit
  `localStorage` als Spiegel/Fallback und einmaliger automatischer Migration. Einstellungen liegen
  im `meta`-Store unter dem Schlüssel `'settings'` (`idbGetMeta`/`idbSetMeta`); nach dem Laden aus
  IndexedDB wird der `localStorage`-Spiegel sofort wieder aufgefüllt (kein Theme-Aufblitzen beim
  nächsten Start). Speichern ist zweigeteilt: `persistSettings()` (nur ablegen) vs. `saveSettings()`
  (ablegen **+** Auto-Backup-Datei planen) – interne Buchhaltung (`markDirty`/`markBackedUp`/Snooze)
  nutzt bewusst `persistSettings()`, sonst entstünde beim automatischen Schreiben eine
  Endlosschleife. Beim Start wird dauerhafter Speicher angefordert
  (`navigator.storage.persist()`), Schutz gegen automatisches Löschen (Eviction/ITP).
- **Backup** (Menü-Abschnitt; zwei Gruppen als abgesetzte Karten `.grp-card`, darunter „Backup teilen"):
  - **Automatisches Backup** (immer dieselbe Datei via File System Access API; nur Chromium, sonst
    ausgegraut). Zustandstext **grün** „Verknüpft: ‹Dateiname›" bzw. **rot** „Keine Datei verknüpft"
    (nur der Dateiname – Browser geben aus Sicherheitsgründen keinen vollständigen Pfad her und
    können Datei/Ordner nicht im Datei-Manager öffnen). Zwei Knöpfe **nebeneinander, einzeilig**
    (links Status setzen, rechts bestehende Datei): nicht verknüpft → **„Neu anlegen"** (Speichern-
    Dialog `showSaveFilePicker`, legt an + verknüpft sofort) / **„Auswählen"**; verknüpft →
    **„Lösen"** / **„Ändern"**. „Auswählen"/„Ändern" nutzen den **Öffnen-Dialog** (`showOpenFilePicker`,
    keine „Ersetzen?"-Frage, keine „(1)"-Dubletten) und **führen** den Datei-Inhalt mit den App-Daten
    **zusammen** (datensicher – eine reichere Datei verliert nichts; Nebeneffekt: ohne Lösch-
    Protokoll könnte ein gelöschter, in der Datei noch vorhandener Eintrag zurückkommen), bevor
    verknüpft und zurückgeschrieben wird. Danach schreibt jede Änderung automatisch in die Datei
    (`scheduleAutoBackup`/`autoBackupIfLinked`). „Jetzt sichern" entfällt (durch die Automatik
    überflüssig).
  - **Manuelles Backup:** zwei Knöpfe nebeneinander **„Speichern"** (Download) / **„Wiederherstellen"**
    (Datei laden – .txt oder ältere .json –, Statistik „X neu, Y aktualisiert"; Merge-Kern
    `mergeEntriesFromData`, geteilt mit „Auswählen") plus **„Erinnerung"** (erinnert nach X Tagen
    ungesicherter Änderungen ans Backup).
  - **„Backup teilen"** (Web Share API; klappt das Teilen nicht, fragt ein Dialog, ob stattdessen
    heruntergeladen wird) als breiter Knopf **unter** beiden Karten – übergreifend für beide Methoden.
  - **Backup-Format (v2):** Die Datei enthält jetzt `{app, version, exportedAt, entries, settings}`
    statt nur eines reinen `entries`-Arrays (`backupData()`/`backupSettings()`). Gesichert werden nur
    die **Vorlieben** (`colorDots`, `guideLines`, `theme`, `accent`, `reminderDays`, `thr`) – geräte-interne
    Erinnerungs-Merker (`firstDirtyAt`, `snoozeUntil`) nicht. Ältere Backups (reines Array) bleiben
    les- und wiederherstellbar; `mergeEntriesFromData` erkennt beide Formen.
  - **Einstellungen-Rückfrage beim Wiederherstellen** (`#restoreDlg`, eigenes Fenster statt
    Browser-`confirm`, da Knopf-Texte sonst nicht anpassbar sind): Enthält ein eingelesenes Backup
    auch Einstellungen, erscheint „Werte und Einstellungen übernehmen" (primärer Knopf) /
    „Nur die Werte übernehmen" (Text-Knopf); Raustippen/Esc = nur Werte (sichere Vorgabe). Ausgelöst
    von `offerSettingsRestore()`, geteilt von „Wiederherstellen" (`importJSON`) und
    „Auswählen"/„Ändern" (`pickBackupFile`). Messwerte werden in jedem Fall zusammengeführt.
- **Menü:** als **klappbare Abschnitte** in fester Reihenfolge **Backup · Daten · Anzeige** plus
  „Anleitung". Geöffnet über das **„Menü"-Icon in der Tab-Bar** (Dashboard · Verlauf · [ + ] ·
  Diagramm · Menü). Im Abschnitt „Backup" stehen die zwei Gruppen (Automatisches/Manuelles Backup)
  als **abgesetzte Karten** (`.grp-card`, Überschrift `.grp-head`). Das Menü-Fenster ist schmaler als der
  Bildschirm, hat eine eigene Hintergrundfarbe (`--menu-bg`) und lässt ringsum Rand zum Raustippen.
  Beim Öffnen eines Abschnitts ist nur der **Inhalt scrollbar** – Kopf- und Fußleiste bleiben fest
  (offenes Fenster als senkrechter Flex-Container, `dialog[open]`), sodass „Menü schließen" nie
  abgeschnitten wird. **Keine Trennlinien** – der aufgeklappte Abschnitt hebt sich als **weiße Karte**
  mit Schatten ab (Karte `--surf`, das Abschnitts-Icon wird akzent-getönt); **immer nur ein Abschnitt
  offen** (einen anderen öffnen schließt den vorigen). Oben eine **Griffleiste** (`.dlg-grab`); das
  Fenster sitzt **unten am Bildschirmrand** (daumenfreundlich) und schließt nur bei echtem Tippen auf
  die Backdrop-Fläche (`e.target===dialog`). Aus der Anleitung führt ein „‹ Zurück"-Button wieder ins
  Menü; Schließen-Buttons heißen „Menü schließen".
- **Zoom-Schutz (Mobil):** Eingabefelder haben mind. 16 px Schrift (sonst zoomt der Browser beim
  Antippen hinein) und `*{touch-action:manipulation}` in `styles.css` verhindert den Doppeltipp-Zoom
  (v. a. iOS/Safari, z. B. 2× dieselbe Ziffer im Ziffernblock). Zwei-Finger-Zoom bleibt bewusst
  erlaubt (Barrierefreiheit); spezifischere Regeln (z. B. `pan-y` am Toast) gehen vor.
- **Nicht unterstützte Funktionen** werden nicht versteckt, sondern **ausgegraut** mit kurzer
  Begründung (z. B. „Auf diesem Gerät nicht verfügbar").
- **Daten** (Abschnitt, vormals „Verwalten"): „Als CSV exportieren (Excel)" (für die Auswertung),
  „Alle Daten löschen" (mit Sicherheitsabfrage; die externe Backup-
  Datei bleibt dabei erhalten) und – darunter – eine Info-Zeile mit der **Speicherbelegung**
  (belegt von Kapazität · Prozent, sofern der Browser eine Quota liefert).
  Der frühere Persistenz-Status/„Aktivieren"-Link entfiel (dauerhafter Speicher wird beim Start
  automatisch angefordert).
- **Anleitung:** umgangssprachliches Hilfe-Pop-up (`helpDlg`), an die neue Bedienung angepasst
  (geführte Eingabe, Dashboard, Verlauf/Detail, neues Diagramm, Automatisches/Manuelles Backup,
  Aussehen/Akzentfarbe, App-Installation).
- **Fehler:** Wenn der Speicher voll ist (QuotaExceededError), erscheint ein Hinweis statt
  stillem Fehlschlag.
- **Meldungen (Toasts):** kurze Rückmeldungen unten als farbige Karte mit Icon in drei Kategorien –
  **Erfolg** (grün, Haken), **Hinweis** (gelb/amber, Dreieck) und **Fehler** (rot, Dreieck).
  4 s sichtbar, per **Wischen** zur Seite schließbar; helle Flächen → in Hell und Dunkel lesbar.
  Funktion `toast(msg, kind)` mit `kind ∈ success | notice | error` (Default `success`). Bei offenem
  Fenster (Dialog) wird der Toast **in das Fenster gerendert**, damit er über dem Menü sichtbar **und**
  wischbar bleibt (ein modales Fenster macht alles außerhalb „unberührbar"/inert); beim Schließen des
  Fensters wandert eine noch sichtbare Meldung zurück in den Body.
- **Bestätigen-Dialoge (`askConfirm`):** Die drei früheren Browser-`confirm()`-Popups sind durch
  **einen** eigenen, gestaltbaren Dialog (`#confirmDlg`) ersetzt – einheitlicher Look in Hell/Dunkel,
  mit Symbol-Kreis im Kopf. Zentrale Funktion `askConfirm(opts)` (Promise → `true`/`false`). Optionen:
  `icon` (`trash`/`info`) + `tone` (`danger` = rot / `notice` = amber), `title`, `message` **oder**
  `messageHTML` (für Fettdruck, nur App-eigene Texte), `confirmLabel`/`cancelLabel`, `danger` (roter
  Füll-Knopf `.btn-fill-danger` statt blauem `.btn-fill`), `previewHTML` (zentrierte Vorschau-Karte),
  `detailsText` (ausklappbares `<details>` „Technische Details"), `noteText` (Hinweiszeile mit
  Info-Symbol) und `requireCheck` (Pflicht-Häkchen – hält den Bestätigen-Knopf deaktiviert, bis
  angekreuzt; eigenes Kästchen: rot umrandet, gerundet, ohne Füllung). Der Meldungstext ist bewusst
  **gedämpft** (`--muted`), hervorgehobene Teile via `<b>` in `--text`. Drei Aufrufstellen:
  **Eintrag löschen** (`#detDelete` im Detail-Screen) mit Eintrags-Vorschau (Datum + Werte in
  Ampelfarbe) und rotem „Löschen"; **Teilen-Fallback** in `shareBackup()` (amber, blaues „Speichern", Diagnose-Info in
  „Technische Details" verstaut); **Alle Daten löschen** (`clearAllData()`) mit fetter Anzahl,
  Info-Zeile zur erhaltenen Backup-Datei und Bestätigungs-Häkchen. Aufräumen des Zusatz-Blocks
  (`#confirmExtra`) passiert beim **Aufbau**, nicht im `close`-Handler (sonst könnte ein verzögertes
  Schließen-Ereignis frischen Inhalt leeren). `#confirmDlg` steht im HTML **nach** `menuDlg`/`helpDlg`/
  `restoreDlg` (Toast-im-Dialog-Mechanismus). Die bestehenden Erfolgs-Toasts nach der Aktion bleiben erhalten.

## Namens-Konvention (Backup vs. CSV)
„Backup …" = vollständige Sicherung/Wiederherstellung (Dateiendung **.txt**, Inhalt JSON, originalgetreu;
.txt wegen Android-Teilen-Kompatibilität – Wiederherstellen akzeptiert .txt **und** ältere .json).
„… CSV …" = für Excel/Auswertung (einseitig, nicht originalgetreu).

## Geparkte Aufgaben

Stand 2026-07-11: Der UI/UX-Block ist umgesetzt (siehe „Aktueller Stand"); der Rest gegen die
Codebase geprüft.
Nachtrag 2026-07-12: Fünf weitere Aufgaben geparkt (Medikamenten-Erinnerung + Einnahme-Tracking,
Anleitungs-Textkorrektur, Puls-Linien-Animation, Akzentfarben pro Modus) – siehe unten in „2. Weitere
Features", markiert mit *(neu geparkt 2026-07-12)*.
Nachtrag 2026-07-13: Puls-Linien-Animation und Akzentfarben pro Modus umgesetzt (siehe „Aktueller
Stand") und unten entfernt; die übrigen drei aus dem 2026-07-12-Batch (Medikamenten-Erinnerung,
Einnahme-Tracking, Anleitungs-Textkorrektur) bleiben geparkt.
Nachtrag 2026-07-14: Arzt-Report (Druck/PDF) umgesetzt (siehe „Aktueller Stand") und aus „2. Weitere
Features" entfernt.
*Legende — Aufwand: klein / mittel / groß · Machbarkeit: problemlos / mit Hürde / heikel.*

### 1. UI/UX-Modernisierung — **erledigt (Stufen 1–6, 2026-07-11)**
Komplett umgesetzt (Details unter „Aktueller Stand"): Design-Tokens/Dark Mode/Akzentfarben, neue
Tab-Bar + Dashboard, geführte Erfassen-Eingabe, Verlauf-Liste + Detail-Screen, entschlacktes Diagramm
(Variante A), Menü als Bottom-Sheet mit „Anzeige" (Zielbereich + Design). Verlauf und Diagramm teilen
sich jetzt **denselben Zeitraum** (`applyVerlaufRange` + `filters.from/to`).

**Offen geblieben (bewusst zurückgestellt):**
- **Detail-Filter + Sortierung wieder einbauen** — mittel · mit Hürde. Der Verlauf hat heute nur den
  **Zeitraum**-Filter (7/30/90 + Von–Bis), wie im Entwurf. Die frühere Tabelle konnte zusätzlich nach
  **Wertebereichen** (Sys/Dia/Puls min–max) und **Notiz-Text** filtern und nach Spalten **sortieren**.
  Die geteilte Filter-Basis existiert noch (`filters` mit `sysMin/…/note`, `getFiltered`) – es fehlt nur
  die Bedienoberfläche. Bei Wiedereinführung an **beide** Ansichten (Verlauf + Diagramm) denken (ein
  geteiltes Panel bzw. Klassen statt fester `#f_*`-IDs); die im Abschluss entfernte `getSorted`-Funktion
  müsste dann neu angelegt werden.

### 2. Weitere Features
- **Arzt-Report (Druck/PDF)** — **erledigt 2026-07-14** (siehe „Aktueller Stand"). Aufbereiteter,
  druckbarer A4-Bericht (Kompakt-Layout + Querformat-Anhang) via `window.print` + `@media print`.
- **Auto-Wiederherstellung** — mittel · mit Hürde. Beim Start, wenn App leer **und** Datei verknüpft
  (`idbGetMeta('backupHandle')`): Berechtigung prüfen → bei `granted` lesen + `mergeEntriesFromData`.
  *Hürde:* Datei-Berechtigung erlischt oft nach Browser-Neustart und braucht eine Nutzer-Geste →
  Fallback-Knopf nötig.
  *Voraussetzung – Lösch-Protokoll (Tombstones):* Schon heute kann der Merge gelöschte Einträge
  zurückbringen; beim automatischen Start-Merge wäre das besonders störend. Daher gelöschte IDs
  protokollieren, damit sie beim Zusammenführen nicht wieder auftauchen.
- **Vollständige App-Dokumentation** — mittel · problemlos. Quelle ist die **gesamte Codebase**
  ([index.html](index.html), [styles.css](styles.css), [app.js](app.js), `sw.js`,
  `manifest.webmanifest`). Zwei Teile:
  - *Anwender-Teil:* alle Funktionen aus Nutzersicht + Tipps/Best Practices.
  - *Technischer Teil:* nur die **wichtigsten, miteinander verknüpften** Funktionen, sodass
    Abhängigkeiten und Prozessflows erkennbar werden (z. B. `saveEntries → idbWriteAll →
    scheduleAutoBackup → autoBackupIfLinked → writeToHandle`; geteilter Merge-Kern
    `mergeEntriesFromData`; Start-Sequenz `init → requestPersistence → initStorage`).
  - *Visualisierung:* Flows als **Grafiken** (build-frei, z. B. Mermaid in Markdown; Alternative SVG).
  Danach kann diese CLAUDE.md auf reinen Projektkontext verschlankt werden.
- **Medikamenten-Erinnerung (Einnahme)** *(neu geparkt 2026-07-12)* — groß · heikel. Zu einer festen
  Uhrzeit eine **echte Handy-Benachrichtigung** auslösen (mit **Ton** und Eintrag im
  Benachrichtigungs-Menü / „Pull-down"), auch wenn die App gerade **nicht offen** ist.
  *Kernhürde:* Eine reine PWA **ohne Server** kann eine zeitgesteuerte Benachrichtigung im **Hintergrund**
  **nicht zuverlässig** garantieren. Bausteine/Wege (Verfügbarkeit **vor** der Umsetzung prüfen):
  - **Benachrichtigungs-Erlaubnis** (`Notification.requestPermission`) + Service Worker
    (`registration.showNotification`) – Grundlage für jede Variante.
  - **Zeit-Auslöser lokal:** eine geplante Benachrichtigung ohne Server (Notification-Trigger,
    `TimestampTrigger`) wäre ideal, ist aber experimentell und **nicht überall** verfügbar (v. a.
    iOS/Safari stark eingeschränkt) → unsicher.
  - **Web Push** (mit Server + VAPID-Schlüssel) wäre zuverlässiger, **widerspricht** aber dem Grundsatz
    „kein Server / kein Build".
  - Solange die App **offen** ist, geht eine Erinnerung per Timer (`setTimeout`) problemlos – nur eben
    nicht im Hintergrund. Für eine „wecker-echte" Erinnerung bräuchte es evtl. eine **native Hülle**
    (TWA/Capacitor) → großer Schritt weg von der reinen PWA.
  - **Vorgehen:** zuerst **Machbarkeit klären**, dann Umfang festlegen (ggf. Android/Chromium zuerst,
    iOS später bzw. eingeschränkt), inkl. Bedienoberfläche für Uhrzeit(en)/Dosis.
- **Einnahme-Tracking** *(neu geparkt 2026-07-12 – Erweiterung der Medikamenten-Erinnerung)* — mittel ·
  problemlos (für sich allein). Festhalten, **ob die Medikamente heute schon genommen** wurden
  (Status „genommen/offen", Abhaken, kleiner Verlauf). Reine Daten + Bedienoberfläche und passt zum
  bestehenden Muster (eigener Bereich in der Browser-Datenbank (IndexedDB), ins Backup aufnehmen). Hängt
  inhaltlich an der Erinnerung, ist aber **technisch unabhängig** umsetzbar (auch ohne Hintergrund-
  Benachrichtigung nutzbar).
- **Anleitungs-Text: Backup-Sicherheit richtigstellen** *(neu geparkt 2026-07-12)* — klein · problemlos.
  Der Hilfe-Text (`helpDlg` in [index.html](index.html)) suggeriert, dass Automatisches/Manuelles Backup
  vor **Geräteverlust** schützt. Das stimmt nicht: Die Backup-Datei liegt weiterhin **nur auf dem Handy**.
  Erst **„Backup teilen"** und Ablage an einem **dritten Ort** (NAS, Google Drive o. Ä.) ist wirklich
  verlustsicher. Text entsprechend **korrigieren/ergänzen** (evtl. zusätzlich ein kurzer Hinweis direkt in
  der Backup-Sektion des Menüs).

### 3. Zurückgestellt (niedrige Priorität)
- **Umbau Stufe 2 – JS in Module** (`storage.js`/`backup.js`/`chart.js`/`ui.js`, eingebunden per
  `<script type="module">`) — mittel · problemlos (kein Logikwechsel, aber Sorgfalt wegen vieler
  gegenseitiger Abhängigkeiten, allen voran Backup/Auto-Backup und Einstellungen/Theme, die quer
  durch mehrere künftige Module greifen würden). War bisher an Profile gekoppelt, damit Speicher/
  Backup nicht zweimal umgebaut werden – dieser Grund entfällt, da Profile gestrichen ist. Bleibt
  für sich genommen sinnvoll: `app.js` ist mit ~1360 Zeilen (nach der UI-Modernisierung deutlich
  gewachsen) nicht mehr ganz so überschaubar und würde mit jeder
  weiteren Funktion unübersichtlicher, und eine Aufteilung nach Zuständigkeit passt zum bisherigen
  Vorgehen (siehe Stufe 1). Keine neue technische Hürde durch `type="module"`: Die App verlangt als
  PWA ohnehin einen http(s)/localhost-Kontext (wegen des Service Workers), das sonst übliche
  `file://`-CORS-Problem von ES-Modulen entsteht also nicht zusätzlich; `sw.js` müsste nur um die
  neuen Modul-Dateien ergänzt werden. Ohne Team aber ohne Zeitdruck – zurückstellen, bis entweder
  `app.js` spürbar unhandlich wird oder ohnehin größere Eingriffe an Speicher/Backup anstehen.
  (Stufe 1 – CSS & JS auslagern – ist erledigt, siehe „Aktueller Stand".)

### 4. Gestrichen (geprüft 2026-06-30)
- **CSV-Import** — redundant zu „Backup → Wiederherstellen"; CSV hat keine `id` → Dubletten,
  fehleranfälliges Datums-Parsen. (CSV-**Export** bleibt, ist fertig.)
- **Personalisierung (Alter/Fitness → Zielwerte)** — manueller Schwellenwert-Editor (`settings.thr`)
  deckt den Bedarf ab; automatische Ableitung medizinisch heikel.
- **Backup-teilen-Logik prüfen** — erledigt: „teilen", „speichern" und Auto-Backup bauen ihre Datei
  **immer frisch aus `entries`** (`backupBlob`); keine Mehrdeutigkeit zwischen mehreren Dateien.
- **Profile** (mehrere Personen, eigene Backup-Datei je Profil) — Grundsatzentscheidung getroffen
  (2026-07-01): wird nicht umgesetzt. War nie über die Doku hinaus begonnen, kein Code betroffen.
  „Umbau Stufe 2" war an dieses Vorhaben gekoppelt und ist oben entsprechend angepasst.