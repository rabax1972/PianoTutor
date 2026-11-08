import { t } from '../../i18n/it';
import { TopBar } from '../../ui/components';

export function AboutPage() {
  return (
    <main className="page">
      <TopBar title={t.about.title} />
      <section className="page-section" style={{ fontSize: '1.05rem' }}>
        <p>
          <strong>Piano Tutor</strong> ti accompagna passo dopo passo, dalle prime note ai brani con due mani.
          Tutti i dati restano su questo dispositivo.
        </p>
        <h2>Crediti</h2>
        <p>
          Suoni del pianoforte: <em>Salamander Grand Piano V3</em> di Alexander Holm, licenza{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            Creative Commons Attribution 3.0
          </a>
          .
        </p>
        <p>
          Brani: solo melodie di pubblico dominio (arrangiamenti originali) o composizioni originali create per
          Piano Tutor.
        </p>
        <p className="muted">Versione {__APP_VERSION__}</p>
      </section>
    </main>
  );
}
