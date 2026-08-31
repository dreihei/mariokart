# Neon Apex Rally

Ein eigenständiger, lokal laufender 3D-Arcade-Kart-Racer. Alle Fahrzeuge, Namen, Gegenstände und die Strecke sind eigens für diesen Prototyp erstellt und verwenden keine geschützten Nintendo-Inhalte.

## Technologie

- TypeScript 5
- Vite 7
- Three.js
- prozedurale Low-Poly-Geometrie, keine externen 3D-Assets
- reine Browser-Anwendung ohne Serverlogik

## Installation und Start

Voraussetzung ist Node.js 20.19 oder neuer.

```bash
pnpm install
pnpm dev
```

Danach die von Vite angezeigte lokale Adresse öffnen, üblicherweise `http://localhost:5173`.

Produktions-Build und lokale Vorschau:

```bash
pnpm build
pnpm preview
```

Alternativ funktionieren in einer intakten npm-Installation dieselben Befehle mit `npm` statt `pnpm`.

## Steuerung

Vor dem Countdown erscheint ein Startmenü. Dort wird `Leicht`, `Mittel` oder `Schwer` gewählt und das Rennen mit **Rennen starten** freigegeben. Die Auswahl verändert Höchsttempo, Linienpräzision, Kurvenvorausschau, Überholverhalten, Drift und Item-Taktik der Bots.

| Aktion | Taste |
|---|---|
| Beschleunigen / Bremsen / Rückwärts | W/S oder Pfeil hoch/runter |
| Lenken | A/D oder Pfeil links/rechts |
| Drift und Drift-Boost | Leertaste halten, in eine Kurve lenken, loslassen |
| Item verwenden | E |
| Pause | P |
| Auf letzten sicheren Punkt zurücksetzen | R |
| Debug-Ansicht | F3 |

## Architektur

- `src/main.ts`: Spielzustand, Eingabe, Kamera, Countdown, Rangfolge, Bot-KI, HUD und automatische Validierung
- `src/track.ts`: geschlossene Spline-Strecke, breite Fahrbahnbänder, Tunnel, Weltaufbau und Debug-Geometrie
- `src/racer.ts`: Kart-Modell, Arcade-Fahrphysik, Drift, Kollision mit Begrenzungen, Fortschritt und Respawn
- `src/items.ts`: Item-Boxen, Nitro, Pulsprojektil, Blocker und Schild
- `src/types.ts`: gemeinsam genutzte Typen
- `src/style.css`: HUD und Menüs

## Spiel- und Testanleitung

1. `pnpm dev` starten und die lokale URL öffnen.
2. Im Startmenü eine Bot-Schwierigkeit wählen und **Rennen starten** drücken.
3. Prüfen, dass `3`, `2`, `1` und `GO!` erscheinen und danach vollständig verschwinden.
4. Kontrollieren, dass Position und Runde nur nach vollständiger Checkpoint-Folge und Überfahrt der Ziellinie steigen.
5. Item-Boxen durchfahren und alle vier Itemtypen mit E testen.
6. In einer Kurve Leertaste halten und beim Loslassen den Drift-Boost prüfen.
7. Die Strecke absichtlich verlassen und automatischen beziehungsweise manuellen Reset prüfen.
8. P drücken und sicherstellen, dass die Simulation stoppt.
9. F3 drücken: Rennlinie, Bot-Ziele, Fahrkorridor, Checkpoints, Rücksetzpunkte und Bot-Zustände werden sichtbar.
10. Im Browser-Log muss `Streckenvalidierung OK` erscheinen.
11. Nach Runde drei Ergebnisliste und Neustart prüfen.

## Streckenmerkmale

Der Skyline Circuit kombiniert zwei lange Vollgasgeraden, schnelle Bögen, weichere Kurvenradien und eine Haarnadel mit starken Höhenwechseln. Die Strecke enthält Tunnel, Sprungzone, Leitplanken, Startbogen, Tribünen und Fahrerlager. Die zusammenhängende Neon-Hafenstadt nutzt Kaianlagen, Wasser, Containerstapel, Lagerhallen, Hafenkräne, beleuchtete Stadttürme und Waldzonen als Orientierungspunkte. Große Weltobjekte besitzen Kollision; jede Dekoration wird vor dem Platzieren gegen Fahrbahn- und Höhenabstand geprüft.

## Bekannte Einschränkungen

- Die Physik ist bewusst leichtgewichtig und Arcade-orientiert; sie verwendet keine externe Rigid-Body-Engine.
- Bots vermeiden andere Fahrzeuge reaktiv über die Kart-Kollision, planen aber keine langfristigen Überholmanöver.
- Audio ist nicht enthalten, damit der Prototyp vollständig assetfrei bleibt.
- Die Ergebnisliste zeigt noch fahrende Bots als solche an, wenn der Spieler sehr früh ins Ziel kommt.
