# Architettura di Piano Tutor

PWA per imparare il pianoforte da zero, pensata per tablet (10", orizzontale). Nessun backend: tutto gira nel browser e i progressi restano su IndexedDB.

## Stack

| Area | Scelta | Note |
|---|---|---|
| Build / UI | Vite + React 19 + TypeScript strict | |
| Stato UI | Zustand | lo stato in tempo reale (trasporto, cursore) vive fuori da React |
| Routing | React Router, **HashRouter** | funziona in sottocartella su qualsiasi hosting statico, senza rewrite |
| PWA | vite-plugin-pwa (Workbox, generateSW) | precache di shell, campioni e contenuti |
| Storage | Dexie (IndexedDB) dietro interfacce `Repository` | sostituibile con un provider con sync |
| Contenuti | JSON validati con Zod | gli schemi Zod sono la fonte unica di verità |
| Spartito | VexFlow 5 (M2) | rigo unico orizzontale, scroll con `translateX` |
| Audio | sampler proprio su Web Audio | Salamander Grand Piano (CC-BY 3.0), 22 campioni |
| Pitch | pitchy (MPM) in AudioWorklet (M4) | accordi: verifica spettrale delle note attese |
| Test | Vitest (unit), Playwright (e2e, viewport tablet) | |

## Flusso dei dati

```
PianoKeyboard / MIDI / Microfono
        │ press/release (event.timeStamp)
        ▼
InputSource ──► NoteInputEvent {midi, velocity, time: AudioContext s − offset latenza}
        │
        ▼
inputHub ──► sampler (suono, tranne per il mic)
        └──► listener: PlaySession → core/evaluation → feedback + punteggio → storage
```

### Principi

1. **Un solo orologio.** `AudioContext.currentTime` è il riferimento per tutto: trasporto, metronomo, input, valutazione. I timestamp DOM vengono convertiti con `getOutputTimestamp()` (vedi `audioEngine.performanceToAudioTime`).
2. **Offset di latenza per sorgente.** Ogni `InputSource` sottrae il proprio `latencyOffsetMs`, impostato dalla calibrazione e salvato in `Settings.latency`.
3. **`src/core/` è TypeScript puro**, senza React né DOM. Contiene la teoria musicale, la valutazione e il timing ed è coperto dai test unitari.
4. **Input intercambiabili.** Il motore di valutazione riceve solo `NoteInputEvent` e non sa da quale sorgente arrivano.
5. **Contenuti come dati.** Corso, lezioni e brani sono file JSON in `content/`, validati durante la build.
6. **Storage astratto.** L'app dipende solo da `StorageProvider` (`src/storage/types.ts`). Ogni record ha un `id` stabile e un campo `updatedAt`, così una futura sync potrà usare il merge last-write-wins.

## Cartelle

```
content/          corso, lezioni, brani (JSON)
public/samples/   campioni di pianoforte
src/app/          App, router, store, hook
src/audio/        AudioEngine, Sampler, mappa campioni
src/core/         music/ (altezze, durate), content/ (schemi, loader), timing/ (timeline, transport), evaluation/ (M3)
src/input/        interfacce, virtual/, midi/ (M5), mic/ (M4)
src/notation/     renderer VexFlow, ScoreView (scroll + evidenziazioni)
src/storage/      interfacce + provider Dexie
src/features/     pagine: onboarding, home, practice, settings, diagnostics, about, …
src/ui/           componenti touch, tastiera a schermo
src/i18n/         testi dell'interfaccia
tools/            script Node (JSON Schema, convertitori MIDI e MusicXML)
e2e/              test Playwright
docs/             questa documentazione + docs/schema/*.json
```

## Spartito (M2)

- `buildTimeline(piece)` normalizza gli eventi (rigo, MIDI, legature), calcola battute e onset.
- `renderScore` disegna ogni battuta in un unico SVG orizzontale:
  - inserisce in automatico le pause nei vuoti e spezza in note legate le durate non rappresentabili con una sola figura;
  - applica le alterazioni secondo l'armatura e genera le travature delle crome.
  Restituisce:
  - `points`: mappa beat → x;
  - `noteEls`: elementi SVG di ogni evento.
- `ScoreView` disegna una sola volta. A ogni frame legge `getBeat()` e sposta il rigo con `translate3d`, in modo che il beat corrente stia sulla linea di esecuzione (a circa il 30% della larghezza).
  - Le note correnti ricevono la classe `is-current`. Il feedback (`is-correct`, `is-early`, `is-wrong`) arriva da `marks`.
  - Chiave e armatura restano in un'intestazione fissa a sinistra.
- La posizione visiva sottrae la latenza di uscita audio, così si vede la nota nel momento in cui la si sente.
- `PlaybackScheduler` programma note e metronomo con 120 ms di anticipo sull'orologio audio (tick ogni 25 ms).

## Scelte con alternative

- **Spartito.** VexFlow e non OSMD o Verovio: ogni nota è un elemento SVG che si può indirizzare per colorarla. Il brano è disegnato su un rigo continuo e fatto scorrere a 60 fps senza re-render.
- **Pitch detection.** pitchy (McLeod) e non YIN fatto a mano, CREPE o Basic Pitch: è leggero, preciso sulle fondamentali del pianoforte e ha poca latenza. Per gli accordi si verifica l'energia spettrale delle note *attese*, non si trascrive.
- **Audio.** Un sampler proprio e non Tone.js: meno peso e controllo diretto dell'orologio.
- **Router.** HashRouter: l'app è pubblicata in sottocartella (`/pianotutor/`) su un hosting di cui non controlliamo le regole di rewrite.

## Limiti di piattaforma noti

- **Web MIDI** non esiste su Safari iOS e iPadOS: l'opzione viene disattivata con un messaggio.
- **Promemoria.** Senza backend non si possono programmare notifiche affidabili. Si usano: promemoria nell'app, Periodic Background Sync dove disponibile (Chrome Android con app installata), file `.ics` con una ricorrenza giornaliera da aggiungere al calendario.
- **Lighthouse.** Dalla versione 12 la categoria "PWA" non esiste più. L'obiettivo è Performance, Accessibilità e Best Practices ≥ 90, più la checklist di installabilità e offline (coperta anche da un test e2e).
- **Microfono e service worker** richiedono HTTPS.

## Milestone

| | Contenuto | Stato |
|---|---|---|
| M1 | Scheletro PWA, tastiera a schermo, audio | ✅ |
| M2 | Spartito VexFlow, scroll ed evidenziazione | ✅ |
| M3 | Motore di valutazione, prima lezione completa | |
| M4 | Microfono, pitch detection, calibrazione | |
| M5 | Web MIDI | |
| M6 | Unità 1-3, progressi, streak, statistiche | |
| M7 | Rifiniture, accessibilità, offline, convertitori, test, Lighthouse | |
| M8 | Unità 4-6: due mani, accordi, alterazioni e scale | |
