import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Banknote,
  Check,
  ChevronRight,
  Crosshair,
  Download,
  Info,
  LoaderCircle,
  Clock3,
  MapPin,
  Square,
  Repeat2,
  TrainFront,
  X,
} from "lucide-react";
import { DestinationSearch } from "./components/DestinationSearch";
import { Modal } from "./components/Modal";
import { RouteMap } from "./components/RouteMap";
import { getLine, getStation, isDestination } from "./data/network";
import { journeyEstimate, journeyRoute, nearbyStations } from "./data/journey";
import { useGeolocation } from "./hooks/useGeolocation";
import { useTripTracking } from "./hooks/useTripTracking";
import { useNotifications } from "./hooks/useNotifications";
import { usePWA } from "./hooks/usePWA";
import { useWakeLock } from "./hooks/useWakeLock";
import { read, save } from "./services/storage";
import { resolveCheapestJourney, type FareQuote } from "./services/fares";
import type { Destination } from "./types";
import "./journey.css";

interface Trip {
  origin: Destination;
  destination: Destination;
  startedAt: number;
  route?: Destination[];
}
function savedTrip(): Trip | null {
  const value = read("active-trip") as Trip | null;
  return value &&
    isDestination(value.origin) &&
    isDestination(value.destination) &&
    (!value.route || (Array.isArray(value.route) && value.route.length > 1 && value.route.every(isDestination))) &&
    journeyRoute(value.origin, value.destination).length > 1 &&
    Number.isFinite(value.startedAt) &&
    Date.now() - value.startedAt >= 0 &&
    Date.now() - value.startedAt < 12 * 60 * 60 * 1000
    ? value
    : null;
}

export default function App() {
  const [trip, setTrip] = useState<Trip | null>(savedTrip);
  const [origin, setOrigin] = useState<Destination | null>(
    () => trip?.origin ?? null,
  );
  const [destination, setDestination] = useState<Destination | null>(
    () => trip?.destination ?? null,
  );
  const [search, setSearch] = useState<"origin" | "destination" | null>(null);
  const [info, setInfo] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStarted, setScanStarted] = useState(0);
  const [scanMessage, setScanMessage] = useState("");
  const [originSource, setOriginSource] = useState("เลือกเอง");
  const [visible, setVisible] = useState(
    document.visibilityState === "visible",
  );
  const [freshAfter, setFreshAfter] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [keepAwake, setKeepAwake] = useState(true);
  const [fare, setFare] = useState<FareQuote | null>(null);
  const [fareIssue, setFareIssue] = useState("");
  const [fareBusy, setFareBusy] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Destination[]>(
    () => trip?.route ?? [],
  );
  const [recent, setRecent] = useState<Destination[]>(() => {
    const value = read("recent");
    return Array.isArray(value) ? value.filter(isDestination).slice(0, 3) : [];
  });
  const pwa = usePWA();
  const geo = useGeolocation((!!trip || scanning) && visible);
  const live = useTripTracking(
    geo.sample,
    trip?.origin ?? null,
    trip?.destination ?? null,
    !!trip && visible && pwa.online,
    trip?.route,
  );
  const held = useWakeLock(!!trip && visible && keepAwake);
  useEffect(() => {
    const changed = () => {
      const next = document.visibilityState === "visible";
      setVisible(next);
      if (next) {
        setFreshAfter(Date.now());
        setNow(Date.now());
      }
    };
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    if (!trip && !scanning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, [trip, scanning]);
  useEffect(() => {
    if (!scanning) return;
    const timer = window.setTimeout(() => {
      setScanning(false);
      setScanMessage(
        "ยังหาสถานีไม่เจอ ลองใช้ GPS อีกครั้งหรือเลือกสถานีเองได้เลย",
      );
    }, 30000);
    return () => clearTimeout(timer);
  }, [scanning]);

  const route = selectedRoute.map((stop) => getStation(stop)!);
  const estimate = journeyEstimate(origin, destination, selectedRoute);
  useEffect(() => {
    if (trip?.route) {
      setSelectedRoute(trip.route);
      return;
    }
    setSelectedRoute([]);
    setFare(null);
    setFareIssue("");
    setFareBusy(false);
    if (!origin || !destination) return;
    const controller = new AbortController();
    let live = true;
    setFareBusy(true);
    resolveCheapestJourney(origin, destination, controller.signal)
      .then((plan) => {
        if (live) {
          setFare(plan.fare);
          setSelectedRoute(plan.route);
        }
      })
      .catch((error) => {
        if (live && error.name !== "AbortError") setFareIssue(error.message);
      })
      .finally(() => {
        if (live) setFareBusy(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [
    origin?.lineId,
    origin?.stationId,
    destination?.lineId,
    destination?.stationId,
  ]);
  const result =
    trip && live.result && live.result.timestamp >= trip.startedAt
      ? live.result
      : null;
  const issue = !pwa.online
    ? "ออฟไลน์ — รอเชื่อมต่อเพื่ออัปเดตตำแหน่ง"
    : (geo.error ??
      (geo.stale ? "สัญญาณ GPS ขาดหาย — กำลังรอตำแหน่งใหม่" : live.issue));
  const fresh =
    !!trip &&
    visible &&
    !!result &&
    result.timestamp >= freshAfter &&
    now - result.timestamp < 20000 &&
    !issue;
  const alerts = useNotifications(result, fresh, `${trip?.startedAt ?? 0}`);
  const from = origin ? getStation(origin) : null;
  const to = destination ? getStation(destination) : null;
  const line = origin ? getLine(origin.lineId) : null;
  const remaining = result?.remainingStations ?? Math.max(0, route.length - 1);
  const arrived = fresh && result?.arrived;
  const candidates =
    scanning && geo.sample && geo.sample.timestamp >= scanStarted
      ? nearbyStations(geo.sample, now)
      : [];
  const start = () => {
    if (!origin || !destination || route.length < 2) return;
    const next = {
      origin,
      destination,
      route: selectedRoute,
      startedAt: Date.now(),
    };
    setFreshAfter(next.startedAt);
    setNow(next.startedAt);
    setScanning(false);
    setTrip(next);
    save("active-trip", next);
    const updated = [
      destination,
      ...recent.filter(
        (d) =>
          d.lineId !== destination.lineId ||
          d.stationId !== destination.stationId,
      ),
    ].slice(0, 3);
    setRecent(updated);
    save("recent", updated);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const chooseOrigin = (d: Destination, source: string) => {
    setOrigin(d);
    setOriginSource(source);
    setScanning(false);
    setScanMessage("");
    if (
      destination &&
      destination.lineId === d.lineId &&
      destination.stationId === d.stationId
    )
      setDestination(null);
  };
  const stop = () => {
    setTrip(null);
    save("active-trip", null);
    setConfirmStop(false);
    setOrigin(null);
    setDestination(null);
    setScanning(false);
    setScanMessage("");
  };

  return (
    <div className="journey-app">
      <header className="journey-header">
        <div className="journey-brand">
          <img src="/icons/train-shadow-96.png" width="44" height="44" alt="" />
          <strong>
            ถึงยัง<span>.</span>
          </strong>
        </div>
        <button
          className="round-button"
          aria-label="วิธีใช้งานและติดตั้ง"
          onClick={() => setInfo(true)}
        >
          <Info size={22} />
        </button>
      </header>
      <main className="journey-main">
        {!trip ? (
          <>
            <section className="journey-intro">
              <span className="small-label">ไปด้วยกันทุกสถานี</span>
              <h1>วันนี้ ไปลงไหน?</h1>
              <p>เลือกสถานีขึ้นกับปลายทาง แล้วไปกันเลย</p>
            </section>
            <section className="plan-card" aria-label="วางแผนเดินทาง">
              <div className="step-label">
                <span>1</span>
                <h2>ขึ้นจากสถานีไหน</h2>
              </div>
              <button
                className={`station-picker ${from ? "has-value" : ""}`}
                onClick={() => {
                  setScanning(false);
                  setSearch("origin");
                }}
              >
                <MapPin size={23} />
                <span>
                  <small>
                    {from ? `${line?.name} · ${originSource}` : "สถานีที่ขึ้น"}
                  </small>
                  <strong>{from?.nameTh ?? "เลือกสถานี"}</strong>
                </span>
                <ChevronRight size={20} />
              </button>
              <button
                className="gps-button"
                onClick={() => {
                  if (scanning) {
                    setScanning(false);
                    return;
                  }
                  setScanStarted(Date.now());
                  setNow(Date.now());
                  setScanMessage("");
                  setScanning(true);
                }}
              >
                {scanning ? (
                  <LoaderCircle className="spin" size={19} />
                ) : (
                  <Crosshair size={19} />
                )}
                {scanning
                  ? "กำลังหาสถานี… แตะเพื่อยกเลิก"
                  : "ใช้ GPS หาสถานีใกล้ฉัน"}
              </button>
              {scanning && (
                <div className="gps-results" aria-live="polite">
                  {candidates.length > 0 ? (
                    <>
                      <p>เลือกสถานีที่คุณขึ้นเพื่อยืนยัน</p>
                      {candidates.map((c) => (
                        <button
                          key={`${c.destination.lineId}:${c.destination.stationId}`}
                          onClick={() =>
                            chooseOrigin(c.destination, "ยืนยันจาก GPS")
                          }
                        >
                          <span>
                            <strong>{getStation(c.destination)?.nameTh}</strong>
                            <small>
                              {getLine(c.destination.lineId)?.name} · ห่างประมาณ{" "}
                              {c.distance} ม.
                            </small>
                          </span>
                          <Check size={20} />
                        </button>
                      ))}
                    </>
                  ) : (
                    <p>
                      {geo.error ??
                        (geo.sample && geo.sample.timestamp >= scanStarted
                          ? "ยังไม่พบสถานีใกล้ตำแหน่งที่แม่นพอ เลือกสถานีเองได้"
                          : "อนุญาตตำแหน่งเพื่อค้นหาสถานีใกล้คุณ")}
                    </p>
                  )}
                </div>
              )}
              {scanMessage && (
                <p className="inline-note" role="status">
                  {scanMessage}
                </p>
              )}
              <div className="step-divider" />
              <div className="step-label">
                <span>2</span>
                <h2>จะลงสถานีไหน</h2>
              </div>
              <button
                className={`station-picker ${to ? "has-value" : ""}`}
                disabled={!origin}
                onClick={() => setSearch("destination")}
              >
                <TrainFront size={23} />
                <span>
                  <small>
                    {to ? getLine(destination!.lineId)?.name : "ปลายทาง"}
                  </small>
                  <strong>
                    {to?.nameTh ??
                      (origin ? "เลือกสถานีปลายทาง" : "เลือกสถานีที่ขึ้นก่อน")}
                  </strong>
                </span>
                <ChevronRight size={20} />
              </button>
              {fareBusy && (
                <p role="status">กำลังเปรียบเทียบค่าโดยสารทุกเส้นทาง…</p>
              )}
              {fareIssue && (
                <p className="fare-issue" role="alert">
                  {fareIssue} — ยังยืนยันเส้นทางที่ถูกที่สุดไม่ได้
                  กรุณาเลือกสถานีอีกครั้ง
                </p>
              )}
              {route.length > 1 && (
                <div className="route-plan">
                  <p className="route-direction">
                    ค่าโดยสารถูกที่สุด · ราคาเท่ากันเลือกต่อสายน้อยกว่า
                  </p>
                  <RouteMap
                    origin={origin!}
                    destination={destination!}
                    route={selectedRoute}
                  />
                  <div className="route-metrics">
                    <span>
                      <Clock3 size={18} />
                      <strong>
                        {estimate?.timeMin}–{estimate?.timeMax}
                      </strong>
                      <small>นาที</small>
                    </span>
                    <span>
                      <Banknote size={19} />
                      <strong>
                        {fare ? `฿${fare.total}` : fareBusy ? "…" : "—"}
                      </strong>
                      <small>รวมราคาจริง</small>
                    </span>
                    <span>
                      <Repeat2 size={18} />
                      <strong>{estimate?.transfers.length ?? 0}</strong>
                      <small>ครั้ง</small>
                    </span>
                  </div>
                  <p className="route-direction">
                    {estimate?.railStops} สถานี · เริ่มไปทาง {route[1].nameTh}
                  </p>
                  <div
                    className="fare-breakdown"
                    aria-label="รายละเอียดค่าโดยสารแต่ละสาย"
                  >
                    {fare?.items.map((item, index) => (
                      <span key={`${item.label}-${index}`}>
                        {item.label} ฿{item.fare}
                      </span>
                    ))}
                  </div>
                  {fareIssue && (
                    <p className="fare-issue">
                      {fareIssue} — ไม่แสดงราคาประมาณแทน
                    </p>
                  )}
                  {!!estimate?.transfers.length && (
                    <div className="transfer-list">
                      <strong>จุดต่อสาย</strong>
                      {estimate.transfers.map((transfer) => (
                        <p key={`${transfer.fromLine}-${transfer.toLine}`}>
                          ลงที่ <b>{transfer.at}</b> →{" "}
                          {transfer.walkTo !== transfer.at
                            ? `เดินไป ${transfer.walkTo} · `
                            : ""}
                          ขึ้น {transfer.toLine}
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="estimate-note">
                    เวลาเป็นค่าประมาณ · ค่าโดยสารบุคคลทั่วไปเที่ยวเดียวจากตาราง
                    BTS และเครื่องคำนวณ BEM ทางการ
                  </p>
                </div>
              )}
              <button
                className="journey-primary"
                disabled={route.length < 2}
                onClick={start}
              >
                เริ่มเดินทาง <ArrowRight size={21} />
              </button>
              <p className="plan-footnote">ติดตามและเตือนด้วย GPS ขณะเปิดแอป</p>
            </section>
            <p className="coverage-caption">
              BTS สุขุมวิท · สีลม / MRT น้ำเงิน · ม่วง
              <br />
              เปลี่ยนสายและเดินทางข้าม BTS–MRT ได้
            </p>
            {pwa.isIOS && !pwa.installed && (
              <button className="install-hint" onClick={() => setInfo(true)}>
                <Download size={19} />
                <span>เพิ่มถึงยังบนหน้าจอโฮม iPhone</span>
                <ChevronRight size={18} />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="trip-heading">
              <span className="line-tag" style={{ color: line?.color }}>
                {line?.name}
              </span>
              <span className={`location-status ${fresh ? "is-live" : ""}`}>
                <i />
                {fresh ? "GPS อัปเดตแล้ว" : "รอ GPS ยืนยัน"}
              </span>
            </div>
            <section className="count-card">
              <p className="destination-caption">กำลังไป</p>
              <h1>{to?.nameTh}</h1>
              <div
                className={`stop-count ${arrived ? "is-arrived" : ""}`}
                aria-live="polite"
                aria-atomic="true"
              >
                <span>
                  {arrived
                    ? "ถึงแล้ว"
                    : result && !fresh
                      ? "ข้อมูลล่าสุด เหลือ"
                      : "เหลืออีก"}
                </span>
                <strong>{remaining}</strong>
                <span>สถานี</span>
              </div>
              <p className="count-explanation">
                {arrived
                  ? "เตรียมลงรถ เดินทางปลอดภัยนะ"
                  : fresh
                    ? "อัปเดตจากตำแหน่ง GPS จริง"
                    : result
                      ? "ตัวเลขยังไม่อัปเดต รอสัญญาณตำแหน่งใหม่"
                      : "จำนวนสถานีจากจุดที่เลือก · รอ GPS ยืนยัน"}
              </p>
              {result?.wrongDirection && (
                <p className="trip-warning" role="alert">
                  คุณอาจกำลังเดินทางออกจากปลายทาง ตรวจสอบทิศทางรถไฟ
                </p>
              )}
              {issue && (
                <p className="trip-warning" role="status">
                  {issue}
                </p>
              )}
              <div className="next-station">
                <MapPin size={22} />
                <div>
                  <small>
                    {result
                      ? "สถานีถัดไปตามตำแหน่งล่าสุด"
                      : "สถานีถัดไปตามเส้นทาง"}
                  </small>
                  <strong>
                    {arrived
                      ? to?.nameTh
                      : (result?.nextStation?.nameTh ?? route[1]?.nameTh)}
                  </strong>
                </div>
                <ArrowRight size={21} />
              </div>
              <div className="trip-endpoints">
                <span>{from?.nameTh}</span>
                <span className="endpoint-line" />
                <span>{to?.nameTh}</span>
              </div>
            </section>
            {alerts.message && fresh && (
              <div className="arrival-alert" role="alert">
                <Bell size={22} />
                {alerts.message}
              </div>
            )}
            <section className="journey-options">
              <RouteMap
                origin={origin!}
                destination={destination!}
                route={selectedRoute}
              />
              {estimate?.transfers.map((transfer, index) => (
                <p key={index}>
                  ลงที่ <b>{transfer.at}</b> →{" "}
                  {transfer.walkTo !== transfer.at
                    ? `เดินไป ${transfer.walkTo} · `
                    : ""}
                  ขึ้น {transfer.toLine}
                </p>
              ))}
              <div className="notification-row">
                <Bell size={22} />
                <div>
                  <strong>เตือนก่อนถึง 1 สถานี</strong>
                  <small>จาก GPS ขณะเปิดแอป</small>
                </div>
                <button
                  className="journey-switch"
                  role="switch"
                  aria-label="เตือนก่อนถึง 1 สถานี"
                  aria-checked={alerts.enabled}
                  onClick={() => {
                    void alerts.toggle();
                  }}
                >
                  <span />
                </button>
              </div>
              {alerts.capability && (
                <p className="inline-note" role="status">
                  {alerts.capability}
                </p>
              )}
              <label className="awake-option">
                <input
                  type="checkbox"
                  checked={keepAwake}
                  onChange={(e) => setKeepAwake(e.target.checked)}
                />
                <span>
                  เปิดหน้าจอค้างระหว่างเดินทาง
                  <small>
                    {keepAwake
                      ? held
                        ? "เปิดหน้าจอค้างอยู่"
                        : "หากเครื่องรองรับและอนุญาต"
                      : "ปิดอยู่"}
                  </small>
                </span>
              </label>
              <p className="background-note">
                <Info size={17} />
                <span>
                  เปิดแอปไว้เพื่อรับการเตือน GPS
                  <br />
                  เมื่อล็อกจอหรือปิดแอป จะติดตามต่อไม่ได้
                </span>
              </p>
            </section>
            <button
              className={arrived ? "journey-primary" : "end-trip"}
              onClick={() => (arrived ? stop() : setConfirmStop(true))}
            >
              {arrived ? <Check size={20} /> : <Square size={18} />}
              {arrived ? "จบทริป" : "จบการเดินทาง"}
            </button>
          </>
        )}
      </main>
      {search && (
        <DestinationSearch
          purpose={search}
          current={search === "origin" ? origin : destination}
          recent={search === "origin" ? [] : recent}
          excluded={
            search === "destination" ? (origin ?? undefined) : undefined
          }
          onClose={() => setSearch(null)}
          onSelect={(d) => {
            if (search === "origin") chooseOrigin(d, "เลือกเอง");
            else setDestination(d);
            setSearch(null);
          }}
        />
      )}
      {confirmStop && (
        <Modal label="จบการเดินทาง" onClose={() => setConfirmStop(false)}>
          <div className="modal-title">
            <h2>จบการเดินทางนี้?</h2>
            <button
              className="round-button"
              aria-label="ปิด"
              onClick={() => setConfirmStop(false)}
            >
              <X />
            </button>
          </div>
          <p>แอปจะหยุดติดตาม GPS และหยุดเตือนทริปนี้</p>
          <button className="journey-primary" onClick={stop}>
            จบการเดินทาง
          </button>
          <button className="text-button" onClick={() => setConfirmStop(false)}>
            เดินทางต่อ
          </button>
        </Modal>
      )}
      {info && (
        <Modal label="วิธีใช้งานและติดตั้ง" onClose={() => setInfo(false)}>
          <div className="modal-title">
            <h2>พา “ถึงยัง” ไปด้วย</h2>
            <button
              className="round-button"
              aria-label="ปิด"
              onClick={() => setInfo(false)}
            >
              <X />
            </button>
          </div>
          <div className="help-content">
            <img
              className="install-logo"
              src="/icons/train-shadow-180.png"
              width="80"
              height="80"
              alt="โลโก้ถึงยัง รูปรถไฟ"
            />
            <h3>เลือก ขึ้น → ลง → เริ่มเดินทาง</h3>
            <p>
              เลือกสถานีที่ขึ้นเอง หรือใช้ GPS แล้วแตะยืนยันสถานี
              เลือกปลายทางได้ทุกสาย จากนั้นกดเริ่มเดินทาง
            </p>
            <h3>ใช้เป็นแอปบน iPhone</h3>
            <ol className="install-steps">
              <li>เปิดเว็บไซต์นี้ใน Safari แล้วแตะแชร์</li>
              <li>
                เลือก “เพิ่มไปยังหน้าจอโฮม” แล้วแตะ “เพิ่ม” หากมี
                “เปิดเป็นเว็บแอป” ให้เปิดไว้
              </li>
              <li>
                เปิดถึงยังจากหน้าจอโฮม อนุญาตตำแหน่งเมื่อเริ่มเดินทาง
                และเปิดการเตือนในแอป
              </li>
            </ol>
            {pwa.canInstall && (
              <button
                className="journey-primary"
                onClick={() => void pwa.install()}
              >
                <Download size={20} />
                ติดตั้งถึงยัง
              </button>
            )}
            <h3>การเตือนจาก GPS จริง</h3>
            <p>
              ต้องเปิดแอปไว้ เมื่อล็อกจอหรือปิดแอป PWA บน iPhone ไม่สามารถติดตาม
              GPS ต่อเนื่องได้ การรับ Push ไม่ทำให้ติดตามตำแหน่งเบื้องหลังได้
              แอปนี้ไม่ใช้เวลาประมาณมาแทน GPS
            </p>
            <p>
              ช่วงใต้ดินหรือสัญญาณขาด จะแสดงจำนวนสถานีล่าสุดโดยไม่ลดตัวเลขเอง
              ข้อมูลตำแหน่งเป็นค่าประมาณ ไม่ใช่ตำแหน่งรถไฟจากผู้ให้บริการ
            </p>
            <h3>ข้อมูลของคุณ</h3>
            <p>
              ใช้ตำแหน่งสูงสุด 12 จุดคำนวณผ่าน API โดยไม่บันทึกฐานข้อมูลตำแหน่ง
              เก็บสถานีของทริปไว้บนเครื่องเพื่อกลับมาเปิดต่อได้ ภายใน 12 ชั่วโมง
              การติดตามสดต้องใช้อินเทอร์เน็ต
              ส่วนการเลือกสถานีใช้แบบออฟไลน์ได้หลังโหลดแอปครั้งแรก
            </p>
            <p>
              ข้อมูลสถานี:{" "}
              <a
                href="https://github.com/Gusb3ll/thailand-public-train-data"
                target="_blank"
                rel="noreferrer"
              >
                Thailand public train data (CC0)
              </a>
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
