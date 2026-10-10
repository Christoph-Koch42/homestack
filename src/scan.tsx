import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import Scanner from './Scanner';
import { useStore } from './store';
import { navigate, containerParam, lastContainer } from './nav';
import { useToast } from './ui/Toast';
import type { CodeType } from './codes';

interface ScanRequest {
  title: string;
  defaultType?: CodeType;
  // Return false to keep the scanner open (e.g. the target was not allowed).
  onCode: (code: string) => boolean | void;
}

const ScanContext = createContext<(req: ScanRequest) => void>(() => {});

export function ScanProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<(ScanRequest & { n: number }) | null>(null);
  const close = useCallback(() => setReq(null), []);
  const open = useCallback((r: ScanRequest) => setReq({ ...r, n: Date.now() }), []);

  // Mounted per request, so every scan starts with a fresh camera and empty state.
  return (
    <ScanContext.Provider value={open}>
      {children}
      {req && (
        <Scanner
          key={req.n}
          open
          title={req.title}
          defaultType={req.defaultType}
          onClose={close}
          onCode={(code) => {
            if (req.onCode(code) !== false) close();
          }}
        />
      )}
    </ScanContext.Provider>
  );
}

export function useScan() {
  return useContext(ScanContext);
}

// The main SCAN button: open a known place, or register a new label.
export function useScanAndOpen() {
  const scan = useScan();
  const { placeByCode, items } = useStore();
  const toast = useToast();

  return () =>
    scan({
      title: 'Scan a label',
      onCode: (code) => {
        if (code.startsWith('P-')) {
          const place = placeByCode.get(code);
          if (place) {
            navigate(`place/${place.id}`);
          } else {
            const near = lastContainer();
            navigate(`place/new?code=${code}${near ? `&in=${containerParam(near)}` : ''}`);
          }
          return;
        }
        const item = items.find((i) => i.code === code && i.status === 'active');
        if (item) {
          navigate(item.placeId ? `place/${item.placeId}?hl=${item.id}` : `room/${item.roomId}?hl=${item.id}`);
        } else {
          toast(`${code}: item labels come in release 2`);
        }
      },
    });
}
