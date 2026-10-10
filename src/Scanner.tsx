import { useEffect, useRef, useState, type FormEvent } from 'react';
import jsQR from 'jsqr';
import { Flashlight, FlashlightOff, X } from 'lucide-react';
import { parseScanned, parseTyped, type CodeType } from './codes';
import IconBox from './ui/IconBox';
import Button from './ui/Button';
import './Scanner.css';

// Native detector on Android Chrome; jsQR on everything else.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): BarcodeDetectorLike;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

interface Props {
  open: boolean;
  title: string;
  defaultType?: CodeType;
  onCode: (code: string) => void;
  onClose: () => void;
}

const SCAN_EVERY_MS = 150;

export default function Scanner({ open, title, defaultType = 'P', onCode, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  // The camera loop lives in an effect; read the latest callback through a ref.
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  // A <dialog> in the top layer, so the scanner also opens above other dialogs.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let lastBad = '';

    const handle = (raw: string): boolean => {
      const parsed = parseScanned(raw);
      if (!parsed) {
        if (raw !== lastBad) {
          lastBad = raw;
          setMessage('Not a HomeStack code');
        }
        return false;
      }
      navigator.vibrate?.(60);
      onCodeRef.current(parsed.code);
      return true;
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera not available here. Type the code below.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        });
      } catch {
        setCameraError('No camera access. Allow the camera, or type the code below.');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(Boolean(caps.torch));

      let detector: BarcodeDetectorLike | null = null;
      if (window.BarcodeDetector) {
        const formats = await window.BarcodeDetector.getSupportedFormats().catch((): string[] => []);
        if (formats.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.videoWidth) {
          try {
            if (detector) {
              const found = await detector.detect(video);
              for (const f of found) if (handle(f.rawValue)) return;
            } else if (ctx) {
              // Centre crop at most 640px wide: enough for a label, cheap for jsQR.
              const side = Math.min(video.videoWidth, video.videoHeight);
              const size = Math.min(side, 640);
              canvas.width = size;
              canvas.height = size;
              ctx.drawImage(
                video,
                (video.videoWidth - side) / 2,
                (video.videoHeight - side) / 2,
                side,
                side,
                0,
                0,
                size,
                size,
              );
              const img = ctx.getImageData(0, 0, size, size);
              const hit = jsQR(img.data, size, size, { inversionAttempts: 'dontInvert' });
              if (hit && handle(hit.data)) return;
            }
          } catch {
            // A single failed frame is not worth reporting; try the next one.
          }
        }
        timer = window.setTimeout(tick, SCAN_EVERY_MS);
      };
      tick();
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, [open]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    const code = parseTyped(typed, defaultType);
    if (!code) {
      setMessage('Use a code like 42, P42 or P-0042');
      return;
    }
    onCodeRef.current(code);
  };

  return (
    <dialog
      ref={dialogRef}
      className="scanner"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <>
          <header className="scanner__top">
            <p className="label scanner__title">{title}</p>
            <IconBox label="Close scanner" dark onClick={onClose}>
              <X strokeWidth={2.5} />
            </IconBox>
          </header>

          <div className="scanner__view">
            <video ref={videoRef} className="scanner__video" muted playsInline />
            <div className="scanner__frame" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            {cameraError && <p className="scanner__error">{cameraError}</p>}
          </div>

          <div className="scanner__bottom">
            <p className="scanner__msg" role="status" aria-live="assertive">
              {message ?? 'Point at a label'}
            </p>
            <form className="scanner__manual" onSubmit={submitTyped}>
              {torchSupported && (
                <IconBox
                  label={torchOn ? 'Torch off' : 'Torch on'}
                  dark
                  active={torchOn}
                  aria-pressed={torchOn}
                  onClick={toggleTorch}
                >
                  {torchOn ? <Flashlight strokeWidth={2.5} /> : <FlashlightOff strokeWidth={2.5} />}
                </IconBox>
              )}
              <label className="visually-hidden" htmlFor="scanner-code">
                Type the code
              </label>
              <input
                id="scanner-code"
                className="scanner__input num"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setMessage(null);
                }}
                placeholder={`${defaultType}-0042`}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
              />
              <Button type="submit" variant="accent" disabled={!typed.trim()}>
                Go
              </Button>
            </form>
          </div>
        </>
      )}
    </dialog>
  );
}
