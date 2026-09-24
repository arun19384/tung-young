import { useEffect, useRef, useState } from "react";
import { resolveLocation } from "../services/api";
import type { Destination, Resolution, Sample } from "../types";
export function useTripTracking(
  sample: Sample | null,
  destination: Destination | null,
  enabled: boolean,
) {
  const history = useRef<Sample[]>([]);
  const [resolved, setResolved] = useState<{
    key: string;
    value: Resolution;
  } | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = destination
    ? `${destination.lineId}:${destination.stationId}`
    : "";
  useEffect(() => {
    history.current = [];
    setResolved(null);
    setIssue(null);
  }, [key]);
  useEffect(() => {
    if (!enabled) {
      history.current = [];
      setBusy(false);
      return;
    }
    if (!sample || Date.now() - sample.timestamp > 20000) return;
    history.current = [
      ...history.current.filter(
        (s) =>
          s.timestamp < sample.timestamp &&
          sample.timestamp - s.timestamp < 60000,
      ),
      sample,
    ].slice(-12);
    const controller = new AbortController();
    let live = true;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setBusy(true);
    resolveLocation(history.current, destination, controller.signal)
      .then((next) => {
        if (!live) return;
        if (next.status === "tracking" || next.status === "arrived") {
          setResolved({ key, value: next });
          setIssue(null);
        } else {
          setIssue(next.message || "กำลังยืนยันตำแหน่ง");
        }
      })
      .catch((e) => {
        if (live)
          setIssue(
            e.name === "AbortError" ? "ระบบตอบช้า กำลังลองใหม่" : e.message,
          );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (live) setBusy(false);
      });
    return () => {
      live = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [sample, key, enabled]);
  return { result: resolved?.key === key ? resolved.value : null, issue, busy };
}
