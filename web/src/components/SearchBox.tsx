import { ArrowRight, Loader2, Search } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  loading: boolean;
}

export function SearchBox({ value, onChange, onSubmit, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Press "/" anywhere to jump to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      className="glow-border relative flex items-center rounded-2xl bg-night-850/90 p-2 shadow-[0_18px_40px_-24px_rgb(0_0_0/0.55)] backdrop-blur-xl transition focus-within:shadow-[0_20px_45px_-22px_rgb(14_140_127/0.32)]"
    >
      <label htmlFor="question" className="sr-only">Ask about Dubai property sales</label>
      <Search className="ml-3 size-5 shrink-0 text-ink-500" aria-hidden />
      <input
        ref={inputRef}
        id="question"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={300}
        autoComplete="off"
        placeholder="Ask anything, e.g. 2-bed in JVC, last 6 months"
        className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-base text-ink-100 placeholder:text-ink-500 focus:outline-none sm:text-lg"
      />
      <kbd className="mr-2 hidden rounded-md border border-line/10 px-1.5 py-0.5 text-[11px] text-ink-500 md:inline">/</kbd>
      <button
        type="submit"
        disabled={loading || value.trim().length < 3}
        className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-night-950 transition hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-40 sm:px-6"
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
        <span className="hidden sm:inline">{loading ? "Checking" : "Search"}</span>
        <span className="sr-only sm:hidden">{loading ? "Checking" : "Search"}</span>
      </button>
    </form>
  );
}
