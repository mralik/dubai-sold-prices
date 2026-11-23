import { Receipt } from "lucide-react";
import type { AskResult } from "../api";
import { aed, dateShort, num, roomsLabel } from "../format";

export function RecordsTable({ result }: { result: AskResult }) {
  const total = result.summary?.count ?? 0;
  return (
    <section className="card overflow-hidden" aria-labelledby="records-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 sm:px-7">
        <h2 id="records-heading" className="flex items-center gap-2 text-sm font-semibold text-ink-100">
          <Receipt className="size-4 text-ink-500" aria-hidden />
          Sales behind this answer
        </h2>
        <p className="text-xs text-ink-400">Latest {result.records.length} of {num(total)}</p>
      </div>

      {/* Phones: one compact card per sale */}
      <ul className="mt-4 divide-y divide-line/[0.05] border-t border-line/[0.06] sm:hidden">
        {result.records.map((r) => (
          <li key={r.transaction_id} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-100">{r.area_name_en}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                <span className="capitalize">{r.property_type}</span> · {roomsLabel(r.rooms)} · {num(r.size_sqft)} sq ft
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                {dateShort(r.instance_date)}
                {r.registration === "off-plan" && (
                  <span className="rounded border border-line/10 bg-line/[0.03] px-1 text-[10px] font-medium text-ink-400">Off-plan</span>
                )}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold text-gold-200 tabular-nums">{aed(r.price_aed)}</p>
              <p className="text-xs text-ink-500 tabular-nums">{num(r.price_per_sqft)}/sq ft</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Larger screens: full table */}
      <div className="mt-4 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-y border-line/[0.06] bg-line/[0.02] text-xs text-ink-400">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-medium sm:px-7">Date</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Area · project</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Size (sq ft)</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Price</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium sm:px-7">Per sq ft</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/[0.05]">
            {result.records.map((r) => (
              <tr key={r.transaction_id}>
                <td className="px-5 py-3 whitespace-nowrap text-ink-400 tabular-nums sm:px-7">{dateShort(r.instance_date)}</td>
                <td className="px-3 py-3">
                  <span className="font-medium text-ink-100">{r.area_name_en}</span>
                  <span className="block text-xs text-ink-500">{r.project_name}</span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-ink-300">
                  <span className="capitalize">{r.property_type}</span> · {roomsLabel(r.rooms)}
                  {r.registration === "off-plan" && (
                    <span className="ml-2 rounded-md border border-line/10 bg-line/[0.03] px-1.5 py-0.5 text-[11px] font-medium text-ink-400">Off-plan</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-ink-300 tabular-nums">{num(r.size_sqft)}</td>
                <td className="px-3 py-3 text-right font-semibold text-gold-200 tabular-nums">{aed(r.price_aed)}</td>
                <td className="px-5 py-3 text-right text-ink-300 tabular-nums sm:px-7">{num(r.price_per_sqft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
