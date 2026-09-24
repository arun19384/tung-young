import { useEffect, useRef, useState } from "react";
import type { Sample } from "../types";
export function useGeolocation(enabled: boolean, interval = 4000) {
  const [sample, setSample] = useState<Sample | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const last = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    if (!window.isSecureContext) {
      setError("กรุณาเปิดผ่าน HTTPS เพื่อใช้ตำแหน่ง");
      return;
    }
    if (!navigator.geolocation) {
      setError("เบราว์เซอร์นี้ไม่รองรับตำแหน่ง");
      return;
    }
    setError(null);
    last.current = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (
          p.timestamp <= last.current ||
          p.timestamp - last.current < interval
        )
          return;
        last.current = p.timestamp;
        setSample({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          speed: p.coords.speed,
          heading: p.coords.heading,
          timestamp: p.timestamp,
        });
        setError(null);
      },
      (e) =>
        setError(
          e.code === 1
            ? "ยังไม่ได้รับอนุญาตตำแหน่ง เปิดสิทธิ์ตำแหน่งในการตั้งค่าเว็บไซต์แล้วลองอีกครั้ง"
            : e.code === 2
              ? "หาตำแหน่งไม่เจอ เราจะติดตามต่อเมื่อรับสัญญาณได้"
              : "กำลังรอสัญญาณ GPS ใหม่",
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    const timer = window.setInterval(() => setNow(Date.now()), 2000);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(timer);
    };
  }, [enabled, interval]);
  return { sample, error, stale: !!sample && now - sample.timestamp > 20000 };
}
