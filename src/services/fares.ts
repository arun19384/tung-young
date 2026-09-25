import btsFareData from "../data/bts-fares.json";
import {
  journeyCandidates,
  journeyEstimate,
  journeyFareSegments,
} from "../data/journey";
import { getLine } from "../data/network";
import type { Destination } from "../types";

export interface FareQuote {
  total: number;
  items: { label: string; fare: number }[];
  passengerType: "adult-single-journey";
}

function btsFare(from: string, to: string) {
  const fromIndex = btsFareData.codes.indexOf(from);
  const toIndex = btsFareData.codes.indexOf(to);
  if (fromIndex < 0 || toIndex < 0)
    throw new Error("ไม่พบราคาคู่สถานี BTS นี้");
  return btsFareData.fares[fromIndex][toIndex];
}

export async function resolveExactFare(
  origin: Destination,
  destination: Destination,
  signal: AbortSignal,
  selected?: Destination[],
  lookup = new Map<string, Promise<number>>(),
): Promise<FareQuote> {
  const segments = journeyFareSegments(origin, destination, selected);
  const items = await Promise.all(
    segments.map(async (segment) => {
      if (segment.network === "bts") {
        return {
          label: "BTS",
          fare: btsFare(segment.from.stationId, segment.to.stationId),
        };
      }
      const cacheKey = [segment.from.stationId, segment.to.stationId]
        .sort()
        .join(":");
      if (!lookup.has(cacheKey))
        lookup.set(
          cacheKey,
          (async () => {
            const response = await fetch(
              `/api/v1/fares/mrt?from=${encodeURIComponent(segment.from.stationId)}&to=${encodeURIComponent(segment.to.stationId)}`,
              {
                signal,
                cache: "no-store",
              },
            );
            if (!response.ok) throw new Error("ตรวจราคาทางการไม่ได้ในขณะนี้");
            const result = (await response.json()) as { fare?: number };
            if (!Number.isInteger(result.fare) || result.fare! < 0)
              throw new Error("ข้อมูลราคาไม่สมบูรณ์");
            return result.fare!;
          })(),
        );
      const fare = await lookup.get(cacheKey)!;
      const lineIds = new Set([segment.from.lineId, segment.to.lineId]);
      return {
        label:
          lineIds.size > 1
            ? "MRT ม่วง–น้ำเงิน"
            : getLine(segment.from.lineId)!.name,
        fare,
      };
    }),
  );
  return {
    total: items.reduce((sum, item) => sum + item.fare, 0),
    items,
    passengerType: "adult-single-journey",
  };
}

export interface CheapestJourney {
  route: Destination[];
  fare: FareQuote;
}

export async function resolveCheapestJourney(
  origin: Destination,
  destination: Destination,
  signal: AbortSignal,
): Promise<CheapestJourney> {
  // Enumerate simple paths so alternatives at every supported interchange and
  // both directions of the Blue Line loop compete on the complete ticket price.
  const candidates = journeyCandidates(origin, destination);
  if (!candidates.length) throw new Error("ไม่พบเส้นทาง");
  const lookup = new Map<string, Promise<number>>();
  const ranked: CheapestJourney[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, candidates.length) }, async () => {
      while (cursor < candidates.length) {
        signal.throwIfAborted();
        const route = candidates[cursor++];
        const fare = await resolveExactFare(
          origin,
          destination,
          signal,
          route,
          lookup,
        );
        ranked.push({ route, fare });
      }
    }),
  );
  ranked.sort(
    (a, b) =>
      a.fare.total - b.fare.total ||
      journeyEstimate(origin, destination, a.route)!.transfers.length -
        journeyEstimate(origin, destination, b.route)!.transfers.length ||
      a.route.length - b.route.length,
  );
  return ranked[0];
}
