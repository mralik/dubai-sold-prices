import { ListChecks, ShieldCheck, Table2 } from "lucide-react";
import type { Meta } from "../api";

const STEPS = [
  { icon: ListChecks, title: "Your question becomes a clear plan", text: "The reader picks the area, property type, bedrooms, period and measure from a fixed list. It never writes SQL." },
  { icon: ShieldCheck, title: "Code builds a safe query", text: "The plan is checked, then turned into a read-only query with a placeholder for every value." },
  { icon: Table2, title: "Numbers come from the records", text: "Every figure is calculated from matching sales, and you can see each sale it used." },
];

export function HowItWorks(_props: { meta: Meta | null }) {
  return (
    <section aria-labelledby="how-heading" className="pt-6">
      <h2 id="how-heading" className="text-center text-[11px] font-semibold tracking-[0.18em] text-ink-500 uppercase">How it works</h2>
      <p className="mt-2 text-center font-display text-2xl font-bold text-ink-100 sm:text-3xl">Evidence you can check, not just trust</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="card relative px-5 py-6">
            <span className="absolute top-5 right-5 font-display text-4xl font-extrabold text-line/[0.05]">0{i + 1}</span>
            <span className="grid size-10 place-items-center rounded-xl border border-line/10 bg-line/[0.03] text-ink-400">
              <Icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-semibold text-ink-100">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
