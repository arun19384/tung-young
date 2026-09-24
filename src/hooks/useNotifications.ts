import { useCallback, useEffect, useRef, useState } from "react";
import { read, save } from "../services/storage";
import type { Resolution } from "../types";
export function useNotifications(
  result: Resolution | null,
  active: boolean,
  tripKey: string,
) {
  const [enabled, setEnabled] = useState(() => read("alert") === true);
  const threshold = 1;
  const [message, setMessage] = useState("");
  const [capability, setCapability] = useState("");
  const fired = useRef(new Set<string>());
  useEffect(() => {
    fired.current.clear();
    setMessage("");
  }, [tripKey]);
  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      save("alert", false);
      setMessage("");
      return;
    }
    if ("Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        setCapability(
          permission === "granted"
            ? ""
            : "ไม่ได้รับสิทธิ์แจ้งเตือน จะแสดงเตือนภายในแอป",
        );
      } catch {
        setCapability("เครื่องนี้ใช้การเตือนภายในแอป");
      }
    } else {
      setCapability(
        "เครื่องนี้ใช้การเตือนภายในแอป บน iPhone ให้เพิ่มไปยังหน้าจอโฮมก่อน",
      );
    }
    setEnabled(true);
    save("alert", true);
  }, [enabled]);
  useEffect(() => {
    if (
      !active ||
      !enabled ||
      !result?.destination ||
      result.wrongDirection ||
      result.confidence < 0.5 ||
      Date.now() - result.timestamp > 20000 ||
      result.remainingStations > threshold
    )
      return;
    const key = result.arrived ? "arrived" : "approaching";
    if (fired.current.has(key)) return;
    fired.current.add(key);
    const body = result.arrived
      ? `ถึง${result.destination.nameTh}แล้ว เดินทางปลอดภัยนะ`
      : `อีก ${result.remainingStations} สถานีถึง${result.destination.nameTh} เตรียมตัวลงได้เลย`;
    setMessage(body);
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      "serviceWorker" in navigator
    )
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (reg)
            return reg.showNotification("ถึงยัง 🚆", {
              body,
              icon: "/icons/train-shadow-192.png",
              badge: "/icons/train-shadow-192.png",
              tag: `trip-${key}`,
              data: { url: "/" },
            });
        })
        .catch(() =>
          setCapability("ส่งแจ้งเตือนระบบไม่ได้ แต่แสดงเตือนในแอปแล้ว"),
        );
  }, [result, active, enabled, threshold]);
  return { enabled, toggle, message, capability };
}
