import { getLine, getStation, isDestination, lines } from "./network";
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

function journeyDestinations(
  origin: Destination | null,
  destination: Destination | null,
): Destination[] {
  if (!origin || !destination || !isDestination(origin) || !isDestination(destination))
    return [];
  const destinations = new Map<string, Destination>();
  const neighbours = new Map<string, string[]>();
  const connect = (a: string, b: string) => {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  };
  for (const line of lines) {
    for (const station of line.stations) {
      const destination = { lineId: line.id, stationId: station.id };
      destinations.set(key(destination), destination);
    }
    for (const edge of line.edges ?? [])
      connect(
        key({ lineId: line.id, stationId: edge.from }),
        key({ lineId: line.id, stationId: edge.to }),
      );
  }
  for (const [a, b] of transfers) connect(key(a), key(b));
  const start = key(origin);
  const finish = key(destination);
  const queue: string[][] = [[start]];
  const seen = new Set([start]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    const last = path[path.length - 1];
    if (last === finish) return path.map((id) => destinations.get(id)!);
    for (const next of neighbours.get(last) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

export function journeyMapStops(
  origin: Destination | null,
  destination: Destination | null,
) {
  return journeyDestinations(origin, destination).map((place, index, route) => ({
    ...place,
    station: getStation(place)!,
    line: getLine(place.lineId)!,
    isTransfer: index > 0 && route[index - 1].lineId !== place.lineId,
  }));
}

// Route over the complete network, including the supported BTS/MRT interchanges.
export function journeyRoute(
  origin: Destination | null,
  destination: Destination | null,
): Station[] {
  return journeyDestinations(origin, destination).map((d) => getStation(d)!);
}

export function journeyEstimate(origin: Destination | null, destination: Destination | null) {
  const route = journeyDestinations(origin, destination);
  if (route.length < 2) return null;
  const transfers = route.slice(1).flatMap((stop, index) => {
    const from = route[index];
    if (from.lineId === stop.lineId) return [];
    return [{
      at: getStation(from)!.nameTh,
      walkTo: getStation(stop)!.nameTh,
      fromLine: getLine(from.lineId)!.name,
      toLine: getLine(stop.lineId)!.name,
    }];
  });
  const railStops = route.slice(1).filter((stop, index) => stop.lineId === route[index].lineId).length;
  const lineStops = new Map<string, number>();
  route.slice(1).forEach((stop, index) => {
    if (stop.lineId !== route[index].lineId) return;
    lineStops.set(stop.lineId, (lineStops.get(stop.lineId) ?? 0) + 1);
  });
  let fareMin = 0, fareMax = 0;
  const fareBreakdown = [...lineStops].map(([lineId, stops]) => {
    const isBTS = lineId.startsWith("bts-");
    const min = isBTS ? 17 : 16;
    const max = Math.min(isBTS ? 65 : 47, min + stops * (isBTS ? 3 : 2));
    fareMin += min;
    fareMax += max;
    return { lineId, lineName: getLine(lineId)!.name, min, max };
  });
  return {
    railStops,
    timeMin: railStops * 2 + transfers.length * 5,
    timeMax: railStops * 3 + transfers.length * 10 + 5,
    fareMin,
    fareMax,
    fareBreakdown,
    transfers,
  };
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
