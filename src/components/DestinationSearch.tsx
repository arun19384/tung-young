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
}: {
  current: Destination | null;
  recent: Destination[];
  onSelect: (d: Destination) => void;
  onClose: () => void;
}) {
  const [lineId, setLineId] = useState(current?.lineId ?? lines[0].id);
  const [query, setQuery] = useState("");
  const line = getLine(lineId)!;
  const filtered = line.stations.filter((s) =>
    `${s.nameTh} ${s.nameEn} ${s.code}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <Modal label="เลือกปลายทาง" onClose={onClose}>
      <div className="modal-title">
        <h2>ไปลงสถานีไหนดี?</h2>
        <button className="icon-button" aria-label="ปิด" onClick={onClose}>
          <X />
        </button>
      </div>
      <p className="modal-subtitle">เลือกสถานีในสายที่คุณกำลังเดินทาง</p>
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
            {recent.map((d) => (
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
        {lines.map((l) => (
          <button
            key={l.id}
            aria-pressed={l.id === lineId}
            className={l.id === lineId ? "selected" : ""}
            style={{ "--line-color": l.color } as React.CSSProperties}
            onClick={() => setLineId(l.id)}
          >
            <span />
            {l.name}
          </button>
        ))}
      </div>
      <div className="station-list-heading">
        <h3 className="section-label">รายชื่อสถานี</h3>
        <span>{filtered.length} สถานี</span>
      </div>
      <div className="station-list">
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect({ lineId, stationId: s.id })}
          >
            <span className="list-node" />
            <div>
              <strong>{s.nameTh}</strong>
              <span>{s.nameEn}</span>
            </div>
            <span className="station-code">{s.code}</span>
            {current?.stationId === s.id && current.lineId === lineId ? (
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
        รองรับ 4 สายที่แสดง • ยังไม่คำนวณการเปลี่ยนสาย
        <br />
        สายสีเหลืองและสีชมพูยังไม่เปิดให้ติดตาม
      </p>
    </Modal>
  );
}
