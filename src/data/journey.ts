import { getLine, isDestination, lines } from "./network";
import type { Destination, Sample, Station } from "../types";

// Use the rail graph: the Blue Line branches at Tha Phra, so array order is not a route.
export function journeyRoute(
  origin: Destination | null,
  destination: Destination | null,
): Station[] {
  if (
    !origin ||
    !destination ||
    !isDestination(origin) ||
    !isDestination(destination) ||
    origin.lineId !== destination.lineId
  )
    return [];
  const line = getLine(origin.lineId)!;
  const queue: string[][] = [[origin.stationId]];
  const seen = new Set([origin.stationId]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    const last = path[path.length - 1];
    if (last === destination.stationId)
      return path.map((id) => line.stations.find((s) => s.id === id)!);
    for (const edge of line.edges ?? []) {
      const next =
        edge.from === last ? edge.to : edge.to === last ? edge.from : null;
      if (next && !seen.has(next)) {
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
