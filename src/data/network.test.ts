import { describe, it, expect } from "vitest";
import { lines, isDestination, demoStations } from "./network";
describe("station catalogue", () => {
  it("covers four connected lines with valid destinations", () => {
    expect(lines).toHaveLength(4);
    expect(lines.reduce((n, l) => n + l.stations.length, 0)).toBe(115);
    expect(isDestination({ lineId: "bts-sukhumvit", stationId: "CEN" })).toBe(
      true,
    );
    expect(isDestination({ lineId: "bts-sukhumvit", stationId: "BL01" })).toBe(
      false,
    );
    expect(isDestination(null)).toBe(false);
  });
  it("keeps the demo in actual travel order", () => {
    expect(demoStations.map((s) => s.id)).toEqual([
      "E4",
      "E3",
      "E2",
      "E1",
      "CEN",
    ]);
  });
});
