import { isDestination, lines } from "./network";
import type { Destination, Sample, Station } from "../types";

const transfers: [Destination, Destination][] = [
  [{ lineId: "bts-sukhumvit", stationId: "CEN" }, { lineId: "bts-silom", stationId: "CEN" }],
  [{ lineId: "bts-sukhumvit", stationId: "E4" }, { lineId: "mrt-blue", stationId: "BL22" }],
  [{ lineId: "bts-sukhumvit", stationId: "N8" }, { lineId: "mrt-blue", stationId: "BL13" }],
  [{ lineId: "bts-silom", stationId: "S2" }, { lineId: "mrt-blue", stationId: "BL26" }],
  [{ lineId: "bts-silom", stationId: "S12" }, { lineId: "mrt-blue", stationId: "BL34" }],
  [{ lineId: "mrt-blue", stationId: "BL10" }, { lineId: "mrt-purple", stationId: "PP16" }],
];
const key = (d: Destination) => `${d.lineId}:${d.stationId}`;

// Route over the complete network, including the supported BTS/MRT interchanges.
export function journeyRoute(
  origin: Destination | null,
  destination: Destination | null,
): Station[] {
  if (
    !origin ||
    !destination ||
    !isDestination(origin) ||
    !isDestination(destination)
  )
    return [];
  const stations = new Map<string, Station>();
  const neighbours = new Map<string, string[]>();
  const connect = (a: string, b: string) => {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  };
  for (const line of lines) {
    for (const station of line.stations)
      stations.set(key({ lineId: line.id, stationId: station.id }), station);
    for (const edge of line.edges ?? [])
      connect(key({ lineId: line.id, stationId: edge.from }), key({ lineId: line.id, stationId: edge.to }));
  }
  for (const [a, b] of transfers) connect(key(a), key(b));
  const start = key(origin), finish = key(destination);
  const queue: string[][] = [[start]];
  const seen = new Set([start]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    const last = path[path.length - 1];
    if (last === finish) return path.map((id) => stations.get(id)!);
    for (const next of neighbours.get(last) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

export function nearbyStations(sample: Sample, now = Date.now()) {
  if (
    sample.accuracy > 100 ||
    sample.accuracy <= 0 ||
    now - sample.timestamp > 20000 ||
    sample.timestamp > now + 5000
  )
    return [];
  return lines
    .flatMap((line) =>
      line.stations.map((station) => {
        const radians = Math.PI / 180;
        const x =
          (station.lng - sample.longitude) *
          radians *
          Math.cos(((station.lat + sample.latitude) * radians) / 2);
        const y = (station.lat - sample.latitude) * radians;
        return {
          destination: { lineId: line.id, stationId: station.id },
          distance: Math.round(Math.hypot(x, y) * 6371000),
        };
      }),
    )
    .filter((item) => item.distance <= 600)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
}
