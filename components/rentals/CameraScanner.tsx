"use client";

// Scan barcodes with the phone's camera (PSG Rentals & Crew warehouse). Uses the browser's own
// barcode reader where it has one (Chrome on Android), otherwise ZXing, loaded only when the
// camera is opened (Safari on iPhone). The same code read again within a few seconds is ignored,
// so holding the camera on a sticker doesn't scan it twice.
import { useEffect, useRef, useState } from "react";

type Detector = { detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorCtor = { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };
const WANT = ["code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar", "qr_code", "data_matrix"];

export default function CameraScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef<{ code: string; at: number } | null>(null);
  const cb = useRef(onCode);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<string>("");
  useEffect(() => { cb.current = onCode; }, [onCode]);

  useEffect(() => {
    let stopped = false, stream: MediaStream | null = null, timer: ReturnType<typeof setTimeout> | null = null;
    let zxingStop: (() => void) | null = null;
    const hit = (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const now = Date.now();
      if (last.current && last.current.code === code && now - last.current.at < 3000) return;
      last.current = { code, at: now };
      try { navigator.vibrate?.(60); } catch { /* not on every phone */ }
      cb.current(code);
    };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError("This browser can't use the camera. Use a handheld scanner or type the barcode."); return; }
      const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      try {
        if (Ctor) {
          const supported = (await Ctor.getSupportedFormats?.().catch(() => WANT)) ?? WANT;
          const detector = new Ctor({ formats: WANT.filter(f => supported.includes(f)) });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (stopped || !video.current) return;
          video.current.srcObject = stream;
          await video.current.play();
          setEngine("built in");
          const tick = async () => {
            if (stopped || !video.current) return;
            try { for (const b of await detector.detect(video.current)) hit(b.rawValue); } catch { /* a frame that couldn't be read */ }
            timer = setTimeout(tick, 200);
          };
          tick();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stopped || !video.current) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video.current, result => { if (result) hit(result.getText()); });
          zxingStop = () => controls.stop();
          if (stopped) zxingStop();
          setEngine("ZXing");
        }
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(name === "NotAllowedError" ? "The camera was blocked. Allow camera access for the Hub in your browser's settings, or use a handheld scanner." : name === "NotFoundError" ? "No camera found on this device." : "The camera couldn't start. Use a handheld scanner or type the barcode.");
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      zxingStop?.();
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-2" aria-label="Camera scanner">
      {error ? <p role="alert" className="text-sm p-3" style={{ background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)" }}>{error}</p> : (
        <div className="relative w-full max-w-md overflow-hidden" style={{ background: "#000", aspectRatio: "4 / 3" }}>
          <video ref={video} playsInline muted className="w-full h-full object-cover" />
          {/* Aim box */}
          <div aria-hidden="true" className="absolute left-[10%] right-[10%] top-[35%] bottom-[35%]" style={{ border: "3px solid var(--tws-accent)", boxShadow: "0 0 0 2000px rgba(0,0,0,0.25)" }} />
        </div>
      )}
      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--tws-muted)" }}>
        <button type="button" onClick={onClose} className="text-sm font-semibold" style={{ color: "var(--tws-accent-ink)" }}>Close camera</button>
        {!error && <span>Hold the barcode inside the box{engine ? ` · reader: ${engine}` : ""}</span>}
      </div>
    </div>
  );
}
