import { monthLong } from "./format";

const DATA_VERSION = /^\d{4}-(0[1-9]|1[0-2])$/;

export function answerSearch(question: string, dataVersion: string): string {
  const params = new URLSearchParams();
  params.set("q", question);
  params.set("data", dataVersion);
  return `?${params.toString()}`;
}

export function answerUrl(origin: string, question: string, dataVersion: string): string {
  return `${origin.replace(/\/$/, "")}/${answerSearch(question, dataVersion)}`;
}

export function readAnswerSearch(search: string): { question: string; data: string | null } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const question = params.get("q")?.trim() ?? "";
  const data = params.get("data")?.trim() ?? "";
  return { question, data: DATA_VERSION.test(data) ? data : null };
}

export function dataVersionsDiffer(linkData: string | null, loadedData: string): boolean {
  return linkData !== null && linkData !== loadedData;
}

export function staleDataMessage(dataVersion: string): string {
  return `This answer used data up to ${monthLong(dataVersion)}`;
}
