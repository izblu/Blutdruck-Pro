# Dashboard – Datenspezifikation

Stand: 2026-07-02, neu gefasst 2026-11-07 (Dashboard „Letzte Messung + 7 Tage“ mit Temperatur und Sauerstoff), ergänzt 2026-11-08 ums Gewicht und um abwählbare Messwerte. Diese Datei beschreibt **was** das Dashboard rechnet und anzeigt –
nicht wie es aussieht.

- **Fix (Logik/Daten):** Kennzahlen, Berechnung, Zeitfenster, Ampel-Regeln, Leerzustände.
  Das ist hier festgelegt, damit kein Entwurf an den Datenregeln vorbeigeht.
- **Offen (Aussehen → Claude Design):** Anordnung/Hierarchie, Farben, Schrift, Kachel- und
  Diagramm-Gestaltung, Tabellen-Darstellung, genaue Text-Formulierungen.

---

## 0. Grundlagen (gelten für alle Kennzahlen)

- **Datengrundlage:** jede Messung hat Zeitpunkt (`ts`), `sys`, `dia`, `pulse`.
  Das Datenmodell bleibt **unverändert** – keine Neu-Erfassung, keine Migration.
- **Zeitfenster sind rollierend ab jetzt:**
  „letzte 7 Tage" = Messungen der letzten 168 Stunden, „letzte 30 Tage" = letzten 720 Stunden.
- **Durchschnitt** = einfacher Mittelwert über **alle Messungen** im Fenster
  (nicht pro Tag gewichtet). *Option für später: pro Tag mitteln, dann die Tage – fairer, wenn
  an manchen Tagen viel öfter gemessen wird. Für den Start bewusst einfach gehalten.*
- **Rundung:** alle angezeigten Zahlen gerundet – Blutdruck/Puls auf ganze Zahlen,
  Prozente auf ganze Prozent.

---

## 1. Kennzahlen

Seit 2026-11-08 zeigt das Dashboard alle fünf Werte (Blutdruck, Puls, Temperatur, Sauerstoff, Gewicht) in zwei klar getrennten
Bereichen: oben „Letzte Messung", darunter „Letzte 7 Tage". Überschrift „Dashboard", darunter Wochentag und Datum.

### 1.1 Letzte Messung (eigene Karten)
- **Zweck:** „Wie stehe ich gerade?"
- **Karten:** Blutdruck + Puls (eine Karte, eine Messung) · Temperatur · Sauerstoff (nebeneinander) · darunter Gewicht
  (eine Karte über die ganze Breite, drei nebeneinander wären auf dem Handy zu eng für die großen Zahlen).
- **Anordnung nach eingeschalteten Werten** (Menü → Messwerte, Reihenfolge immer Temperatur, Sauerstoff, Gewicht):
  - Alle drei an: wie oben.
  - Zwei an, in jeder Paarung: beide nebeneinander (`.dlm-row`), Gewicht dann als normale schmale Karte, oben ausgerichtet, damit die
    Zahlen auf gleicher Höhe stehen (unter der Zahl bleibt frei, weil Gewicht kein Ampel-Wort hat).
  - Nur Temperatur oder nur Sauerstoff: breite Karte, Name und Zeit links, rechts die Zahl, darunter rechtsbündig das Ampel-Wort (`.dlm-side`).
  - Nur Gewicht: breit wie oben. Keiner: nur Blutdruck und Puls.
- **Inhalt:** Zahl mit Einheit in Ampelfarbe, Ampel-Punkt und **Ampel-Wort** (Blutdruck: `category()`, Temperatur und
  Sauerstoff: `catMetric`). Puls in Puls-Farbe ohne Ampel, Gewicht in normaler Schriftfarbe ohne Ampel. Zeitpunkt **relativ** („vor 2 Std.", `relTime`).
- **Antippen:** öffnet das Detail dieser Messung.
- **Leerzustand:** Gibt es von einem Wert noch nichts, steht in seiner Karte „Noch kein Wert". Die Begrüßung „Noch keine Messung
  erfasst." erscheint auch, wenn es nur ausgeblendete Werte und keinen Blutdruck gibt.

### 1.2 Ø Blutdruck (7 Tage) mit Ø Puls
- **Berechnung:** Mittelwert von `sys`, `dia` und `pulse` im 7-Tage-Fenster (168 h, rollierend, fest).
- **Erst ab 3 Messungen.** Bei 1–2: „Zu wenige Messungen · Ø erst ab 3 Messungen". Bei 0: „Keine Messung in den
  letzten 7 Tagen".
- **Ampelfarbe + Wort** über `category()` auf dem gerundeten Ø. Puls ohne Ampel.
- **Kein Trend** zur Vorwoche mehr (entfällt).

### 1.3 Ø Temperatur und Ø Sauerstoff (7 Tage)
- Wie 1.2, je eigene Karte. Temperatur auf eine Nachkommastelle, Sauerstoff ganzzahlig, Ampel über `catMetric`.

### 1.4 Ø Gewicht (7 Tage)
- Wie 1.3, eigene Karte, auf eine Nachkommastelle, **ohne Ampel** (keine Farbe, kein Wort, kein Punkt). Erst ab 3 Messungen.
- **Kein Trend**, kein Zielgewicht, kein BMI.

In „Letzte 7 Tage" fallen die Karten ausgeschalteter Werte weg.

### 1.5 Entfallen
- **Ampel-Verteilung 30 Tage** (Ring, Prozente, Anzahl) samt Ring-Animation entfällt ersatzlos. Den Überblick
  „im Ziel?" gibt die Ampelfarbe des Ø.
- Ebenso entfallen: Trend zur Vorwoche, „x von y im Ziel", Punktreihe.
- **Antippen** einer 7-Tage-Karte öffnet das Diagramm mit diesem Wert und dem Zeitraum 7 Tage.

---

## 2. Ampel-Logik (geteilt mit Diagramm & Tabelle)

- **Gesamt-Ampel** (`category()`, bleibt wie heute):
  rot, wenn `sys ≥ sysR` **oder** `dia ≥ diaR`; sonst gelb, wenn `sys ≥ sysY` **oder**
  `dia ≥ diaY`; sonst grün. Kurz: „der schlechtere von beiden".
- **Ampel pro Einzelwert** (neu, kleine Ergänzung): eine Funktion `catVal(wert, gelb, rot)`
  → grün/gelb/rot. Sys mit `sysY/sysR`, Dia mit `diaY/diaR`. **Puls und Gewicht: keine** (keine Schwellen).
- **Konsistenz:** die Gesamt-Ampel ist der schlechtere der beiden Einzel-Ampeln – beide Sichten
  passen zusammen.
- **Schwellen** bleiben bei **zwei je Wert** (grün/gelb/rot), weiter editierbar (`settings.thr`).

---

## 3. Konsequenz fürs Diagramm (Variante A – farbige Punkte)

- Sys- und Dia-Punkt je in ihrer **eigenen** Ampelfarbe (über `catVal`) → dürfen sich
  unterscheiden (z. B. Sys rot, Dia grün).
- **Keine** gestrichelten Schwellen-Linien mehr im Diagramm (ersetzt durch die Punktfarbe).
- Puls als **schmales eigenes Feld** (andere Einheit), ohne Ampel.
- Tabellen-Darstellung der Einzel-Ampeln: **offen, mit Claude Design** (zwei Punkte? gefärbte
  Zahlen? Punkt + Gesamt-Ampel daneben?). Logik liefere ich, Aussehen macht ihr.

---

## 4. Bewusst (noch) nicht im Dashboard

- **Morgens/abends getrennt** – später möglich (die Uhrzeit steckt in `ts`), aktuell nicht nötig.
- ~~Zielwert-Abgleich (Schnitt gegen `settings.thr`)~~ – umgesetzt 2026-11-07: der Ø trägt die Ampelfarbe.
- **Keine Bewertung/Diagnose** – nur beschreiben, nicht einordnen.

---

## 5. Trennung Logik ↔ Design (Zusammenfassung)

| Fix (bei mir / im Code) | Offen (mit Claude Design) |
|---|---|
| Welche Kennzahlen | Anordnung, Hierarchie, was groß/klein |
| Berechnung + Zeitfenster | Farben, Schrift, Kachel-Layout |
| Ampel-Regeln (gesamt + pro Wert) | Diagramm-Feinschliff, Tabellen-Darstellung |
| Leerzustände (Regeln) | genaue Text-Formulierungen |
