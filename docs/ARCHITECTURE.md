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
| Spartito | VexFlow 5 (`vexflow/core`) + font woff2 separati | rigo unico orizzontale, scroll con `translateX` |
| Audio | sampler proprio su Web Audio | Salamander Grand Piano (CC-BY 3.0), 22 campioni |
| Pitch | pitchy (MPM): AudioWorklet per la cattura, analisi nel thread principale | accordi: verifica spettrale delle note attese |
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
src/core/         music/ (altezze, durate), content/ (schemi, loader), timing/ (timeline, transport), evaluation/ (valutatori wait/realtime, punteggio)
src/input/        interfacce, virtual/, mic/ (tracker, verifica accordi, MicInput), midi/ (parser, MidiInput)
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

## Valutazione (M3)

Il codice in `src/core/evaluation/` è TypeScript puro ed è coperto dai test unitari.

- **`WaitEvaluator`** (wait mode): il brano si ferma su ogni onset finché non vengono suonate tutte le sue note. Gli accordi si possono comporre anche una nota alla volta.
  - Una nota sbagliata conta come errore; quella giusta suonata dopo un errore vale `corrected` (giallo).
  - Precisione = note giuste / (note giuste + errori). Il timing non viene valutato.
- **`RealtimeEvaluator`** (a tempo): ogni nota suonata viene abbinata alla nota attesa con la stessa altezza più vicina entro ±`goodMs`.
  - Entro ±`perfectMs` è `perfect`; fuori da quel margine ma entro la finestra è `early` o `late`.
  - Le note fuori finestra contano come `wrong`. Quando la finestra di un onset si chiude (`advance`), quelle non suonate diventano `missed`.
  - Le finestre sono in **ms reali**, convertite con `msPerBeat`, quindi restano uguali anche rallentando il tempo.
  - Precisione = abbinate / (attese + 0,5 × sbagliate). Ritmo = media di `timingScore`: 1 entro `perfectMs`, poi giù fino a 0,5 a `goodMs`.
- **Punteggio** = media pesata di precisione e ritmo (`weights`). Le stelle si assegnano con le soglie `stars`. Tutto si può configurare per singolo step con `settings.scoring`.
- **`PlaySession`** collega trasporto, `PlaybackScheduler` (conteggio, metronomo, accompagnamento della mano non suonata) e input dall'`inputHub`.
  - Gestisce la pausa del wait mode e calcola i segni sullo spartito e sulla tastiera (suggerimenti, dita, lampeggi verde/giallo/rosso) e i messaggi incoraggianti.
  - Espone uno snapshot per React.
- **Lezione** (`features/lesson`): `ExplainStep` (slide con animazioni interattive) → `PlayStep` (introduzione, eventuale "ascolta prima", esecuzione, risultato) → schermata finale.
  - I progressi (stelle migliori per step, lezione completata) e i tentativi vengono salvati tramite lo `StorageProvider`.
  - Stelle della lezione = media arrotondata delle stelle degli step.

## Microfono (M4)

```
getUserMedia (senza echoCancellation/noiseSuppression/AGC)
  → AudioWorklet public/worklets/mic-capture.js (blocchi da 512 campioni + tempo audio)
  → MicInput: buffer circolare da 8192
      ├─ PitchTracker (2048 campioni ogni 512, ~43 ms di finestra) → note singole
      └─ verifica accordi (FFT 8192) sulle note attese → accordi
  → NoteInputEvent (tempo audio − latenza calibrata) → inputHub → PlaySession
```

- **`PitchTracker`** (TS puro, testato con segnali sintetici):
  - soglia di rumore calibrata + margine regolabile ("sensibilità");
  - pitchy (MPM) con soglia di chiarezza 0,88, per ignorare voce e rumori non intonati;
  - la nota va confermata in 2 frame consecutivi;
  - le note ripercosse si riconoscono dal salto di energia di ≥ 6 dB rispetto a una finestra prima, con periodo refrattario di ~85 ms;
  - isteresi d'ottava durante il decadimento; il tempo della nota viene retrodatato all'inizio della finestra in cui compare.
- **Accordi:** non si trascrivono note multiple "alla cieca". Si verifica che le note **attese** (passate da `PlaySession` con `setExpectedNotes`) abbiano energia sulla fondamentale (o sulla 2ª armonica) chiaramente sopra il fondo locale e più forte dei semitoni vicini.
- **Eco dell'app:** le note che l'app stessa suona (tastiera a schermo, "ascolta") vengono ignorate per 0,6 s, e col microfono la `PlaySession` non suona l'accompagnamento.
- **Privacy:** il microfono resta acceso solo nelle schermate che lo usano (`useActiveInput`, conteggio dei riferimenti) e si spegne 2 s dopo l'uscita.
- **Calibrazione** (`/microfono`):
  1. rumore di fondo (90° percentile di 3 s di silenzio);
  2. diapason dal Do suonato (mediana dei cent, limite ±50);
  3. latenza "ad anello": l'app suona 4 Do5 e li ascolta; misura − latenza di uscita = ingresso + rilevamento.
  Ogni passo si può saltare. In Diagnostica si può regolare la latenza a mano per ogni modalità.
- **Test e2e:** Chromium con microfono finto (`--use-file-for-fake-audio-capture`) che riproduce `e2e/fixtures/do-re-mi.wav`, generato con `npx tsx tools/gen-mic-fixture.ts`.

## Tastiera MIDI (M5)

- **`parseMidi`** (puro): note on/off su qualsiasi canale (note on con velocity 0 vale note off), CC64 pedale, CC120/123 tutte le note spente. Clock, active sensing e pitch bend vengono ignorati.
- **`MidiInput`**: `requestMIDIAccess({ sysex: false })`.
  - Ascolta tutti i dispositivi collegati, o solo quello scelto.
  - Su `statechange` ricollega gli input: collegamento e scollegamento a caldo senza ricaricare la pagina. Se l'ultima tastiera viene scollegata, le note tenute vengono rilasciate.
  - Timestamp: `event.timeStamp` (clock performance), convertito nel tempo audio con `getOutputTimestamp()`, meno la latenza MIDI calibrata.
  - Le dipendenze (accesso, orologio, pedale) sono iniettate, quindi la classe si testa con una Web MIDI finta.
- **Suono:** di default l'app **non** suona le note MIDI, perché le tastiere con altoparlanti suonano da sole e il doppio suono sarebbe sfasato. Se la tastiera non ha altoparlanti, si attiva "Suona dal tablet"; con quell'opzione attiva l'app gestisce anche il pedale.
- Le note tenute sulla tastiera fisica (e quelle sentite dal microfono) appaiono premute anche sulla tastiera a schermo.
- Se il browser non ha la Web MIDI (Safari su iPad e iPhone), l'opzione è disattivata con una spiegazione e un'alternativa.
- **Test e2e:** `navigator.requestMIDIAccess` viene sostituito da un dispositivo finto pilotabile (`window.__midi`). Coperti: suonare, scollegare e ricollegare, browser non supportato.

## Percorso, progressi e motivazione (M6)

- **Contenuti:** 3 unità × 3 lezioni (`content/lessons`), 10 brani, `course.json`, `badges.json`.
  - Unità 1-2 in **wait mode**. L'unità 3 (ritmo) passa al **tempo reale**, con metronomo, velocità ridotta e finestre di timing più tolleranti (±110/250 ms), impostate per step in `settings.scoring`.
- **`core/progress`** (TS puro, testato):
  - `streak`: un giorno conta con almeno 1 minuto di pratica; oggi non ancora suonato non rompe la serie.
  - `unlock`: per proseguire servono la lezione completata e almeno 1 stella; un'unità richiede la precedente, oppure `unlock.requiresLessons` con `minStars`.
  - `stats`: note più sbagliate, precisione recente, totali.
  - `badges`: criteri dichiarativi `attempts`, `lessons`, `unit`, `streak`, `perfect`, `minutes`, `goal-days`, `realtime`, `input`.
- **`features/progress/summary`**: carica i dati dallo `StorageProvider` e calcola il riepilogo (`useProgressSummary`).
  - Dopo ogni salvataggio, `notifyProgress()` aggiorna le viste, assegna i badge nuovi (con notifica a comparsa) e festeggia l'obiettivo del giorno.
- **Schermate:**
  - mappa del percorso a sentiero, con la lezione corrente evidenziata e il motivo dei blocchi;
  - home con obiettivo, streak e "Continua";
  - **I tuoi progressi**: riquadri numerici, minuti degli ultimi 7 giorni con la linea dell'obiettivo, precisione delle ultime sessioni, note da ripassare, badge con avanzamento.
- **Grafici:** una sola serie, quindi niente legenda. Colore `--chart-1` (#6b8ee8), validato sulla superficie scura. Barre ≤ 24 px arrotondate in alto, tooltip al tocco, hover e focus, tabella "Mostra i dati".
- **Promemoria senza backend:**
  - avviso nell'app dopo l'ora scelta;
  - notifica di sistema mentre l'app è aperta;
  - file `.ics` con evento giornaliero ricorrente, che funziona anche su iPad.
  Le notifiche ad app chiusa richiedono un server push: è un'estensione futura.

## Qualità (M7)

### Prestazioni
- **Ogni schermata è un chunk lazy**: in avvio si caricano solo home e benvenuto (~150 KB compressi). VexFlow (131 KB compressi) si carica solo con lo spartito, ed è precaricato in parallelo ai font mentre si leggono le slide (`notation/preload.ts`).
- **Font musicali in woff2 separati** (`public/fonts`, estratti con `tools/extract-vexflow-fonts.ts`). Prima erano in base64 dentro il JS: 850 KB da analizzare.
- **Bravura ridotto a un sottoinsieme** (`tools/subset-bravura.py`, blocchi SMuFL in `tools/bravura-subset.json`): da 241 a 35 KB. La decodifica del font completo occupava il thread principale per centinaia di millisecondi al primo caricamento. Un test e2e verifica che ogni simbolo disegnato sia nel sottoinsieme.
- **Disegno progressivo dello spartito:** la formattazione (mappa beat → x) è sincrona. Le battute visibili si disegnano subito, le altre a blocchi in `requestIdleCallback`, con le legature alla fine; il disegno si interrompe se lo spartito viene ridisegnato.
- **Precaricamento dal router:** aprendo una lezione o un brano, VexFlow e i font partono in parallelo al chunk della pagina, senza attendere la catena di import.
- **Lavoro per frame minimo:** lo spartito aggiorna il `transform` solo quando la posizione cambia. Le animazioni dei suggerimenti usano solo l'opacità (gestita dalla GPU). La larghezza della tastiera viene misurata prima del primo disegno (nessuno spostamento di layout).
- `npm run audit` esegue build e Lighthouse su 7 pagine (mediana di 3 misure). Con `--desktop` usa il profilo desktop.

### Accessibilità
- Lo zoom con due dita non è bloccato (il viewport non usa `user-scalable=no`). Lo zoom accidentale si evita con `touch-action: manipulation` sull'app e `touch-action: none` su tastiera e spartito.
- Tasti del pianoforte con nome accessibile dal contenuto ("Do 4"). Pulsanti con soli simboli dotati di etichetta, simboli nascosti agli screen reader. Grafici con tooltip anche via tastiera e tabella dei dati.
- Elementi bloccati resi con bordo tratteggiato e testo attenuato senza opacità, che abbasserebbe il contrasto. Movimento ridotto rispettato. Testo regolabile, contrasto elevato, note colorate.
- **Tastiera del computer**: A S D F G H J K suonano i tasti bianchi, W E T Y U O P i neri, Z e X cambiano ottava. Si mappa per posizione fisica (`KeyboardEvent.code`), quindi funziona con qualsiasi layout.
- Gli e2e eseguono **axe-core** (WCAG 2.1 A/AA) su 9 schermate.

### Funzioni
- **Ripeti sezione** (`LoopControl`): si scelgono le battute da esercitare in lezioni e brani.
- **Modalità insegnante**: sblocca tutto il percorso. Le lezioni bloccate aperte dall'indirizzo mostrano come sbloccarle.
- **Convertitori** `npm run convert -- file.mid|file.musicxml --id …` (`tools/convert`). Coperti dai test: quantizzazione, mani (per traccia, rigo o punto di divisione), accordi, sovrapposizioni, legature alle stanghette, alterazioni secondo l'armatura, backup/forward e legature del MusicXML.

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
| M3 | Motore di valutazione, prima lezione completa | ✅ |
| M4 | Microfono, pitch detection, calibrazione | ✅ |
| M5 | Web MIDI | ✅ |
| M6 | Unità 1-3, progressi, streak, statistiche | ✅ |
| M7 | Rifiniture, accessibilità, offline, convertitori, test, Lighthouse | ✅ |
| M8 | Unità 4-6: due mani, accordi, alterazioni e scale | |
