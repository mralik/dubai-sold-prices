import { BookOpenText, Building2, Database, Moon, Sun } from "lucide-react";
import type { Meta } from "../api";
import { useTheme } from "../theme";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="focus-ring relative grid size-9 place-items-center overflow-hidden rounded-full border border-line/10 bg-line/[0.03] text-ink-300 transition hover:border-gulf-400/40 hover:text-gulf-300"
    >
      <Sun className={`absolute size-4 transition duration-300 ${theme === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0"}`} aria-hidden />
      <Moon className={`absolute size-4 transition duration-300 ${theme === "light" ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-90 opacity-0"}`} aria-hidden />
    </button>
  );
}

export function Logo() {
  return (
    <span aria-hidden className="grid size-9 place-items-center rounded-xl border border-line/10 bg-line/[0.04] text-ink-300">
      <Building2 className="size-5" />
    </span>
  );
}

export function Header({ meta }: { meta: Meta | null }) {
  const month = (value: string) => new Date(`${value}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const dataPeriod = meta ? (meta.dataFrom === meta.dataTo ? month(meta.dataTo) : `${month(meta.dataFrom)} – ${month(meta.dataTo)}`) : "";
  return (
    <header className="sticky top-0 z-30 border-b border-line/[0.06] bg-night-900/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="/" className="focus-ring flex items-center gap-3 rounded-xl">
          <Logo />
          <span className="hidden leading-tight sm:block">
            <span className="block font-display text-[15px] font-bold whitespace-nowrap text-ink-100">Dubai Sold Prices</span>
            <span className="hidden text-[11px] tracking-wide text-ink-400 sm:block">Dubai sales evidence</span>
          </span>
        </a>
        <div className="flex items-center gap-2 text-xs">
          {meta && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line/10 bg-line/[0.03] px-2 py-1.5 text-ink-300 sm:px-3">
              <Database className="size-3.5 text-ink-500" aria-hidden />
              {meta.sampleData ? "Sample data" : `DLD data · ${dataPeriod}`}
            </span>
          )}
          {meta && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium whitespace-nowrap ${
                meta.planner === "claude"
                  ? "border border-gulf-400/40 bg-gulf-400/10 text-gulf-300"
                  : "border border-line/10 bg-line/[0.03] text-ink-400"
              }`}
              title={meta.planner === "claude" ? `Questions are read by ${meta.model}` : "Questions are read by the built-in reader"}
            >
              {meta.planner === "claude" ? <span className="size-1.5 rounded-full bg-gulf-400" /> : <BookOpenText className="size-3.5" aria-hidden />}
              {meta.planner === "claude" ? "Claude" : "Built-in reader"}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
