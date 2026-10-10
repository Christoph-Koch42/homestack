import './CodeTag.css';

// Black stamp with the label code, e.g. P-0042.
export default function CodeTag({ code, invert = false }: { code: string; invert?: boolean }) {
  return <span className={`codetag num ${invert ? 'codetag--invert' : ''}`}>{code}</span>;
}
