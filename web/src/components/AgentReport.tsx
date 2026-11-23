import { Check, FileText, Link2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { AskResult } from "../api";
import type { AgentDetails } from "../report";
import { ShareCardButton } from "./ShareCardButton";

const ReportView = lazy(() => import("./ReportView"));
const STORAGE_KEY = "dubai-sold-prices-agent";
const EMPTY_AGENT: AgentDetails = { name: "", agency: "", note: "" };

function loadAgent(): AgentDetails {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<AgentDetails> | null;
    if (!parsed) return EMPTY_AGENT;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      agency: typeof parsed.agency === "string" ? parsed.agency : "",
      note: typeof parsed.note === "string" ? parsed.note : "",
    };
  } catch {
    return EMPTY_AGENT;
  }
}

export function AgentReport({ result, shareHref }: { result: AskResult; shareHref: string }) {
  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [agent, setAgent] = useState<AgentDetails>(loadAgent);
  const canReport = !result.unsupported && Boolean(result.summary && result.summary.count > 0);

  useEffect(() => {
    if (!reportOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReportOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [reportOpen]);

  if (!canReport) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = { name: agent.name.trim(), agency: agent.agency.trim(), note: agent.note.trim() };
    if (!clean.name) return;
    setAgent(clean);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch { /* storage blocked */ }
    setReportOpen(true);
  };

  return (
    <section className="card px-5 py-5 sm:px-7" aria-labelledby="report-action-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="report-action-heading" className="text-sm font-semibold text-ink-100">Share the evidence with a client</h2>
          <p className="mt-1 text-xs text-ink-400">Turn this answer into a branded, printable report.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <ShareCardButton result={result} />
          {shareHref && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(shareHref).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }).catch(() => setCopied(false));
              }}
              className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line/10 bg-night-850 px-5 py-2.5 text-sm font-semibold text-ink-100 hover:border-gulf-400/40 sm:w-auto"
            >
              {copied ? <Check className="size-4 text-gulf-300" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              {copied ? "Link copied" : "Copy link"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setFormOpen((open) => !open)}
            aria-expanded={formOpen}
            className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gold-400 px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:bg-gold-300 sm:w-auto"
          >
            <FileText className="size-4" aria-hidden />
            Create client report
          </button>
        </div>
      </div>

      {formOpen && (
        <form onSubmit={submit} className="mt-5 grid gap-4 border-t border-line/[0.07] pt-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-ink-300">
            Agent name <span className="text-ink-500">*</span>
            <input
              required
              autoComplete="name"
              value={agent.name}
              onChange={(event) => setAgent((current) => ({ ...current, name: event.target.value }))}
              className="focus-ring min-h-11 rounded-xl border border-line/10 bg-night-800 px-3 text-ink-100 placeholder:text-ink-500"
              placeholder="Your name"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-ink-300">
            Agency <span className="text-xs text-ink-500">optional</span>
            <input
              value={agent.agency}
              onChange={(event) => setAgent((current) => ({ ...current, agency: event.target.value }))}
              className="focus-ring min-h-11 rounded-xl border border-line/10 bg-night-800 px-3 text-ink-100 placeholder:text-ink-500"
              placeholder="Agency name"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-ink-300 sm:col-span-2">
            Note to the client <span className="text-xs text-ink-500">optional</span>
            <textarea
              rows={3}
              maxLength={400}
              value={agent.note}
              onChange={(event) => setAgent((current) => ({ ...current, note: event.target.value }))}
              className="focus-ring resize-y rounded-xl border border-line/10 bg-night-800 px-3 py-2.5 text-ink-100 placeholder:text-ink-500"
              placeholder="Add context or a recommendation for your client."
            />
          </label>
          <p className="text-xs leading-relaxed text-ink-500 sm:col-span-2">Saved only in this browser. No contact details are collected or sent to the server.</p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl bg-gulf-400 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-gulf-300">
              Preview report
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="focus-ring min-h-10 rounded-xl border border-line/10 px-4 py-2 text-sm font-medium text-ink-300 hover:bg-line/5">
              Cancel
            </button>
          </div>
        </form>
      )}

      {reportOpen && createPortal(
        <Suspense fallback={<div className="report-overlay grid place-items-center bg-night-900 text-ink-300">Preparing report…</div>}>
          <ReportView result={result} agent={agent} onClose={() => setReportOpen(false)} />
        </Suspense>,
        document.body,
      )}
    </section>
  );
}
