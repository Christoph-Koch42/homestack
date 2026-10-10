import type { ReactNode } from 'react';
import './Section.css';

interface Props {
  num: number;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

// "01. ROOMS": numbered, thick top rule, red number as the only accent.
export default function Section({ num, title, action, className = '', children }: Props) {
  return (
    <section className={`section ${className}`}>
      <header className="section__head">
        <h2 className="section__title">
          <span className="section__num num">{String(num).padStart(2, '0')}.</span> {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
