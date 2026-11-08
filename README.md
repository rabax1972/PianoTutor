# 🎹 Piano Tutor

Web app (PWA) per imparare a suonare il pianoforte partendo da zero, ottimizzata per tablet. Interfaccia e contenuti in italiano.

- Suona su un **pianoforte acustico** (microfono), su una **tastiera MIDI** o sulla **tastiera a schermo**.
- Lo spartito scorre e il feedback su note e ritmo è immediato.
- Percorso a unità con lezioni da 2-5 minuti, stelle, streak e statistiche.
- Funziona offline. I dati restano sul dispositivo.

## Avvio

```bash
npm install
npm run dev         # sviluppo (http://localhost:5173, visibile anche in LAN)
npm test            # test unitari
npm run test:e2e    # test end-to-end (Playwright)
npm run build       # build di produzione in dist/ (base /pianotutor/)
```

## Documentazione

- [Architettura](docs/ARCHITECTURE.md)
- [Schema dei contenuti](docs/CONTENT-SCHEMA.md): come scrivere lezioni e brani
- [Provare sul tablet e pubblicare](docs/TESTING-ON-TABLET.md)

## Crediti

Campioni di pianoforte: *Salamander Grand Piano V3* di Alexander Holm, licenza CC-BY 3.0.
Brani: solo pubblico dominio o composizioni originali.
