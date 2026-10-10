import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './IconBox.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  dark?: boolean;
  children: ReactNode;
}

// A functional symbol in a square frame. `label` is the accessible name.
export default function IconBox({ label, active, dark, className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`iconbox ${active ? 'iconbox--active' : ''} ${dark ? 'iconbox--dark' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
