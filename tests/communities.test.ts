import { describe, expect, it } from "vitest";
import { canonicalCommunity, communityValues } from "../server/communities";

describe("community aliases", () => {
  it("maps JLT only to the confirmed JLT master community", () => {
    expect(canonicalCommunity("JLT")).toBe("JLT");
    expect(communityValues(["JLT"])).toEqual(["DMCC Master Community"]);
  });

  it("maps Al Furjan to its exact master project", () => {
    expect(canonicalCommunity("Al Furjan")).toBe("Al Furjan");
    expect(communityValues(["Al Furjan"])).toEqual(["Al Furjan"]);
  });

  it.each(["Damac Hills 2", "damac hills 2", "dh2", "akoya"])("maps %s only to DAMAC HILLS 2", (name) => {
    expect(canonicalCommunity(name)).toBe("Damac Hills 2");
    expect(communityValues(["Damac Hills 2"])).toEqual(["DAMAC HILLS 2"]);
  });
});
