import { TrainFront } from "lucide-react";
import type { Station } from "../types";
export function TransitLine({
  stations,
  position,
}: {
  stations: Station[];
  position: number;
}) {
  const percent =
    stations.length > 1 ? (position / (stations.length - 1)) * 100 : 0;
  return (
    <div className="transit">
      <div className="rail">
        <div className="rail-fill" style={{ width: `${percent}%` }} />
        <div className="train-marker" style={{ left: `${percent}%` }}>
          <TrainFront size={23} />
        </div>
        {stations.map((s, i) => (
          <div
            className={`station ${i <= position ? "passed" : ""} ${i === Math.floor(position) ? "current" : ""}`}
            style={{
              left: `${stations.length > 1 ? (i / (stations.length - 1)) * 100 : 0}%`,
            }}
            key={s.id}
          >
            <span />
            <p>{s.nameTh}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
