# Provare Piano Tutor sul tablet

## 1. Pubblicazione su giacomorabaglia.com

```bash
npm ci
npm run build           # crea dist/ con base /pianotutor/
```

Carica **il contenuto** di `dist/` nella cartella `/pianotutor/` del sito, via FTP o SFTP. L'app sarà su:

> https://www.giacomorabaglia.com/pianotutor/

Per un percorso diverso: `BASE_PATH=/altro-percorso/ npm run build` (in PowerShell: `$env:BASE_PATH='/altro-percorso/'; npm run build`).

### Requisiti del server

- **HTTPS**, obbligatorio per microfono, service worker e installazione.
- Tipi MIME: `.webmanifest` → `application/manifest+json`, `.mp3` → `audio/mpeg` (di solito sono già corretti).
- Il file `sw.js` **non** deve essere messo in cache a lungo dal server (`Cache-Control: no-cache`), altrimenti gli aggiornamenti arrivano in ritardo. Su Apache, nella cartella:

  ```apache
  <Files "sw.js">
    Header set Cache-Control "no-cache"
  </Files>
  AddType application/manifest+json .webmanifest
  ```

- Non servono regole di rewrite: l'app usa URL con `#` (es. `…/pianotutor/#/suona`).

## 2. Prova rapida in rete locale (senza pubblicare)

```bash
npm run dev             # mostra anche l'indirizzo "Network": http://192.168.x.x:5173
```

Apri quell'indirizzo dal tablet (stessa rete Wi-Fi). La tastiera e l'audio funzionano anche in HTTP. **Microfono, offline e installazione richiedono HTTPS**, quindi dalla M4 in poi conviene provare sulla versione pubblicata.

## 3. Installazione

- **iPad (Safari)**: Condividi → *Aggiungi alla schermata Home*.
- **Android (Chrome)**: pulsante *Installa l'app* nella home di Piano Tutor, oppure menu ⋮ → *Installa app*.

Dopo il primo caricamento l'app funziona anche **offline**. Per verificarlo: modalità aereo, poi riapri l'app.

## 4. Microfono (pianoforte acustico)

1. Benvenuto (o Impostazioni → Modalità di gioco) → **Pianoforte acustico** → consenti l'accesso al microfono.
2. Appoggia il tablet sul leggio e segui i tre passi: silenzio, un Do tenuto, misura automatica del ritardo (volume alto, niente cuffie).
3. Per verificare: **Tastiera libera** mostra in grande le note che suoni sul pianoforte. **Diagnostica** mostra livello, soglia, nota e scarto in cent.
4. Se alcune note non vengono sentite, aumenta **Impostazioni → Sensibilità del microfono**. Se compaiono note "fantasma", riducila.
5. Se le note risultano sempre in ritardo o in anticipo nella modalità "A tempo", regola **Diagnostica → Calibrazione manuale della latenza**.

Nota: su iPad il microfono funziona solo in HTTPS e dopo un tocco sullo schermo. Gli accordi vengono verificati meglio in una stanza silenziosa.

## 5. Tastiera MIDI

- **Android (Chrome/Edge)**: collega la tastiera via USB (adattatore USB-C/OTG) oppure associala via Bluetooth dalle impostazioni di sistema. Poi Impostazioni → Modalità di gioco → **Tastiera MIDI**.
- **iPad/iPhone**: Safari non supporta la Web MIDI. Usa il microfono oppure la tastiera a schermo.
- **Computer**: Chrome, Edge o Firefox (dalla versione 108) con tastiera USB.
- Nella pagina **Tastiera MIDI** premi un tasto per verificare che arrivi. Se la tastiera non ha altoparlanti, attiva **Suona dal tablet**.
- Puoi scollegare e ricollegare la tastiera anche durante un esercizio: si riattiva da sola.

## 6. Diagnostica

La schermata **Diagnostica** mostra lo stato dell'audio, la latenza di elaborazione e di uscita, il ritardo del tocco misurato, il supporto a MIDI e microfono e lo stato offline.

## 7. Test automatici

```bash
npm test                # unit (Vitest)
npm run test:e2e        # e2e (Playwright: iPad landscape/portrait, microfono finto, MIDI simulato)
```
