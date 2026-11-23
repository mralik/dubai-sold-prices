import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ask } from "../server/ask";
import type { AskResult } from "../server/ask";
import { aed, num } from "../web/src/format";
import { AnswerCard } from "../web/src/components/AnswerCard";
import { PriceCard } from "../web/src/components/PriceCard";
import { canShareCard, DLD_SOURCE_LINE } from "../web/src/shareCard";
import { NOT_AFFILIATED_LINE } from "../web/src/dataSource";

describe("share card", () => {
  it("shows the same median, count and source line as the answer", async () => {
    const result = await ask("What did 1-bed apartments in JVC sell for?");
    const html = renderToStaticMarkup(createElement(PriceCard, { result, variant: "square" }));
    expect(result.summary).toBeTruthy();
    expect(html).toContain(`data-median-price="${result.summary!.medianPrice}"`);
    expect(html).toContain(aed(result.summary!.medianPrice));
    expect(html).toContain(`data-sales-count="${result.summary!.count}"`);
    expect(html).toContain(num(result.summary!.count));
    expect(html).toContain(result.dataAttribution);
    // Sample data must not claim DLD as its source.
    expect(html).not.toContain(DLD_SOURCE_LINE);
    expect(html).toContain(">JVC<");
    expect(html).not.toContain("dubai-sold-prices.example");
  });

  it("credits DLD with a link and says it is not affiliated when the data is real", async () => {
    const sample = await ask("What did 1-bed apartments in JVC sell for?");
    const result = { ...sample, dataAttribution: DLD_SOURCE_LINE };
    const html = renderToStaticMarkup(createElement(PriceCard, { result, variant: "square" }));
    expect(html).toContain(DLD_SOURCE_LINE);
    expect(html).toContain("data.dubai/en/l/470061");
    expect(html).toContain(NOT_AFFILIATED_LINE);
  });

  it("shows the same ready and off-plan split as the answer", async () => {
    const result = await ask("What did 1-bed apartments in JVC sell for?");
    expect(result.registrationSplit).toBeTruthy();
    expect(result.registrationSplit!.offPlan.count).toBeGreaterThanOrEqual(10);
    expect(result.registrationSplit!.ready.count).toBeGreaterThanOrEqual(10);
    const card = renderToStaticMarkup(createElement(PriceCard, { result, variant: "square" }));
    const answer = renderToStaticMarkup(createElement(AnswerCard, { result }));
    expect(card).toContain(result.registrationSplit!.offPlan.line);
    expect(card).toContain(result.registrationSplit!.ready.line);
    expect(answer).toContain(result.registrationSplit!.offPlan.line);
    expect(answer).toContain(result.registrationSplit!.ready.line);
  });

  it("stays hidden when the answer is unsupported or has no sales", () => {
    expect(canShareCard({ unsupported: "I can't answer that.", summary: null } as AskResult)).toBe(false);
    expect(canShareCard({ unsupported: null, summary: { count: 0 } } as AskResult)).toBe(false);
    expect(canShareCard({ unsupported: null, summary: { count: 4 } } as AskResult)).toBe(true);
  });
});
