import { Check, ImageDown, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AskResult } from "../api";
import { APP_NAME, canShareCard, CARD_COLORS } from "../shareCard";
import { useTheme } from "../theme";
import { PriceCard, type CardVariant } from "./PriceCard";

function fileName(question: string, variant: CardVariant): string {
  const slug = question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "price-card";
  return `${slug}-${variant}.png`;
}

export function ShareCardButton({ result, tone = "gold" }: { result: AskResult; tone?: "gold" | "quiet" | "compact" }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<CardVariant>("square");
  const [scale, setScale] = useState(0.34);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const allowed = canShareCard(result);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!open || !frame) return;
    const update = () => setScale(frame.clientWidth / 1080);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [open, variant]);

  if (!allowed) return null;

  const share = async () => {
    const node = cardRef.current?.firstElementChild as HTMLElement | null;
    if (!node) return;
    setBusy(true);
    setNote("");
    try {
      const { toPng } = await import("html-to-image");
      const height = variant === "square" ? 1080 : 1920;
      const dataUrl = await toPng(node, {
        pixelRatio: 1,
        width: 1080,
        height,
        canvasWidth: 1080,
        canvasHeight: height,
        style: { transform: "none" },
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName(result.question, variant), { type: "image/png" });
      const payload = { files: [file], title: APP_NAME, text: result.question };
      const canUseShare = typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare(payload);
      if (canUseShare) {
        try {
          await navigator.share(payload);
          setNote("Shared.");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = file.name;
      link.click();
      setNote("Image saved.");
    } catch {
      setNote("Could not create the image. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const height = variant === "square" ? 1080 : 1920;
  const buttonClass = tone === "compact"
    ? "focus-ring inline-flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl border border-line/10 bg-night-850 px-1 text-xs font-medium text-ink-300"
    : tone === "gold"
      ? "focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line/10 bg-night-850 px-5 py-2.5 text-sm font-semibold text-ink-100 hover:border-gulf-400/40 sm:w-auto"
      : "focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line/10 bg-night-850 px-3 text-sm font-medium text-ink-300 hover:bg-line/5";

  return (
    <>
      <button type="button" onClick={() => { setNote(""); setOpen(true); }} className={buttonClass}>
        <Share2 className="size-4" aria-hidden /> Share card
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[80] overflow-x-hidden overflow-y-auto bg-night-900/80 px-3 py-4 backdrop-blur-sm sm:px-6" role="dialog" aria-modal="true" aria-labelledby="share-card-title">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="share-card-title" className="font-display text-lg font-bold text-ink-100">Share card</h2>
              <div className="flex rounded-xl border border-line/10 p-1" role="group" aria-label="Card shape">
                {(["square", "story"] as const).map((option) => (
                  <button key={option} type="button" aria-pressed={variant === option} onClick={() => setVariant(option)} className={`focus-ring min-h-10 rounded-lg px-3 text-sm font-semibold capitalize ${variant === option ? "bg-gold-400 text-night-950" : "text-ink-300"}`}>
                    {option === "square" ? "Square" : "Story"}
                  </button>
                ))}
              </div>
            </div>
            <div ref={frameRef} className="mx-auto w-full max-w-[680px] overflow-hidden rounded-2xl">
              <div style={{ height: height * scale, overflow: "hidden" }}>
                <div ref={cardRef} style={{ width: 1080, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <PriceCard result={result} variant={variant} colors={CARD_COLORS[theme]} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void share()} disabled={busy} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-gulf-400 px-4 text-sm font-semibold text-night-950 hover:bg-gulf-300 disabled:opacity-60">
                <ImageDown className="size-4" aria-hidden /> {busy ? "Preparing…" : "Share image"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="focus-ring min-h-11 rounded-xl border border-line/10 px-4 text-sm font-medium text-ink-300">Close</button>
              {note && <p className="inline-flex items-center gap-1.5 text-sm text-ink-300" aria-live="polite">{note === "Shared." || note === "Image saved." ? <Check className="size-4 text-gulf-300" aria-hidden /> : null}{note}</p>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
