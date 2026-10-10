// Label codes: P-0042 (place) and I-0042 (item). The QR holds exactly this text.
export type CodeType = 'P' | 'I';

export function formatCode(type: CodeType, n: number): string {
  return `${type}-${String(n).padStart(4, '0')}`;
}

// Scanned QR content must match exactly; anything else is not one of ours.
export function parseScanned(raw: string): { type: CodeType; code: string } | null {
  const text = raw.trim();
  const m = text.match(/^([PI])-(\d{4,})$/);
  return m ? { type: m[1] as CodeType, code: text } : null;
}

// Typed by hand (crumpled label): accepts "42", "p42", "P 42", "P-0042".
export function parseTyped(input: string, defaultType: CodeType = 'P'): string | null {
  const m = input.trim().toUpperCase().match(/^([PI])?[\s-]*(\d{1,8})$/);
  if (!m) return null;
  return formatCode((m[1] as CodeType | undefined) ?? defaultType, Number(m[2]));
}

// Reprint list: "P-0001, P-0005-P-0010, 12-14" -> individual codes.
export function parseCodeList(input: string, type: CodeType): string[] {
  const out: string[] = [];
  for (const part of input.split(/[,;\s]+/).filter(Boolean)) {
    const range = part.toUpperCase().match(/^(?:[PI]-?)?(\d+)-(?:[PI]-?)?(\d+)$/);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
      for (let n = a; n <= b && out.length < 2000; n++) out.push(formatCode(type, n));
      continue;
    }
    const single = parseTyped(part, type);
    if (single) out.push(single);
  }
  return out;
}
