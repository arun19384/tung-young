import type { Destination, Resolution, Sample } from "../types";
export async function resolveLocation(
  samples: Sample[],
  destination: Destination | null,
  signal: AbortSignal,
): Promise<Resolution> {
  const response = await fetch("/api/v1/location/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      samples,
      lineId: destination?.lineId,
      destinationStationId: destination?.stationId,
    }),
    signal,
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "ส่งตำแหน่งถี่เกินไป กรุณารอสักครู่"
        : "ติดต่อระบบติดตามไม่ได้ กำลังลองใหม่",
    );
  const data: Resolution = await response.json();
  if (typeof data.status !== "string" || typeof data.timestamp !== "number")
    throw new Error("ข้อมูลตำแหน่งไม่สมบูรณ์");
  return data;
}
