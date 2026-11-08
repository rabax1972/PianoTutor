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

## 4. Diagnostica

La schermata **Diagnostica** mostra lo stato dell'audio, la latenza di elaborazione e di uscita, il ritardo del tocco misurato, il supporto a MIDI e microfono e lo stato offline.

## 5. Test automatici

```bash
npm test                # unit (Vitest)
npm run test:e2e        # e2e (Playwright, viewport iPad landscape e portrait)
```
