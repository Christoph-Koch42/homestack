import type { ReactNode } from 'react';
import './ListRow.css';

interface Props {
  title: ReactNode;
  meta?: ReactNode;
  lead?: ReactNode;
  trail?: ReactNode;
  href?: string;
  onClick?: () => void;
  id?: string;
  highlight?: boolean;
}

// Dense row for information clusters. Whole row inverts to black on press.
export default function ListRow({ title, meta, lead, trail, href, onClick, id, highlight }: Props) {
  const body = (
    <>
      {lead && <span className="row__lead">{lead}</span>}
      <span className="row__body">
        <span className="row__title">{title}</span>
        {meta && <span className="row__meta">{meta}</span>}
      </span>
    </>
  );
  return (
    <li id={id} className={`row ${highlight ? 'row--hl' : ''}`}>
      {href ? (
        <a className="row__main row__main--action" href={href}>
          {body}
        </a>
      ) : onClick ? (
        <button type="button" className="row__main row__main--action" onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className="row__main">{body}</div>
      )}
      {trail && <span className="row__trail">{trail}</span>}
    </li>
  );
}

export function RowList({ children }: { children: ReactNode }) {
  return <ul className="rows">{children}</ul>;
}
