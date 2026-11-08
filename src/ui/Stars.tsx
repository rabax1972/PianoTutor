import './Stars.css';

export function Stars({ value, size = 'md', animate = false }: { value: number; size?: 'sm' | 'md' | 'lg'; animate?: boolean }) {
  return (
    <span className={`stars stars--${size}${animate ? ' stars--animate' : ''}`} role="img" aria-label={`${value} stelle su 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`star${i <= value ? ' star--on' : ''}`} style={{ animationDelay: `${(i - 1) * 0.25}s` }} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}
