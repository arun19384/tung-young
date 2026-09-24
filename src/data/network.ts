import network from "./network.json";
import type { Destination, Line } from "../types";
export const lines: Line[] = network.lines;
export const getLine = (id: string) => lines.find((line) => line.id === id);
export const getStation = (d: Destination) =>
  getLine(d.lineId)?.stations.find((s) => s.id === d.stationId);
export const demoStations = ["E4", "E3", "E2", "E1", "CEN"].map((id) =>
  lines[0].stations.find((s) => s.id === id)!,
);
export function isDestination(value: unknown): value is Destination {
  if (!value || typeof value !== "object") return false;
  const d = value as Destination;
  return (
    typeof d.lineId === "string" &&
    typeof d.stationId === "string" &&
    !!getStation(d)
  );
}
