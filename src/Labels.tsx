import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { reserveCodes, useStore } from './store';
import { formatCode, parseCodeList, type CodeType } from './codes';
import Section from './ui/Section';
import Field, { SelectField } from './ui/Field';
import Button from './ui/Button';
import { useToast } from './ui/Toast';
import './Labels.css';

// A4 sticker sheet geometry, all in mm. Margins are centred unless adjusted.
interface Format {
  w: number;
  h: number;
  cols: number;
  rows: number;
  gapX: number;
  gapY: number;
  offsetX: number;
  offsetY: number;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MAX_LABELS = 600;

// Common A4 layouts. Check the numbers on your sheet's packaging and print a
// test page on plain paper first; "Advanced" lets you correct any drift.
const PRESETS: { id: string; name: string; f: Omit<Format, 'offsetX' | 'offsetY'> }[] = [
  { id: '38x21', name: '38.1 × 21.2 mm · 65 per sheet · boxes', f: { w: 38.1, h: 21.2, cols: 5, rows: 13, gapX: 2.5, gapY: 0 } },
  { id: '63x38', name: '63.5 × 38.1 mm · 21 per sheet · shelves', f: { w: 63.5, h: 38.1, cols: 3, rows: 7, gapX: 2.5, gapY: 0 } },
  { id: '48x25', name: '48.5 × 25.4 mm · 44 per sheet', f: { w: 48.5, h: 25.4, cols: 4, rows: 11, gapX: 0, gapY: 0 } },
  { id: '25x10', name: '25.4 × 10 mm · 189 per sheet · small items', f: { w: 25.4, h: 10, cols: 7, rows: 27, gapX: 2.5, gapY: 0 } },
];

function layout(f: Format) {
  const totalW = f.cols * f.w + (f.cols - 1) * f.gapX;
  const totalH = f.rows * f.h + (f.rows - 1) * f.gapY;
  return {
    left: (PAGE_W - totalW) / 2 + f.offsetX,
    top: (PAGE_H - totalH) / 2 + f.offsetY,
    perSheet: f.cols * f.rows,
    fits: totalW <= PAGE_W && totalH <= PAGE_H,
  };
}

export default function Labels() {
  const { counters } = useStore();
  const toast = useToast();

  const [type, setType] = useState<CodeType>('P');
  const [mode, setMode] = useState<'new' | 'reprint'>('new');
  const [count, setCount] = useState(65);
  const [reprint, setReprint] = useState('');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [format, setFormat] = useState<Format>({ ...PRESETS[0].f, offsetX: 0, offsetY: 0 });
  const [start, setStart] = useState(1);
  const [reserved, setReserved] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [printWhenReady, setPrintWhenReady] = useState(false);
  const [svgs, setSvgs] = useState<Record<string, string>>({});

  const geo = layout(format);
  const safeCount = Math.max(1, Math.min(MAX_LABELS, Math.floor(count) || 1));

  // New codes preview the next free numbers until they are actually reserved.
  const codes = useMemo(() => {
    if (mode === 'reprint') return parseCodeList(reprint, type).slice(0, MAX_LABELS);
    if (reserved) return reserved;
    const next = type === 'P' ? counters.nextP : counters.nextI;
    return Array.from({ length: safeCount }, (_, i) => formatCode(type, next + i));
  }, [mode, reprint, type, reserved, counters, safeCount]);


  useEffect(() => {
    let cancelled = false;
    Promise.all(
      codes.map(async (c) => [c, await QRCode.toString(c, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })] as const),
    ).then((pairs) => {
      if (!cancelled) setSvgs(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [codes]);

  const ready = codes.length > 0 && codes.every((c) => svgs[c]);

  useEffect(() => {
    if (printWhenReady && ready) {
      setPrintWhenReady(false);
      window.print();
    }
  }, [printWhenReady, ready]);

  const sheets = useMemo(() => {
    const startIdx = Math.max(0, Math.min(geo.perSheet - 1, start - 1));
    const slots: (string | null)[] = [...Array(startIdx).fill(null), ...codes];
    const out: (string | null)[][] = [];
    for (let i = 0; i < slots.length; i += geo.perSheet) out.push(slots.slice(i, i + geo.perSheet));
    return out;
  }, [codes, start, geo.perSheet]);

  const print = async () => {
    if (mode === 'reprint' || reserved) {
      setPrintWhenReady(true);
      return;
    }
    setBusy(true);
    try {
      setReserved(await reserveCodes(type, safeCount));
      setPrintWhenReady(true);
    } catch {
      toast('Reserving codes needs a connection. Try again upstairs.');
    } finally {
      setBusy(false);
    }
  };

  const setPreset = (id: string) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p) setFormat({ ...p.f, offsetX: 0, offsetY: 0 });
  };

  const num = (key: keyof Format) => ({
    type: 'number' as const,
    inputMode: 'decimal' as const,
    step: '0.1',
    value: format[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setPresetId('custom');
      setFormat((f) => ({ ...f, [key]: Number(e.target.value) || 0 }));
    },
  });

  return (
    <div className="lb">
      <div className="lb__controls">
        <h1 className="page-title">Labels</h1>

        <Section num={1} title="Codes">
          <div className="lb__seg" role="radiogroup" aria-label="Label type">
            {(['P', 'I'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} className={`lb__segbtn ${type === t ? 'lb__segbtn--on' : ''}`} onClick={() => { setType(t); setReserved(null); }}>
                {t === 'P' ? 'Places P-' : 'Items I-'}
              </button>
            ))}
          </div>
          <div className="lb__seg" role="radiogroup" aria-label="New or reprint">
            {(['new', 'reprint'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={`lb__segbtn ${mode === m ? 'lb__segbtn--on' : ''}`} onClick={() => { setMode(m); setReserved(null); }}>
                {m === 'new' ? 'New codes' : 'Reprint'}
              </button>
            ))}
          </div>
          {mode === 'new' ? (
            <Field
              label="How many"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_LABELS}
              value={count}
              onChange={(e) => { setCount(Number(e.target.value)); setReserved(null); }}
              hint={reserved ? `Reserved ${reserved[0]} – ${reserved.at(-1)}` : `Next free: ${codes[0]}`}
            />
          ) : (
            <Field
              label="Codes to reprint"
              value={reprint}
              onChange={(e) => setReprint(e.target.value)}
              placeholder="12, 15-20, P-0031"
              hint={`${codes.length} labels`}
            />
          )}
        </Section>

        <Section num={2} title="Sheet">
          <SelectField label="Format" value={presetId} onChange={(e) => setPreset(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="custom">Custom</option>
          </SelectField>
          <Field
            label={`Start at label (1–${geo.perSheet})`}
            type="number"
            inputMode="numeric"
            min={1}
            max={geo.perSheet}
            value={start}
            onChange={(e) => setStart(Number(e.target.value) || 1)}
            hint="To use up a partly used sheet."
          />
          <details className="lb__adv">
            <summary className="label">Advanced: size and alignment (mm)</summary>
            <div className="lb__advgrid">
              <Field label="Label width" {...num('w')} />
              <Field label="Label height" {...num('h')} />
              <Field label="Columns" {...num('cols')} step="1" />
              <Field label="Rows" {...num('rows')} step="1" />
              <Field label="Gap across" {...num('gapX')} />
              <Field label="Gap down" {...num('gapY')} />
              <Field label="Shift right" {...num('offsetX')} />
              <Field label="Shift down" {...num('offsetY')} />
            </div>
          </details>
          {!geo.fits && <p className="lb__warn">These labels don't fit on A4.</p>}
        </Section>

        <div className="lb__print">
          <Button variant="accent" size="lg" block icon={<Printer strokeWidth={2.5} />} disabled={busy || codes.length === 0 || !geo.fits} onClick={print}>
            {busy ? 'Reserving…' : mode === 'new' && !reserved ? `Reserve ${safeCount} & print` : 'Print'}
          </Button>
          <p className="label">Print at 100% / actual size, no scaling, A4.</p>
        </div>
      </div>

      <Preview sheets={sheets} format={format} left={geo.left} top={geo.top} svgs={svgs} />
    </div>
  );
}

function Preview({ sheets, format, left, top, svgs }: { sheets: (string | null)[][]; format: Format; left: number; top: number; svgs: Record<string, string> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const mmToPx = 96 / 25.4;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / (PAGE_W * mmToPx))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // QR fills the height; the code sits to the right when there is room.
  const pad = Math.min(1.5, format.h * 0.08);
  const qr = Math.max(0, Math.min(format.h - 2 * pad, format.w - 2 * pad));
  const textW = format.w - qr - 3 * pad;
  const font = Math.max(1.6, Math.min(format.h * 0.32, textW / 3.8));
  const showText = textW >= 8;

  return (
    <div className="lb__preview swiss-grid" ref={wrapRef} style={{ '--scale': scale } as CSSProperties}>
      <p className="label lb__previewlabel">
        Preview · {sheets.length} sheet{sheets.length === 1 ? '' : 's'}
      </p>
      {sheets.map((slots, s) => (
        <div className="lb__sheetbox" key={s}>
          <div className="lb__sheet">
            {slots.map((code, i) => {
              const col = i % format.cols;
              const row = Math.floor(i / format.cols);
              return (
                <div
                  key={i}
                  className={`lbl ${code ? '' : 'lbl--skip'}`}
                  style={{
                    left: `${left + col * (format.w + format.gapX)}mm`,
                    top: `${top + row * (format.h + format.gapY)}mm`,
                    width: `${format.w}mm`,
                    height: `${format.h}mm`,
                    padding: `${pad}mm`,
                    gap: `${pad}mm`,
                  }}
                >
                  {code && (
                    <>
                      <span className="lbl__qr" style={{ width: `${qr}mm`, height: `${qr}mm` }} dangerouslySetInnerHTML={{ __html: svgs[code] ?? '' }} />
                      {showText && (
                        <span className="lbl__code num" style={{ fontSize: `${font}mm` }}>
                          {code}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
