import { useState } from "react";
import { Check, ChevronRight, Clock3, Search, X } from "lucide-react";
import { getLine, getStation, lines } from "../data/network";
import type { Destination } from "../types";
import { Modal } from "./Modal";
export function DestinationSearch({
  current,
  recent,
  onSelect,
  onClose,
  purpose = "destination",
  fixedLineId,
  excluded,
}: {
  current: Destination | null;
  recent: Destination[];
  onSelect: (d: Destination) => void;
  onClose: () => void;
  purpose?: "origin" | "destination";
  fixedLineId?: string;
  excluded?: Destination;
}) {
  const [lineId, setLineId] = useState(
    fixedLineId ?? current?.lineId ?? lines[0].id,
  );
  const [query, setQuery] = useState("");
  const normalizedQuery = query.toLowerCase().trim();
  const searching = !!normalizedQuery;
  const searchableLines = lines.filter((line) =>
    fixedLineId ? line.id === fixedLineId : searching || line.id === lineId,
  );
  const filtered = searchableLines
    .flatMap((line) =>
      line.stations.map((station) => ({
        ...station,
        lineId: line.id,
        lineName: line.name,
      })),
    )
    .filter((station) =>
      `${station.nameTh} ${station.nameEn} ${station.code}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  return (
    <Modal
      label={purpose === "origin" ? "เลือกสถานีที่ขึ้น" : "เลือกปลายทาง"}
      onClose={onClose}
    >
      <div className="modal-title">
        <h2>{purpose === "origin" ? "ขึ้นจากสถานีไหน?" : "ไปลงสถานีไหนดี?"}</h2>
        <button className="icon-button" aria-label="ปิด" onClick={onClose}>
          <X />
        </button>
      </div>
      <p className="modal-subtitle">
        เลือกได้ทุกสาย ระบบจะคำนวณจุดเปลี่ยนสายให้
      </p>
      <div className="search-input">
        <Search size={20} />
        <input
          aria-label="ค้นหาสถานี"
          placeholder="ชื่อสถานี ภาษาไทย / English / รหัส"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {recent.length > 0 && (
        <>
          <h3 className="section-label">ปลายทางล่าสุด</h3>
          <div className="recent-list">
            {recent
              .filter(
                (d) =>
                  (!fixedLineId || d.lineId === fixedLineId) &&
                  (d.lineId !== excluded?.lineId ||
                    d.stationId !== excluded.stationId),
              )
              .map((d) => (
                <button
                  key={`${d.lineId}:${d.stationId}`}
                  onClick={() => onSelect(d)}
                >
                  <Clock3 size={16} />
                  <strong>{getStation(d)?.nameTh}</strong>
                  <span>{getLine(d.lineId)?.name}</span>
                </button>
              ))}
          </div>
        </>
      )}
      <h3 className="section-label">เลือกสายรถไฟฟ้า</h3>
      <div className="line-filters">
        {lines
          .filter((l) => !fixedLineId || l.id === fixedLineId)
          .map((l) => (
            <button
              key={l.id}
              aria-pressed={!searching && l.id === lineId}
              className={!searching && l.id === lineId ? "selected" : ""}
              style={{ "--line-color": l.color } as React.CSSProperties}
              onClick={() => {
                setLineId(l.id);
                setQuery("");
              }}
            >
              <span />
              {l.name}
            </button>
          ))}
      </div>
      <div className="station-list-heading">
        <h3 className="section-label">
          {searching && !fixedLineId ? "ผลค้นหาทุกสาย" : "รายชื่อสถานี"}
        </h3>
        <span>{filtered.length} สถานี</span>
      </div>
      <div className="station-list">
        {filtered.map((s) => (
          <button
            key={`${s.lineId}:${s.id}`}
            disabled={
              s.lineId === excluded?.lineId && s.id === excluded.stationId
            }
            onClick={() => onSelect({ lineId: s.lineId, stationId: s.id })}
          >
            <span className="list-node" />
            <div>
              <strong>{s.nameTh}</strong>
              <span>
                {s.nameEn}
                {searching ? ` · ${s.lineName}` : ""}
              </span>
            </div>
            <span className="station-code">{s.code}</span>
            {current?.stationId === s.id && current.lineId === s.lineId ? (
              <Check size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </button>
        ))}
        {!filtered.length && (
          <p className="empty-state">
            ไม่พบสถานี ลองเปลี่ยนคำค้นหรือเลือกสายอื่น
          </p>
        )}
      </div>
      <p className="coverage-note">
        รองรับการเปลี่ยนสายระหว่าง 4 สายที่แสดง
        <br />
        สายสีเหลืองและสีชมพูยังไม่เปิดให้ติดตาม
      </p>
    </Modal>
  );
}
