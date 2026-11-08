import { useState, type ReactNode } from 'react';
import type { Step } from '../../core/content/schema';
import { SlideAnimation } from './animations';

/** Markdown minimo: **grassetto**. */
export function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

export function ExplainStep({ step, onDone }: { step: Extract<Step, { type: 'explain' }>; onDone: () => void }) {
  const [i, setI] = useState(0);
  const slide = step.slides[i]!;
  const last = i === step.slides.length - 1;
  return (
    <div className="explain">
      <div className="explain__card" key={i}>
        <p className="explain__text" data-testid="slide-text">
          {inlineMarkdown(slide.text)}
        </p>
        <div className="explain__anim">
          <SlideAnimation slide={slide} />
        </div>
      </div>
      <div className="explain__nav">
        <button className="btn" onClick={() => setI((n) => n - 1)} disabled={i === 0}>
          ← Indietro
        </button>
        <span className="explain__dots" role="img" aria-label={`Slide ${i + 1} di ${step.slides.length}`}>
          {step.slides.map((_, k) => (
            <span key={k} className={k === i ? 'is-on' : ''} />
          ))}
        </span>
        <button className="btn btn--primary" data-testid="next-slide" onClick={() => (last ? onDone() : setI((n) => n + 1))}>
          {last ? 'Iniziamo! →' : 'Avanti →'}
        </button>
      </div>
    </div>
  );
}
