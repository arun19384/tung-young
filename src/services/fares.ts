import btsFareData from "../data/bts-fares.json";
import { journeyFareSegments } from "../data/journey";
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
  if (fromIndex < 0 || toIndex < 0) throw new Error("ไม่พบราคาคู่สถานี BTS นี้");
  return btsFareData.fares[fromIndex][toIndex];
}

export async function resolveExactFare(
  origin: Destination,
  destination: Destination,
  signal: AbortSignal,
): Promise<FareQuote> {
  const segments = journeyFareSegments(origin, destination);
  const items = await Promise.all(segments.map(async (segment) => {
    if (segment.network === "bts") {
      return {
        label: "BTS",
        fare: btsFare(segment.from.stationId, segment.to.stationId),
      };
    }
    const response = await fetch(`/api/v1/fares/mrt?from=${encodeURIComponent(segment.from.stationId)}&to=${encodeURIComponent(segment.to.stationId)}`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("ตรวจราคาทางการไม่ได้ในขณะนี้");
    const result = await response.json() as { fare?: number };
    if (!Number.isInteger(result.fare) || result.fare! < 0) throw new Error("ข้อมูลราคาไม่สมบูรณ์");
    const lineIds = new Set([segment.from.lineId, segment.to.lineId]);
    return {
      label: lineIds.size > 1 ? "MRT ม่วง–น้ำเงิน" : getLine(segment.from.lineId)!.name,
      fare: result.fare!,
    };
  }));
  return {
    total: items.reduce((sum, item) => sum + item.fare, 0),
    items,
    passengerType: "adult-single-journey",
  };
}
