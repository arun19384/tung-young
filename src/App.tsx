import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Clock3,
  Crosshair,
  Download,
  MapPin,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  TrainFront,
  WifiOff,
  X,
} from "lucide-react";
import { CityScene } from "./components/CityScene";
import { TransitLine } from "./components/TransitLine";
import { DestinationSearch } from "./components/DestinationSearch";
import { Modal } from "./components/Modal";
import {
  demoStations,
  getLine,
  getStation,
  isDestination,
  lines,
} from "./data/network";
import { useGeolocation } from "./hooks/useGeolocation";
import { useTripTracking } from "./hooks/useTripTracking";
import { useNotifications } from "./hooks/useNotifications";
import { usePWA } from "./hooks/usePWA";
import { useWakeLock } from "./hooks/useWakeLock";
import { read, save } from "./services/storage";
import type { Destination, Resolution } from "./types";

export default function App() {
  const [destination, setDestination] = useState<Destination | null>(() => {
    const d = read("destination");
    return isDestination(d) ? d : null;
  });
  const [recent, setRecent] = useState<Destination[]>(() => {
    const v = read("recent");
    return Array.isArray(v) ? v.filter(isDestination).slice(0, 3) : [];
  });
  const [search, setSearch] = useState(false);
  const [info, setInfo] = useState(false);
  const [active, setActive] = useState(false);
  const [demo, setDemo] = useState(false);
  const [position, setPosition] = useState(0.45);
  const [debug, setDebug] = useState(false);
  const [lost, setLost] = useState(false);
  const [trip, setTrip] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [keepAwake, setKeepAwake] = useState(false);
  const [interval, setIntervalMs] = useState(4000);
  const pwa = usePWA();
  const geo = useGeolocation(active && !demo, interval);
  const live = useTripTracking(
    geo.sample,
    destination,
    active && !demo && pwa.online,
  );
  const awake = useWakeLock(active && !demo && keepAwake);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/config", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (
          c &&
          Number.isFinite(c.locationUpdateInterval) &&
          c.locationUpdateInterval >= 1000 &&
          c.locationUpdateInterval <= 10000
        )
          setIntervalMs(c.locationUpdateInterval);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const demoRemaining = 4 - Math.floor(position);
  const demoResult: Resolution = {
    status: position === 4 ? "arrived" : "tracking",
    line: lines[0],
    route: demoStations,
    previousStation: demoStations[Math.floor(position)],
    nextStation: demoStations[Math.min(4, Math.floor(position) + 1)],
    destination: demoStations[4],
    progress: position / 4,
    remainingStations: demoRemaining,
    confidence: 1,
    arrived: position === 4,
    wrongDirection: false,
    etaMinutes: Math.ceil((4 - position) * 2),
    timestamp: Date.now(),
    distanceMeters: 0,
  };
  const result = demo ? demoResult : live.result;
  const issue = demo
    ? lost
      ? "หาตำแหน่งไม่เจอ — เก็บทริปเดิมไว้ รอรับสัญญาณใหม่"
      : null
    : !pwa.online
      ? "ออฟไลน์ — แสดงตำแหน่งล่าสุดและรอเชื่อมต่อ"
      : (geo.error ??
        (geo.stale
          ? "สัญญาณตำแหน่งขาดหาย — จะติดตามต่อเมื่อรับสัญญาณได้"
          : live.issue));
  const fresh =
    active &&
    !demo &&
    !issue &&
    !!result &&
    result.timestamp >= startedAt &&
    Date.now() - result.timestamp < 20000;
  const alerts = useNotifications(
    live.result,
    fresh,
    `${destination?.lineId}:${destination?.stationId}:${trip}`,
  );
  const chosen = demo
    ? demoStations[4]
    : destination
      ? getStation(destination)
      : null;
  const line = demo
    ? lines[0]
    : destination
      ? getLine(destination.lineId)
      : result?.line;
  const arrived =
    !!chosen && !!result?.arrived && !issue && active && (demo || fresh);
  const start = () => {
    setStartedAt(Date.now());
    setActive(true);
    setTrip((t) => t + 1);
  };
  const select = (d: Destination) => {
    setStartedAt(Date.now());
    setDestination(d);
    save("destination", d);
    const next = [
      d,
      ...recent.filter(
        (x) => x.lineId !== d.lineId || x.stationId !== d.stationId,
      ),
    ].slice(0, 3);
    setRecent(next);
    save("recent", next);
    setSearch(false);
    setTrip((t) => t + 1);
  };
  const route = result?.route ?? [];
  const preview = route.slice(0, 7);
  const railPosition = demo
    ? position
    : result?.arrived
      ? 0
      : (result?.progress ?? 0);
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="ถึงยัง หน้าหลัก">
          <span className="brand-icon">
            <img
              src="/icons/train-shadow-96.png"
              width="44"
              height="44"
              alt=""
            />
          </span>
          <strong>
            ถึงยัง<span className="brand-dot">.</span>
          </strong>
        </a>
        <div className="header-right">
          <span className="desktop-caption">
            เพื่อนร่วมทาง ที่เข้าใจทุกสถานี
          </span>
          <span className={`demo-pill ${demo ? "" : "real-pill"}`}>
            <span />
            {demo ? "โหมดทดลอง" : "GPS จริง"}
          </span>
          {!pwa.installed && (
            <button
              className="icon-button"
              aria-label="ติดตั้งแอป"
              onClick={async () => {
                if (!(await pwa.install())) setInfo(true);
              }}
            >
              <Download size={20} />
            </button>
          )}
          <button
            className="icon-button"
            aria-label="ข้อมูลการใช้งาน"
            onClick={() => setInfo(true)}
          >
            <ShieldCheck size={21} />
          </button>
        </div>
      </header>
      <main>
        {pwa.isIOS && !pwa.installed && (
          <button className="iphone-install" onClick={() => setInfo(true)}>
            <img
              src="/icons/train-shadow-96.png"
              width="44"
              height="44"
              alt=""
            />
            <span>
              <strong>เพิ่ม “ถึงยัง” บนหน้าจอโฮม</strong>
              <small>ใช้เป็นแอปบน iPhone · ดูวิธีติดตั้ง</small>
            </span>
            <Download size={20} />
          </button>
        )}
        <section className="intro">
          <div className="eyebrow">
            <span /> YOUR EVERYDAY TRAVEL BUDDY
          </div>
          <h1>
            ทุกการเดินทาง <span>ใกล้ขึ้นเสมอ</span>
          </h1>
          <p>ไม่ต้องคอยนับสถานี ให้ถึงยังเป็นเพื่อนร่วมทางของคุณ</p>
        </section>
        {!demo && !active && (
          <section className="permission-card">
            <div className="permission-icon">
              <MapPin size={26} />
            </div>
            <div>
              <h2>
                {live.result
                  ? "พร้อมเดินทางต่อไหม?"
                  : "เปิดตำแหน่ง แล้วไปด้วยกัน"}
              </h2>
              <p>
                ใช้ GPS เพื่อหาสถานีใกล้คุณ ส่งตำแหน่งให้ระบบคำนวณขณะเปิดแอป
                โดยไม่บันทึกประวัติตำแหน่ง
              </p>
            </div>
            <button className="primary" onClick={start}>
              <Navigation size={18} />
              {live.result ? "ติดตามต่อ" : "เริ่มใช้ตำแหน่ง"}
            </button>
          </section>
        )}
        {issue && (
          <div className="warning global-warning" role="status">
            <WifiOff size={18} />
            <span>
              {issue}
              {!demo && geo.error && (
                <button onClick={() => setActive(false)}>พักและลองใหม่</button>
              )}
            </span>
          </div>
        )}
        <div className="dashboard">
          <section className="journey-panel">
            <div className="scene-heading">
              <span className="tiny-label">LET’S GO SOMEWHERE</span>
              <h2>
                นั่งสบาย ๆ<br />
                ให้เราเป็นเพื่อนร่วมทาง<span> :)</span>
              </h2>
              <CityScene />
            </div>
            <div className="journey-content">
              <div className="card-top">
                <span
                  className={`live-status ${active && !issue ? "" : "inactive"}`}
                >
                  <i />
                  {arrived
                    ? "ถึงปลายทางแล้ว"
                    : !active
                      ? "พร้อมออกเดินทาง"
                      : issue
                        ? "กำลังรอสัญญาณ"
                        : result
                          ? "กำลังติดตาม"
                          : "กำลังหาตำแหน่ง"}
                </span>
                {line && (
                  <span className="line-badge" style={{ color: line.color }}>
                    {line.name}
                  </span>
                )}
              </div>
              <div className="route-heading">
                <div>
                  <span className="field-label">
                    {demo ? "จากสถานี" : "ตำแหน่งล่าสุด"}
                  </span>
                  <h3>
                    {demo ? "อโศก" : (result?.previousStation?.nameTh ?? "—")}
                  </h3>
                </div>
                <ArrowRight className="route-arrow" size={25} />
                <button
                  className="destination-label"
                  disabled={demo}
                  onClick={() => setSearch(true)}
                >
                  <span className="field-label">
                    ปลายทาง <ChevronDown size={13} />
                  </span>
                  <h3>{chosen?.nameTh ?? "เลือกสถานี"}</h3>
                </button>
              </div>
              {preview.length > 1 ? (
                <TransitLine stations={preview} position={railPosition} />
              ) : (
                <div className="route-placeholder">
                  <TrainFront size={27} />
                  {arrived
                    ? "ถึงที่หมายแล้ว"
                    : active
                      ? "กำลังรอตำแหน่งที่ยืนยันแล้ว"
                      : "เส้นทางจะปรากฏเมื่อรับตำแหน่งได้"}
                </div>
              )}
              <div className="trip-meta">
                <span>
                  <Navigation size={14} />
                  {demo
                    ? "เส้นทางจำลอง"
                    : route.length > 7
                      ? `แสดง 7 สถานีแรก · อีก ${route.length - 7} สถานีต่อจากนี้`
                      : "ติดตามภายในสายเดียว · ตำแหน่งประมาณ"}
                </span>
              </div>
              <button
                className="primary destination-button"
                disabled={demo}
                onClick={() => setSearch(true)}
              >
                <Crosshair size={20} />
                {chosen ? "เปลี่ยนปลายทาง" : "ตั้งปลายทาง"}
                <ArrowRight size={19} />
              </button>
            </div>
          </section>
          <section className="tracking-panel">
            <button
              className="destination-shortcut"
              disabled={demo}
              onClick={() => setSearch(true)}
            >
              <span>ปลายทาง: {chosen?.nameTh ?? "เลือกสถานี"}</span>
              <ChevronDown size={16} />
            </button>
            <div className="tracking-title">
              <div>
                <span className="tiny-label">YOUR JOURNEY</span>
                <h2>{arrived ? "ถึงแล้ว 🎉" : "ถึงไหนแล้ว?"}</h2>
              </div>
              <span className="updated">
                <span />
                {demo
                  ? "ตำแหน่งจำลอง"
                  : issue
                    ? "ตำแหน่งล่าสุด"
                    : fresh
                      ? "อัปเดตจาก GPS"
                      : live.busy
                        ? "กำลังตรวจสอบ"
                        : "รอเริ่มติดตาม"}
              </span>
            </div>
            <div className={`progress-area ${issue ? "uncertain" : ""}`}>
              <svg
                className="progress-ring"
                viewBox="0 0 240 240"
                aria-hidden="true"
              >
                <circle cx="120" cy="120" r="103" className="ring-track" />
                <circle
                  cx="120"
                  cy="120"
                  r="103"
                  className="ring-value"
                  strokeDasharray={`${arrived ? 647 : result ? Math.max(0.05, demo ? position / 4 : 1 / (result.remainingStations + 1)) * 647 : 0} 647`}
                />
              </svg>
              <div className="ring-copy" aria-live="polite">
                {arrived ? (
                  <>
                    <span>ยินดีต้อนรับสู่</span>
                    <strong className="arrival-name">{chosen?.nameTh}</strong>
                    <span>เดินทางปลอดภัยนะ</span>
                  </>
                ) : (
                  <>
                    <span>
                      {issue
                        ? "ข้อมูลล่าสุด"
                        : chosen
                          ? "อีกประมาณ"
                          : "เลือกปลายทางก่อน"}
                    </span>
                    <strong>
                      {chosen && result ? result.remainingStations : "—"}
                    </strong>
                    <span className="station-word">สถานี</span>
                  </>
                )}
                <div className="eta">
                  <Clock3 size={13} />
                  {arrived
                    ? "ถึงปลายทางแล้ว"
                    : chosen && result
                      ? `ประมาณ ${result.etaMinutes} นาที`
                      : "รอยืนยันตำแหน่ง"}
                </div>
              </div>
              <span className="ring-train">
                <TrainFront size={23} />
              </span>
            </div>
            <div className="location-cards">
              <div>
                <span className="location-icon">
                  <MapPin size={21} />
                </span>
                <div>
                  <span className="field-label">
                    {issue ? "ล่าสุดใกล้" : "ใกล้สถานี"}
                  </span>
                  <strong>
                    {result?.previousStation?.nameTh ?? "กำลังรอ GPS"}
                  </strong>
                </div>
              </div>
              <div>
                <span className="location-icon">
                  <ArrowRight size={23} />
                </span>
                <div>
                  <span className="field-label">
                    {arrived ? "ปลายทาง" : "สถานีถัดไป"}
                  </span>
                  <strong>{result?.nextStation?.nameTh ?? "—"}</strong>
                </div>
              </div>
            </div>
            {result?.wrongDirection && !issue && (
              <p className="warning" role="status">
                ดูเหมือนกำลังเคลื่อนออกจากปลายทาง กรุณาตรวจสอบทิศทางขบวน
              </p>
            )}
            <div className="alert-card">
              <Bell size={23} />
              <div>
                <strong>
                  เตือนก่อนถึง{" "}
                  <select
                    aria-label="จำนวนสถานีก่อนแจ้งเตือน"
                    value={alerts.threshold}
                    onChange={(e) => alerts.setThreshold(+e.target.value)}
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} สถานี
                      </option>
                    ))}
                  </select>
                </strong>
                <p>
                  {demo
                    ? "การทดลองไม่ส่งแจ้งเตือนระบบ"
                    : alerts.enabled
                      ? "เตือนเมื่อได้ตำแหน่งที่ยืนยันแล้ว"
                      : "แตะสวิตช์เพื่อเปิดการเตือน"}
                </p>
              </div>
              <button
                className={`toggle ${alerts.enabled ? "on" : ""}`}
                disabled={demo}
                role="switch"
                aria-checked={alerts.enabled}
                aria-label="เตือนก่อนถึง"
                onClick={() => void alerts.toggle()}
              >
                <span />
              </button>
            </div>
            {alerts.capability && (
              <p className="coverage-note">{alerts.capability}</p>
            )}
            {alerts.message && !demo && (
              <p className="demo-alert" role="status">
                <Bell size={17} />
                {alerts.message}
              </p>
            )}
            <button
              className="stop-button"
              onClick={() => (active ? setActive(false) : start())}
            >
              {active ? <Pause size={17} /> : <Play size={17} />}{" "}
              {active ? "พักการติดตาม" : "เริ่มติดตาม"}
            </button>
            <p className="foreground-note">
              เปิดแอปไว้ระหว่างเดินทาง การล็อกจออาจหยุด GPS
            </p>
            {!demo && (
              <label className="wake-lock">
                <input
                  type="checkbox"
                  checked={keepAwake}
                  onChange={(e) => setKeepAwake(e.target.checked)}
                />
                เปิดหน้าจอค้างขณะติดตาม{" "}
                {keepAwake &&
                  (awake ? "· เปิดอยู่" : "· รอเริ่ม / เครื่องอาจไม่รองรับ")}
              </label>
            )}
          </section>
        </div>
        <div className="under-dashboard">
          <span>
            <ShieldCheck size={16} /> ไม่บันทึกประวัติตำแหน่ง · ไม่มีบัญชีสมาชิก
          </span>
          <button className="text-button" onClick={() => setInfo(true)}>
            การติดตั้งและขอบเขตการใช้งาน
          </button>
        </div>
        <section className="debug-panel">
          <button
            className="debug-heading"
            aria-expanded={debug}
            onClick={() => setDebug(!debug)}
          >
            <span>
              <Settings2 size={17} />
              <strong>ตำแหน่งและโหมดทดลอง</strong>
            </span>
            <span className="debug-action">
              {debug ? "ซ่อน" : "เปิด"}
              <ChevronDown size={16} />
            </span>
          </button>
          {debug && (
            <div className="debug-content">
              <div className="debug-controls">
                <button
                  onClick={() => {
                    setDemo(!demo);
                    setActive(!demo);
                    setPosition(0.45);
                    setLost(false);
                    setTrip((t) => t + 1);
                  }}
                >
                  {demo ? "ออกจากโหมดทดลอง" : "ทดลองเส้นทาง อโศก → สยาม"}
                </button>
              </div>
              {demo ? (
                <>
                  <label htmlFor="progress">
                    ตำแหน่งรถไฟ <strong>{position.toFixed(2)} / 4 สถานี</strong>
                  </label>
                  <input
                    id="progress"
                    type="range"
                    min={0}
                    max={4}
                    step={0.01}
                    value={position}
                    disabled={!active || lost}
                    onChange={(e) => setPosition(+e.target.value)}
                  />
                  <div className="debug-controls">
                    <button onClick={() => setPosition(0)}>
                      <RotateCcw size={14} />
                      เริ่มใหม่
                    </button>
                    <button
                      disabled={!active || lost || position === 4}
                      onClick={() =>
                        setPosition(Math.min(4, Math.floor(position) + 1))
                      }
                    >
                      สถานีถัดไป <ArrowRight size={14} />
                    </button>
                    <button onClick={() => setLost(!lost)}>
                      {lost ? "คืนสัญญาณ" : "จำลอง GPS หาย"}
                    </button>
                  </div>
                  {demoRemaining <= alerts.threshold && (
                    <p className="demo-alert">
                      ตัวอย่าง:{" "}
                      {position === 4
                        ? "ถึงสยามแล้ว"
                        : `อีก ${demoRemaining} สถานีถึงสยาม`}
                    </p>
                  )}
                </>
              ) : (
                <div className="gps-debug">
                  {geo.sample ? (
                    <>
                      <p>
                        Lat {geo.sample.latitude.toFixed(6)} · Lng{" "}
                        {geo.sample.longitude.toFixed(6)}
                      </p>
                      <p>
                        ความคลาดเคลื่อน ±{Math.round(geo.sample.accuracy)} ม. ·
                        อัปเดต{" "}
                        {new Date(geo.sample.timestamp).toLocaleTimeString(
                          "th-TH",
                        )}
                      </p>
                      <p>
                        ความมั่นใจ{" "}
                        {result ? Math.round(result.confidence * 100) : 0}%
                      </p>
                    </>
                  ) : (
                    <p>ยังไม่ได้รับตำแหน่ง GPS</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
        <footer>
          <span className="footer-brand">ถึงยัง.</span>
          <span>ทุกการเดินทาง มีเราไปด้วย</span>
          <span className="footer-version">PWA · BTS / MRT</span>
        </footer>
      </main>
      {search && (
        <DestinationSearch
          current={destination}
          recent={recent}
          onSelect={select}
          onClose={() => setSearch(false)}
        />
      )}
      {info && (
        <Modal label="การติดตั้งและการใช้งาน" onClose={() => setInfo(false)}>
          <div className="modal-title">
            <h2>พา “ถึงยัง” ไปด้วย</h2>
            <button
              className="icon-button"
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
            <h3>{pwa.installed ? "ติดตั้งถึงยังแล้ว" : "ติดตั้งบน iPhone"}</h3>
            <ol className="install-steps">
              <li>เปิดเว็บไซต์นี้ใน Safari แล้วแตะปุ่มแชร์</li>
              <li>เลือก “เพิ่มไปยังหน้าจอโฮม” แล้วแตะ “เพิ่ม”</li>
              <li>
                เปิดถึงยังจากไอคอนบนหน้าจอโฮม แล้วอนุญาตตำแหน่งเมื่อเริ่มเดินทาง
              </li>
            </ol>
            <p>
              หากมีตัวเลือก “เปิดเป็นเว็บแอป” ให้เปิดไว้
              การอนุญาตแจ้งเตือนให้ทำจากแอปที่เพิ่มบนหน้าจอโฮมแล้ว
            </p>
            <p>Android: เมนูเบราว์เซอร์ → ติดตั้งแอป</p>
            {pwa.canInstall && (
              <button className="primary" onClick={() => void pwa.install()}>
                <Download size={18} />
                ติดตั้งถึงยัง
              </button>
            )}
            <h3>ระหว่างเดินทาง</h3>
            <p>
              เปิดแอปไว้เพื่อรับ GPS ต่อเนื่อง
              ระบบอาจหยุดตำแหน่งเมื่อสลับแอปหรือล็อกหน้าจอ โดยเฉพาะ MRT ใต้ดิน
              อย่าใช้การเตือนนี้เป็นวิธีเดียวในการตัดสินใจลงรถ
            </p>
            <h3>ข้อมูลและความเป็นส่วนตัว</h3>
            <p>
              ส่งตำแหน่งล่าสุดสูงสุด 12 จุดให้ API ของแอปคำนวณ
              ไม่มีการเก็บฐานข้อมูลตำแหน่ง เก็บเฉพาะปลายทางและค่าเตือนบนเครื่อง
            </p>
            <p>
              รองรับ BTS สุขุมวิท / สีลม และ MRT สีน้ำเงิน / สีม่วงในสายเดียว
              ตำแหน่งระหว่างสถานีและเวลาเป็นค่าประมาณจากแนวเชื่อมพิกัดสถานี
              ยังไม่ใช่ข้อมูลรถไฟของผู้ให้บริการ
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
            <p>
              เปิดออฟไลน์เพื่อดูข้อมูลสถานีได้หลังโหลดแอปสำเร็จ
              การติดตามจริงต้องใช้อินเทอร์เน็ตและสิทธิ์ตำแหน่ง
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
