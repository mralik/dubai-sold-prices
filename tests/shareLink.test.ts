import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StaleDataNotice } from "../web/src/components/StaleDataNotice";
import { answerSearch, answerUrl, dataVersionsDiffer, readAnswerSearch, staleDataMessage } from "../web/src/shareLink";

describe("share link", () => {
  it("keeps the question and the data version", () => {
    const search = answerSearch("What did 1-bed apartments in JVC sell for?", "2026-10");
    expect(search).toContain("data=2026-10");
    expect(readAnswerSearch(search)).toEqual({
      question: "What did 1-bed apartments in JVC sell for?",
      data: "2026-10",
    });
    expect(answerUrl("http://localhost:5173", "What did 1-bed apartments in JVC sell for?", "2026-10")).toBe(
      `http://localhost:5173/${search}`,
    );
  });

  it("names the older data month and offers the latest numbers", () => {
    expect(dataVersionsDiffer("2026-09", "2026-10")).toBe(true);
    expect(dataVersionsDiffer("2026-10", "2026-10")).toBe(false);
    expect(staleDataMessage("2026-10")).toBe("This answer used data up to October 2026");
    const html = renderToStaticMarkup(createElement(StaleDataNotice, { dataVersion: "2026-10", onLatest: () => undefined }));
    expect(html).toContain("This answer used data up to October 2026");
    expect(html).toContain("Latest numbers");
  });
});
