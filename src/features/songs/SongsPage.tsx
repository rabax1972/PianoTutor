import { listPieces } from '../../core/content/loader';
import { t } from '../../i18n/it';
import { Tile, TopBar } from '../../ui/components';

export function SongsPage() {
  const pieces = listPieces();
  return (
    <main className="page">
      <TopBar title={t.songs.title} />
      <p className="muted" style={{ margin: 0, fontSize: '1.05rem' }}>
        {t.songs.subtitle}
      </p>
      <div className="tiles">
        {pieces.map((p) => (
          <Tile
            key={p.id}
            testId={`song-${p.id}`}
            icon={p.staves.length === 2 ? '🙌' : '🎵'}
            title={p.title}
            desc={[p.composer, p.staves.length === 2 ? t.songs.twoHands : t.songs.rightHand].filter(Boolean).join(' · ')}
            to={`/brano/${p.id}`}
          />
        ))}
      </div>
    </main>
  );
}
