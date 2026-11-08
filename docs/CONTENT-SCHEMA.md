# Schema dei contenuti

Lezioni e brani sono **dati JSON** nella cartella `content/`. Per aggiungerne non serve toccare il codice. Ogni file viene validato durante la build: se un file è sbagliato, la build si ferma e indica il campo errato.

- La fonte di verità è `src/core/content/schema.ts` (Zod).
- I JSON Schema per l'editor si trovano in `docs/schema/*.schema.json`. Per rigenerarli: `npm run schema`.
  In VS Code si possono associare ai file con la proprietà `"$schema"` oppure con l'impostazione `json.schemas`.

## Convenzioni

| Concetto | Rappresentazione |
|---|---|
| Tempo musicale | **beat**, dove 1 = semiminima (♩) |
| Durate | 4 = semibreve, 2 = minima, 1 = semiminima, 0.5 = croma, 0.25 = semicroma; puntata = ×1.5 (es. 1.5) |
| Altezze | notazione scientifica: `"C4"` = Do centrale, `"F#3"`, `"Bb4"` |
| Mano | `"R"` destra, `"L"` sinistra |
| Dita | 1 = pollice … 5 = mignolo |
| Tonalità | `fifths`: 0 = Do, 1 = Sol, 2 = Re, −1 = Fa, −2 = Si♭ … più `mode` (`major`/`minor`) |
| Id | minuscole, numeri, trattini (`u2-l03-mano-destra`) |

Tabella delle altezze utili: `C4` Do · `D4` Re · `E4` Mi · `F4` Fa · `G4` Sol · `A4` La · `B4` Si · `C5` Do acuto. `C3` è il Do un'ottava sotto il Do centrale (chiave di basso).

## Brano (`content/pieces/<id>.json`)

```jsonc
{
  "schemaVersion": 1,
  "id": "fra-martino",
  "title": "Fra Martino",
  "composer": "Tradizionale",
  "arranger": "Piano Tutor",
  "license": "public-domain",          // "public-domain" | "original" (nient'altro è ammesso)
  "tempo": { "bpm": 90 },               // semiminime al minuto
  "timeSignature": [4, 4],
  "key": { "fifths": 0, "mode": "major" },
  "pickupBeats": 0,                     // anacrusi (facoltativa)
  "staves": ["treble"],                 // ["treble"], ["bass"] o ["treble","bass"]
  "events": [
    { "t": 0, "d": 1, "p": ["C4"], "hand": "R", "fingers": [1], "label": "Fra" },
    { "t": 1, "d": 1, "p": ["D4"], "hand": "R", "fingers": [2], "label": "Mar" },
    { "t": 2, "d": 1, "p": ["E4"], "hand": "R", "fingers": [3], "label": "ti" },
    { "t": 3, "d": 1, "p": ["C4"], "hand": "R", "fingers": [1], "label": "no" }
  ]
}
```

### NoteEvent

| Campo | Tipo | Obbl. | Significato |
|---|---|---|---|
| `t` | number ≥ 0 | ✔ | inizio, in beat dall'inizio del brano |
| `d` | number > 0 | ✔ | durata in beat |
| `p` | string[] | ✔ | altezze: `[]` = **pausa**, più elementi = **accordo** |
| `hand` | `"R"`/`"L"` | ✔ | mano |
| `staff` | `"treble"`/`"bass"` | | rigo (default: R → violino, L → basso) |
| `fingers` | (1-5)[] | | diteggiatura, stessa lunghezza di `p` |
| `tie` | boolean | | legatura di valore con la nota successiva |
| `label` | string | | sillaba o testo sotto la nota |

Gli eventi delle due mani stanno nello stesso array: l'ordine non conta, fa fede `t`.

### Regole controllate in automatico (`npm run validate`, eseguito anche dalla build)

- L'`id` del brano deve coincidere con il nome del file (`fra-martino.json` → `"fra-martino"`).
- Una nota **non può attraversare la stanghetta**: va divisa in due eventi, con `"tie": true` sul primo.
- Sullo stesso rigo gli eventi **non si sovrappongono**. Per suonare più note insieme si usa un accordo (più altezze in `p`).
- Le durate devono essere multiple di semicroma (0.25). Le durate composte (es. 2.5) vengono disegnate in automatico come note legate.
- **Le pause si possono omettere**: i vuoti vengono riempiti in automatico. Scriverle esplicitamente (`"p": []`) serve solo a renderle intenzionali.
- Ogni rigo usato dalle note deve comparire in `staves`.
- Aggiungendo `"$schema": "../../docs/schema/piece.schema.json"` in cima al file, VS Code offre autocompletamento e segnala gli errori mentre scrivi.

## Lezione (`content/lessons/<id>.json`)

```jsonc
{
  "schemaVersion": 1,
  "id": "u1-l01-do-centrale",
  "unitId": "u1",
  "title": "Il Do centrale",
  "summary": "Trova il Do al centro della tastiera.",
  "estimatedMinutes": 3,
  "concepts": ["middle-c"],
  "steps": [
    {
      "type": "explain",
      "id": "intro",
      "slides": [
        { "text": "Guarda i tasti neri: sono a gruppi di **due** e di **tre**.",
          "animation": { "kind": "keyboard-highlight", "params": { "group": "black-pairs" } } },
        { "text": "Il **Do** è il tasto bianco subito a sinistra dei due tasti neri.",
          "highlightKeys": ["C4"] }
      ]
    },
    { "type": "exercise", "id": "guidato", "mode": "guided",
      "piece": { "...brano inline...": "" },
      "settings": { "flow": "wait", "showNoteNames": true } },
    { "type": "exercise", "id": "libero", "mode": "free", "piece": "do-ripetuto",
      "settings": { "flow": "wait", "showNoteNames": false } },
    { "type": "song", "id": "brano", "piece": "fra-martino",
      "settings": { "flow": "wait", "listenFirst": true, "hands": "R" } }
  ]
}
```

### Tipi di step

| `type` | Campi | Uso |
|---|---|---|
| `explain` | `slides[]` | spiegazione breve con animazione |
| `exercise` | `mode` (`guided`/`free`), `piece`, `settings` | guidato: suggerimenti visibili; libero: senza aiuti |
| `song` | `piece`, `settings` | mini-brano finale |

`piece` può essere l'**id** di un brano in `content/pieces/` oppure un brano **inline** (comodo per esercizi brevi).

### Slide

| Campo | Significato |
|---|---|
| `text` | testo breve (markdown: `**grassetto**`) |
| `animation.kind` | `keyboard-highlight`, `staff-note`, `rhythm-pulse`, `hand-position` |
| `animation.params` | parametri specifici dell'animazione |
| `highlightKeys` | tasti da evidenziare sulla tastiera |
| `showStaff` | `treble`, `bass`, `grand` |

### PlaySettings

| Campo | Default | Significato |
|---|---|---|
| `flow` | — | `wait`: il brano aspetta la nota giusta; `realtime`: scorre a tempo |
| `listenFirst` | false | prima l'app suona il brano, poi tocca all'utente |
| `metronome` | false | metronomo attivo |
| `countIn` | 1 | battute di attacco prima di iniziare |
| `tempoScale` | 1 | moltiplicatore del tempo (0.25-1.5) |
| `hands` | `both` | mano o mani da suonare; l'altra può essere suonata dall'app |
| `loop` | — | `{ fromMeasure, toMeasure }`: ripete una sezione |
| `showNoteNames` | da impostazioni | nomi sulle note e sui tasti |
| `colorNotes` | da impostazioni | note colorate |
| `scoring` | default | sostituisce in parte `ScoringConfig` |

### ScoringConfig (valori predefiniti)

```json
{
  "timing": { "perfectMs": 80, "goodMs": 180 },
  "weights": { "pitch": 0.7, "timing": 0.3 },
  "stars": [0.6, 0.8, 0.93]
}
```

- Entro ±`perfectMs`: **verde**. Entro ±`goodMs`: **giallo** (in anticipo o in ritardo). Oltre, o con un'altezza sbagliata: **rosso**.
- In `wait` mode il timing non viene valutato e conta solo l'altezza.
- Punteggio = `pitch × weights.pitch + timing × weights.timing`, normalizzato. Le stelle si assegnano con le soglie `stars`.

## Corso (`content/course.json`)

```jsonc
{
  "schemaVersion": 1,
  "id": "corso-base",
  "title": "Pianoforte da zero",
  "units": [
    {
      "id": "u1",
      "title": "Conosci la tastiera",
      "description": "Do centrale, tasti bianchi e neri, posizione delle mani",
      "icon": "🎹",
      "lessons": ["u1-l01-do-centrale", "u1-l02-tasti-bianchi"],
      "unlock": { "requiresLessons": [] }
    },
    {
      "id": "u2",
      "title": "Le prime note",
      "description": "Mano destra in chiave di violino",
      "icon": "🎼",
      "lessons": ["u2-l01-do-re-mi"],
      "unlock": { "requiresLessons": ["u1-l02-tasti-bianchi"], "minStars": 1 }
    }
  ]
}
```

## Copyright

Sono ammessi **solo** brani di pubblico dominio (arrangiati da noi) o composizioni originali. Il campo `license` è obbligatorio e la validazione rifiuta qualsiasi altro valore.

## Conversione da MIDI e MusicXML (M7)

`tools/midi-to-lesson.ts` e `tools/musicxml-to-lesson.ts` producono un brano JSON già quantizzato. Va poi completato a mano con diteggiature e testo.
