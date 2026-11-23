import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Building2, CalendarRange, Plus, Zap } from "lucide-react";
import { askQuestion, getMeta, type AskResult, type Meta } from "./api";
import { Header } from "./components/Header";
import { SearchBox } from "./components/SearchBox";
import { Examples } from "./components/Examples";
import { AnswerCard } from "./components/AnswerCard";
import { StatTiles } from "./components/StatTiles";
import { Interpretation } from "./components/Interpretation";
import { RecordsTable } from "./components/RecordsTable";
import { AgentReport } from "./components/AgentReport";
import { HowItWorks } from "./components/HowItWorks";
import { Footer } from "./components/Footer";
import { LoadingState, ErrorState, UnsupportedState } from "./components/States";
import { SnapshotSkeleton } from "./components/SnapshotSkeleton";
import { StaleDataNotice } from "./components/StaleDataNotice";
import { monthShort } from "./format";
import { answerSearch, answerUrl, dataVersionsDiffer, readAnswerSearch } from "./shareLink";

const TrendChart = lazy(() => import("./components/TrendChart").then((module) => ({ default: module.TrendChart })));
const HomeSnapshot = lazy(() => import("./components/HomeSnapshot"));

function ChartSkeleton() {
  return <div className="card h-80 animate-pulse bg-line/[0.03]" aria-label="Loading chart" />;
}

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkData, setLinkData] = useState<string | null>(() => readAnswerSearch(window.location.search).data);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const openedFromLink = useRef(readAnswerSearch(window.location.search).question);

  useEffect(() => {
    getMeta().then(setMeta).catch((e: Error) => setError(e.message));
  }, []);

  // Bring the answer into view when a new one arrives.
  useEffect(() => {
    if (!result || loading) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [result, loading]);

  const submit = useCallback(async (q: string, source: "link" | "user" = "user") => {
    const text = q.trim();
    if (text.length < 3) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (source === "user") setLinkData(null);
    setQuestion(text);
    setLoading(true);
    setError(null);
    try {
      // Short minimum so the AI steps are readable even when the answer is instant.
      const [res] = await Promise.all([askQuestion(text, controller.signal), new Promise((r) => setTimeout(r, 900))]);
      setResult(res);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const questionFromLink = openedFromLink.current;
    if (questionFromLink.length >= 3) void submit(questionFromLink, "link");
  }, [submit]);

  useEffect(() => {
    if (!result || !meta || loading || dataVersionsDiffer(linkData, meta.dataTo)) return;
    const next = answerSearch(result.question, meta.dataTo);
    if (`${window.location.pathname}${window.location.search}` !== `/${next}`) {
      window.history.replaceState(null, "", next);
    }
  }, [result, meta, loading, linkData]);

  const facts = meta
    ? [
        { icon: Building2, text: `${meta.areas.length} areas` },
        { icon: BadgeCheck, text: `${meta.totalSales.toLocaleString("en-US")} sales` },
        { icon: CalendarRange, text: `${monthShort(meta.dataFrom)} – ${monthShort(meta.dataTo)}` },
        { icon: Zap, text: "Answers in under a second" },
      ]
    : [];

  const compactHero = Boolean(result) || loading;
  const onQuestionChange = (value: string) => {
    setQuestion(value);
    if (!value.trim()) {
      abortRef.current?.abort();
      setResult(null);
      setError(null);
      setLoading(false);
      setLinkData(null);
      window.history.replaceState(null, "", window.location.pathname);
    }
  };
  const newQuestion = () => {
    abortRef.current?.abort();
    setQuestion("");
    setResult(null);
    setError(null);
    setLinkData(null);
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const staleData = result && meta && dataVersionsDiffer(linkData, meta.dataTo) ? linkData : null;
  const shareHref = result && meta ? answerUrl(window.location.origin, result.question, meta.dataTo) : "";
  const searchBadge = meta?.planner === "claude" ? "AI property search" : "Property sales search";

  return (
    <div className="backdrop min-h-dvh overflow-x-clip">
      <Header meta={meta} />

      {!compactHero && (
        <section className="relative overflow-hidden">
          <div className="pattern pointer-events-none absolute inset-0 opacity-[0.035]" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-4 pt-8 pb-2 sm:px-6 sm:pt-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-line/10 bg-line/[0.03] px-3.5 py-1.5 text-xs font-medium text-ink-300 backdrop-blur">
              <span className="relative inline-flex size-2 rounded-full bg-gulf-400" />
              {searchBadge} · Dubai, UAE
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl leading-[1.05] font-extrabold tracking-tight text-balance text-ink-100 sm:text-5xl">
              What did Dubai homes <span className="text-gold-300">actually sell for?</span>
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-300">Start from a place below, or ask your own question.</p>
          </div>
        </section>
      )}

      {compactHero && (
        <section className="relative overflow-hidden">
          <div className="pattern pointer-events-none absolute inset-0 opacity-[0.035]" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 pt-6 pb-8 text-center sm:px-6 sm:pt-8 sm:pb-10">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line/10 bg-line/[0.03] px-3.5 py-1.5 text-xs font-medium text-ink-300 backdrop-blur">
              <span className="relative inline-flex size-2 rounded-full bg-gulf-400" />
              {searchBadge} · Dubai, UAE
            </p>
            <div className="mx-auto mt-3 flex max-w-3xl items-center justify-center gap-3">
              <h1 className="text-2xl leading-[1.05] font-extrabold tracking-tight text-balance text-ink-100 sm:text-3xl">
                Dubai sales <span className="text-gold-300">evidence</span>
              </h1>
              <button type="button" onClick={newQuestion} className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line/10 bg-night-850/70 px-3 py-2 text-xs font-semibold text-gulf-300 hover:border-gulf-400/35 hover:bg-gulf-400/[0.06]">
                <Plus className="size-3.5" aria-hidden /> New question
              </button>
            </div>
            <div className="mx-auto mt-5 max-w-3xl">
              <SearchBox value={question} onChange={onQuestionChange} onSubmit={(value) => void submit(value)} loading={loading} />
            </div>
          </div>
        </section>
      )}

      <main className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div ref={resultsRef} aria-live="polite" aria-busy={loading} className="mt-6 flex scroll-mt-24 flex-col gap-5">
          {!loading && !result && !error && (
            <div className="order-2 md:order-1">
              <Suspense fallback={<SnapshotSkeleton />}>
                <HomeSnapshot onAsk={(q) => void submit(q)} />
              </Suspense>
            </div>
          )}
          {!compactHero && (
            <section className="order-1 md:order-2" aria-labelledby="ask-heading">
              <h2 id="ask-heading" className="text-sm font-semibold text-ink-100">Ask about a place</h2>
              <div className="mt-3">
                <SearchBox value={question} onChange={onQuestionChange} onSubmit={(value) => void submit(value)} loading={loading} />
                <Examples examples={(meta?.examples ?? []).slice(0, 4)} onPick={(q) => void submit(q)} disabled={loading} />
              </div>
              {facts.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-400">
                  {facts.map(({ icon: Icon, text }) => (
                    <li key={text} className="inline-flex items-center gap-1.5">
                      <Icon className="size-3.5 text-ink-500" aria-hidden />
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {loading && <LoadingState />}
          {!loading && error && <div className="order-3"><ErrorState message={error} onRetry={question ? () => void submit(question) : undefined} /></div>}
          {!loading && !error && result && (
            result.unsupported ? (
              <UnsupportedState result={result} onPick={(q) => void submit(q)} />
            ) : (
              <>
                {staleData && <StaleDataNotice dataVersion={staleData} onLatest={() => meta && setLinkData(meta.dataTo)} />}
                <AnswerCard result={result} />
                <AgentReport result={result} shareHref={shareHref} />
                {result.summary && result.summary.count > 0 && <StatTiles result={result} />}
                <Interpretation result={result} />
                {result.summary && result.summary.count > 0 && result.series.length >= 2 && (
                  <Suspense fallback={<ChartSkeleton />}><TrendChart result={result} /></Suspense>
                )}
                {result.records.length > 0 && <RecordsTable result={result} />}
              </>
            )
          )}
          {!loading && !result && !error && <div className="order-3"><HowItWorks meta={meta} /></div>}
        </div>
      </main>

      <Footer meta={meta} />
    </div>
  );
}
