import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { t } from '../i18n/it';
import './components.css';

export function TopBar({
  title,
  back = true,
  backTo = '/',
  actions,
}: {
  title: string;
  back?: boolean;
  backTo?: string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button className="btn btn--icon" aria-label={t.common.back} onClick={() => navigate(backTo)}>
          ←
        </button>
      )}
      <h1 className="topbar__title">{title}</h1>
      {actions && <div className="topbar__actions">{actions}</div>}
    </header>
  );
}

interface TileProps {
  icon: string;
  title: string;
  desc: string;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  tag?: string;
  hero?: boolean;
  testId?: string;
}

export function Tile({ icon, title, desc, to, onClick, disabled, tag, hero, testId }: TileProps) {
  const body = (
    <>
      {tag && <span className="tag">{tag}</span>}
      <span className="tile__icon" aria-hidden>
        {icon}
      </span>
      <span className="tile__title">{title}</span>
      <span className="tile__desc">{desc}</span>
    </>
  );
  const cls = `tile${hero ? ' tile--hero' : ''}`;
  if (to && !disabled)
    return (
      <Link className={cls} to={to} data-testid={testId}>
        {body}
      </Link>
    );
  return (
    <button className={cls} onClick={disabled ? undefined : onClick} aria-disabled={disabled} data-testid={testId}>
      {body}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Row({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div className="row">
      <div>
        <div className="row__label">{label}</div>
        {desc && <div className="row__desc">{desc}</div>}
      </div>
      {children}
    </div>
  );
}
