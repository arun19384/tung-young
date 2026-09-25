import { getLine, getStation, isDestination, lines } from "./network";
import type { Destination, Sample, Station } from "../types";

const transfers: [Destination, Destination][] = [
  [
    { lineId: "bts-sukhumvit", stationId: "CEN" },
    { lineId: "bts-silom", stationId: "CEN" },
  ],
  [
    { lineId: "bts-sukhumvit", stationId: "E4" },
    { lineId: "mrt-blue", stationId: "BL22" },
  ],
  [
    { lineId: "bts-sukhumvit", stationId: "N8" },
    { lineId: "mrt-blue", stationId: "BL13" },
  ],
  [
    { lineId: "bts-silom", stationId: "S2" },
    { lineId: "mrt-blue", stationId: "BL26" },
  ],
  [
    { lineId: "bts-silom", stationId: "S12" },
    { lineId: "mrt-blue", stationId: "BL34" },
  ],
  [
    { lineId: "mrt-blue", stationId: "BL10" },
    { lineId: "mrt-purple", stationId: "PP16" },
  ],
];
const key = (d: Destination) => `${d.lineId}:${d.stationId}`;

function routeGraph() {
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
  return { destinations, neighbours };
}

export function journeyCandidates(
  origin: Destination,
  destination: Destination,
): Destination[][] {
  if (!isDestination(origin) || !isDestination(destination)) return [];
  const { destinations, neighbours } = routeGraph();
  const routes: Destination[][] = [];
  const visited = new Set<string>();
  const path: string[] = [];
  const visit = (current: string) => {
    visited.add(current);
    path.push(current);
    if (current === key(destination))
      routes.push(path.map((id) => destinations.get(id)!));
    else
      for (const next of neighbours.get(current) ?? []) {
        if (!visited.has(next)) visit(next);
      }
    path.pop();
    visited.delete(current);
  };
  visit(key(origin));
  return routes;
}

function journeyDestinations(
  origin: Destination | null,
  destination: Destination | null,
): Destination[] {
  if (
    !origin ||
    !destination ||
    !isDestination(origin) ||
    !isDestination(destination)
  )
    return [];
  const { destinations, neighbours } = routeGraph();
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
  selected?: Destination[],
) {
  return (selected ?? journeyDestinations(origin, destination)).map(
    (place, index, route) => ({
      ...place,
      station: getStation(place)!,
      line: getLine(place.lineId)!,
      isTransfer: index > 0 && route[index - 1].lineId !== place.lineId,
    }),
  );
}

// Route over the complete network, including the supported BTS/MRT interchanges.
export function journeyRoute(
  origin: Destination | null,
  destination: Destination | null,
): Station[] {
  return journeyDestinations(origin, destination).map((d) => getStation(d)!);
}

export function journeyEstimate(
  origin: Destination | null,
  destination: Destination | null,
  selected?: Destination[],
) {
  const route = selected ?? journeyDestinations(origin, destination);
  if (route.length < 2) return null;
  const transfers = route.slice(1).flatMap((stop, index) => {
    const from = route[index];
    if (from.lineId === stop.lineId) return [];
    return [
      {
        at: getStation(from)!.nameTh,
        walkTo: getStation(stop)!.nameTh,
        fromLine: getLine(from.lineId)!.name,
        toLine: getLine(stop.lineId)!.name,
      },
    ];
  });
  const railStops = route
    .slice(1)
    .filter((stop, index) => stop.lineId === route[index].lineId).length;
  return {
    railStops,
    timeMin: railStops * 2 + transfers.length * 5,
    timeMax: railStops * 3 + transfers.length * 10 + 5,
    transfers,
  };
}

export function journeyFareSegments(
  origin: Destination | null,
  destination: Destination | null,
  selected?: Destination[],
) {
  const route = selected ?? journeyDestinations(origin, destination);
  const segments: {
    network: "bts" | "mrt";
    from: Destination;
    to: Destination;
  }[] = [];
  let start = 0;
  const network = (lineId: string): "bts" | "mrt" =>
    lineId.startsWith("bts-") ? "bts" : "mrt";
  for (let index = 1; index <= route.length; index++) {
    if (
      index < route.length &&
      network(route[index].lineId) === network(route[start].lineId)
    )
      continue;
    const from = route[start];
    const to = route[index - 1];
    if (
      from &&
      to &&
      (from.lineId !== to.lineId || from.stationId !== to.stationId)
    )
      segments.push({ network: network(from.lineId), from, to });
    start = index;
  }
  return segments;
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
