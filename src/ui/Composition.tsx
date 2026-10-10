// Bauhaus figure: a stack of geometry (the HomeStack mark). Pure decoration,
// hidden from screen readers. Same shapes as the app icon.
export default function Composition({ size = 160, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="10" y="58" width="56" height="32" fill="#000" />
      <rect x="22" y="30" width="44" height="22" fill="none" stroke="#000" strokeWidth="4" />
      <circle cx="66" cy="30" r="20" fill="#FF3000" />
      <rect x="10" y="94" width="80" height="4" fill="#000" />
    </svg>
  );
}
