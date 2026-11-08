/** Testi dell'interfaccia (italiano). Struttura pronta per aggiungere altre lingue. */
export const it = {
  appName: 'Piano Tutor',
  common: {
    back: 'Indietro',
    comingSoon: 'In arrivo',
    loading: 'Caricamento…',
  },
  welcome: {
    title: 'Benvenuto in Piano Tutor!',
    subtitle: 'Come vuoi suonare? Puoi cambiare idea quando vuoi dalle impostazioni.',
    mic: {
      title: 'Pianoforte acustico',
      desc: 'Suona il tuo pianoforte: ti ascolto con il microfono.',
    },
    midi: {
      title: 'Tastiera MIDI',
      desc: 'Collega una tastiera digitale via USB o Bluetooth.',
    },
    virtual: {
      title: 'Tastiera sullo schermo',
      desc: 'Non hai ancora un pianoforte? Suona direttamente sul tablet.',
    },
  },
  home: {
    greeting: 'Ciao! Pronto a suonare?',
    course: 'Il tuo percorso',
    courseDesc: 'Lezioni brevi, passo dopo passo',
    freePlay: 'Tastiera libera',
    freePlayDesc: 'Esplora i suoni del pianoforte',
    songs: 'Brani',
    songsDesc: 'Spartiti che scorrono: ascolta e suona',
    settings: 'Impostazioni',
    diagnostics: 'Diagnostica',
    about: 'Informazioni',
    install: 'Installa l’app',
    installIos: 'Per installare: tocca Condividi e poi “Aggiungi alla schermata Home”.',
  },
  play: {
    title: 'Tastiera libera',
    octaveDown: 'Ottava più grave',
    octaveUp: 'Ottava più acuta',
    labels: 'Nomi note',
    sustain: 'Pedale',
    hint: 'Tocca un tasto per sentire il suono. Il Do centrale è segnato con un pallino.',
    loadingSamples: 'Preparo il pianoforte…',
    samplesError: 'Non riesco a caricare i suoni. Controlla la connessione e riprova.',
    retry: 'Riprova',
  },
  songs: {
    title: 'Brani',
    subtitle: 'Ascolta un brano mentre lo spartito scorre, e prova a suonarlo insieme.',
    twoHands: 'due mani',
    rightHand: 'mano destra',
  },
  player: {
    play: 'Suona',
    pause: 'Pausa',
    restart: 'Dall’inizio',
    tempo: 'Velocità',
    metronome: 'Metronomo',
    listen: 'Ascolta',
  },
  settings: {
    title: 'Impostazioni',
    input: 'Modalità di gioco',
    naming: 'Nomi delle note',
    namingIt: 'Do Re Mi',
    namingEn: 'C D E',
    showNames: 'Mostra i nomi sui tasti',
    colorNotes: 'Note colorate',
    colorNotesDesc: 'Ogni nota ha il suo colore: aiuta a riconoscerle.',
    fontSize: 'Dimensione del testo',
    highContrast: 'Contrasto elevato',
    volume: 'Volume',
    reset: 'Cancella tutti i progressi',
    resetConfirm: 'Vuoi davvero cancellare progressi e impostazioni? L’operazione non si può annullare.',
  },
  diagnostics: {
    title: 'Diagnostica',
  },
  about: {
    title: 'Informazioni',
  },
} as const;

export const t = it;
