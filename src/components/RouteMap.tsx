import { getStation } from "../data/network";
import { journeyMapStops } from "../data/journey";
import type { Destination } from "../types";

export function RouteMap({
  origin,
  destination,
}: {
  origin: Destination;
  destination: Destination;
}) {
  const stops = journeyMapStops(origin, destination);
  if (stops.length < 2) return null;

  const width = 320;
  const height = 190;
  const padding = 25;
  const averageLat = stops.reduce((sum, stop) => sum + stop.station.lat, 0) / stops.length;
  const longitudeScale = Math.cos((averageLat * Math.PI) / 180);
  const longitudes = stops.map((stop) => stop.station.lng * longitudeScale);
  const latitudes = stops.map((stop) => stop.station.lat);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lngSpan = Math.max(maxLng - minLng, 0.003);
  const latSpan = Math.max(maxLat - minLat, 0.003);
  const scale = Math.min((width - padding * 2) / lngSpan, (height - padding * 2) / latSpan);
  const drawnWidth = lngSpan * scale;
  const drawnHeight = latSpan * scale;
  const offsetX = (width - drawnWidth) / 2;
  const offsetY = (height - drawnHeight) / 2;
  const points = stops.map((stop, index) => ({
    ...stop,
    x: offsetX + (longitudes[index] - minLng) * scale,
    y: offsetY + (maxLat - latitudes[index]) * scale,
  }));
  const labels = points.filter((point, index) =>
    index === 0 || index === points.length - 1 || point.isTransfer,
  );

  return (
    <div className="route-map">
      <div className="route-map-heading">
        <strong>แผนที่การเดินทาง</strong>
        <span>เส้นทางโดยประมาณ</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`เส้นทางจาก ${getStation(origin)?.nameTh} ไป ${getStation(destination)?.nameTh}`}>
        <rect width={width} height={height} rx="14" fill="#eef6ff" />
        <path d="M18 48 C75 18 130 58 185 31 S280 35 307 17" fill="none" stroke="#dfeefa" strokeWidth="18" strokeLinecap="round" />
        <path d="M8 150 C75 116 118 168 186 139 S269 129 320 161" fill="none" stroke="#e4f1fb" strokeWidth="22" strokeLinecap="round" />
        {points.slice(1).map((point, index) => {
          const previous = points[index];
          const transfer = previous.lineId !== point.lineId;
          return <line key={`${previous.lineId}:${previous.stationId}-${point.lineId}:${point.stationId}`} x1={previous.x} y1={previous.y} x2={point.x} y2={point.y} stroke={transfer ? "#8192a8" : point.line.color} strokeWidth={transfer ? 3 : 5} strokeDasharray={transfer ? "5 5" : undefined} strokeLinecap="round" />;
        })}
        {points.map((point, index) => (
          <circle key={`${point.lineId}:${point.stationId}`} cx={point.x} cy={point.y} r={index === 0 || index === points.length - 1 ? 6 : point.isTransfer ? 5 : 2.5} fill="white" stroke={point.line.color} strokeWidth={index === 0 || index === points.length - 1 ? 4 : 2} />
        ))}
        {labels.map((point, index) => {
          const isStart = point === points[0];
          const isEnd = point === points[points.length - 1];
          const label = isStart ? `เริ่ม ${point.station.nameTh}` : isEnd ? `ถึง ${point.station.nameTh}` : `ต่อ ${point.station.nameTh}`;
          const anchor = point.x < 80 ? "start" : point.x > 240 ? "end" : "middle";
          const x = anchor === "start" ? point.x + 7 : anchor === "end" ? point.x - 7 : point.x;
          const y = point.isTransfer
            ? point.y + 19
            : point.y < 35
              ? point.y + 21
              : point.y - 11 - index * 2;
          return <text key={`label-${point.lineId}:${point.stationId}`} x={x} y={y} textAnchor={anchor} className="route-map-label">{label}</text>;
        })}
      </svg>
      <div className="route-map-legend">
        {[...new Map(stops.map((stop) => [stop.lineId, stop.line])).values()].map((line) => (
          <span key={line.id}><i style={{ background: line.color }} />{line.name}</span>
        ))}
      </div>
    </div>
  );
}
