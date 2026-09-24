# ถึงยัง 🚆

PWA ภาษาไทยสำหรับติดตามว่าเหลืออีกกี่สถานีถึงปลายทาง ขณะเปิดแอประหว่างเดินทาง BTS/MRT

**React + TypeScript + Vite / Go + Fiber + Viper / Vercel โปรเจกต์เดียว** ไม่มีบัญชีสมาชิกและฐานข้อมูล

## ใช้งานได้แล้ว

- GPS จริงผ่าน Browser Geolocation API พร้อมหน้าขอสิทธิ์และสถานะ GPS หาย
- REST resolver ฝั่ง Go: หาสาย/segment ใกล้ที่สุด, project พิกัด, ยืนยันทิศทางและการผ่านสถานีจากหลายจุด
- ค้นหาสถานีไทย/อังกฤษ/รหัส และเลือกปลายทาง 4 สาย: BTS สุขุมวิท/สีลม, MRT สีน้ำเงิน/สีม่วง
- แสดงตำแหน่งประมาณ สถานีถัดไป จำนวนสถานี และ ETA ประมาณ
- เตือนก่อนถึง 1–3 สถานีผ่าน notification/vibration เมื่ออุปกรณ์และสิทธิ์รองรับ พร้อม in-app fallback
- ติดตั้ง PWA, app icons, offline shell, ฟอนต์ในแอป และค้นหาสถานีแบบออฟไลน์
- เก็บปลายทางล่าสุด/ค่าเตือนบนเครื่อง ไม่มีการบันทึกประวัติ GPS
- แยกโหมดจำลอง อโศก → สยามออกจากโหมด GPS จริง โหมดจำลองไม่ส่ง notification

> **ขอบเขต:** เปิดแอปไว้เพื่อรับ GPS การล็อกจอ/ปิดแอปอาจหยุดติดตาม โดยเฉพาะใต้ดิน ข้อมูลแนวรางเป็นแนวเชื่อมพิกัดสถานีและ ETA เป็นค่าประมาณ ยังไม่รองรับการเปลี่ยนสาย สายสีเหลือง/สีชมพู และยังต้องทดสอบภาคสนามก่อนรับประกันความแม่นยำ

## รันในเครื่อง

ต้องมี Node.js 22.12+ และ Go ตามเวอร์ชันใน `go.mod`

```sh
npm ci
npm run api
```

เปิด terminal อีกอัน:

```sh
npm run dev
```

เว็บ: http://localhost:5173 · API: http://localhost:8080/health

Vite proxy `/api` ไป Go ให้อัตโนมัติ ใช้ HTTPS เมื่อลอง GPS บนมือถือจริง (HTTP ผ่าน IP ใน LAN ไม่ใช่ secure context)

ทดสอบ PWA production ในเครื่อง:

```sh
npm run build
npm run preview
```

เปิด http://localhost:4173 โดยยังเปิด `npm run api` ไว้ Service worker จะทำงานเฉพาะ production build

## Deploy บน Vercel

1. Import Git repository `arun19384/tung-young` เข้า Vercel
2. ใช้ Root Directory เป็นราก repository, Framework Preset **Vite**
3. Build: `npm run build` · Output: `dist` · Install: `npm ci`
4. Deploy ได้โดยไม่ต้องใส่ API key หรือฐานข้อมูล

`vercel.json` ส่ง `/api/*` ไป `api/index.go` ซึ่งแปลง Fiber เป็น `net/http.HandlerFunc` สำหรับ Vercel Go Runtime ใช้ domain เดียวกับ frontend จึงไม่ต้องตั้ง `VITE_API_URL` หรือสร้าง backend แยก

Environment settings เป็น optional: `APP_ENV`, `PORT`, `CORS_ALLOWED_ORIGINS` (คั่นด้วยช่องว่าง), `LOCATION_UPDATE_INTERVAL` (ms), `MAX_GPS_ACCURACY`, `STATION_RADIUS`, `MAX_ROUTE_DISTANCE` (meters) ดู `.env.example` หรือ `backend/config.example.yaml` สำหรับ local; production ตั้ง environment ใน Vercel ค่า environment มีลำดับเหนือไฟล์

หากใช้ Vercel CLI ที่ล็อกอินแล้ว:

```sh
npx vercel link
npx vercel deploy
```

## ตรวจสอบ

```sh
npm test
npm run build
go test ./...
go vet ./...
```

GitHub Actions ตรวจ frontend และ backend ทุก push/PR โดยไม่ใช้ deploy token

## API

| Method | Path | Description |
|---|---|---|
| GET | `/health` หรือ `/api/health` | Health check |
| GET | `/api/v1/config` | Public tracking settings |
| GET | `/api/v1/lines` | Lines and stations |
| GET | `/api/v1/lines/:lineId/stations` | Stations on a line |
| GET | `/api/v1/stations` | Station catalogue |
| GET | `/api/v1/stations/search?q=siam` | Thai/English/code search |
| POST | `/api/v1/location/resolve` | Stateless GPS resolution |

Request body (timestamps ต้องเป็นเวลาปัจจุบันใน Unix milliseconds):

```json
{
  "lineId": "bts-sukhumvit",
  "destinationStationId": "CEN",
  "samples": [
    {"latitude":13.738,"longitude":100.557,"accuracy":8,"timestamp":1790230000000}
  ]
}
```

`samples` รองรับ 1–12 จุด เรียงเวลาจากเก่าไปใหม่ มี `speed`/`heading` optional หากส่งเพียงจุดเดียวจะตอบ `acquiring` ต้องได้หลายจุดก่อนยืนยันสถานี ไม่ใส่ปลายทางได้เพื่อหาสายใกล้ที่สุด

## โครงสร้าง

```text
api/index.go                 Vercel Go Function entrypoint
backend/app.go               Composition root
backend/cmd/api/             Local HTTP server
backend/internal/
  domain/                   Geometry, stations, graph routing
  application/service/      Stateless confidence and arrival resolver
  application/port/         Inbound / outbound contracts
  adapter/inbound/http/     Fiber routes, request validation
  adapter/outbound/transit/ Embedded static JSON repository
  infrastructure/config/    Viper
src/
  components/               Cards, transit line, station search, modal
  hooks/                    GPS, tracking, notifications, install, wake lock
  services/                 API and local preferences
  data/                     Offline station catalogue
  sw.js                     Precache and notification click handling
```

รายละเอียด algorithm, privacy, PWA lifecycle และข้อจำกัด: [docs/architecture.md](docs/architecture.md)

## ข้อมูลสถานี

ข้อมูลจาก [Gusb3ll/thailand-public-train-data](https://github.com/Gusb3ll/thailand-public-train-data), CC0-1.0; สำเนา license อยู่ที่ `docs/transit-data-LICENSE.txt` ปรับคำสะกดบางรายการและเพิ่ม topology รอบท่าพระ ไม่ใช่ข้อมูลทางการของ BTS/MRT

อัปเดตชุดข้อมูลแบบ explicit ด้วย `node scripts/import-transit.mjs` แล้วตรวจ diff/ทดสอบก่อน commit ไม่ดึงข้อมูลจาก third party ระหว่าง deploy
