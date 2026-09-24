import { describe, expect, it } from "vitest";
import { journeyRoute, nearbyStations } from "./journey";
import { getStation } from "./network";
const station = (stationId: string, lineId = "bts-sukhumvit") => ({
  stationId,
  lineId,
});
describe("journey planning", () => {
  it("counts stops in either direction without counting the boarding station", () => {
    expect(
      journeyRoute(station("E4"), station("CEN")).map((s) => s.id),
    ).toEqual(["E4", "E3", "E2", "E1", "CEN"]);
    expect(journeyRoute(station("CEN"), station("E4"))).toHaveLength(5);
  });
  it("routes the Blue Line through Tha Phra instead of jumping BL32 to BL33", () => {
    expect(
      journeyRoute(
        station("BL32", "mrt-blue"),
        station("BL33", "mrt-blue"),
      ).map((s) => s.id),
    ).toEqual(["BL32", "BL01", "BL33"]);
  });
  it("does not invent a cross-line route or a stop at the origin", () => {
    expect(journeyRoute(station("E4"), station("BL01", "mrt-blue"))).toEqual(
      [],
    );
    expect(journeyRoute(station("E4"), station("E4"))).toHaveLength(1);
    expect(journeyRoute(null, station("E4"))).toEqual([]);
  });
  it("suggests nearby stations for confirmation only with a fresh accurate fix", () => {
    const s = getStation(station("E4"))!;
    const sample = {
      latitude: s.lat,
      longitude: s.lng,
      accuracy: 10,
      timestamp: 100000,
      speed: null,
      heading: null,
    };
    expect(
      nearbyStations(sample, 100000).some(
        (x) => x.destination.stationId === "E4",
      ),
    ).toBe(true);
    expect(nearbyStations({ ...sample, accuracy: 500 }, 100000)).toEqual([]);
    expect(nearbyStations(sample, 121000)).toEqual([]);
    expect(
      nearbyStations({ ...sample, latitude: 0, longitude: 0 }, 100000),
    ).toEqual([]);
  });
});
