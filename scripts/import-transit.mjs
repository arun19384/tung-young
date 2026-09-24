import fs from "node:fs/promises";
// CC0 source. Import is explicit, never runs during installation or deployment.
const source =
  "https://raw.githubusercontent.com/Gusb3ll/thailand-public-train-data/main/dist/data.json";
await fs.mkdir(".cache", { recursive: true });
let sourceText;
try {
  sourceText = await fs.readFile(".cache/transit-source.json", "utf8");
} catch {
  const response = await fetch(source);
  if (!response.ok)
    throw new Error(`Dataset download failed: ${response.status}`);
  sourceText = await response.text();
  await fs.writeFile(".cache/transit-source.json", sourceText);
}
const raw = JSON.parse(sourceText);
const definitions = [
  ["bts-sukhumvit", "BTS สุขุมวิท", "Sukhumvit Line", "#24a16b"],
  ["bts-silom", "BTS สีลม", "Silom Line", "#008c94"],
  ["mrt-blue", "MRT สีน้ำเงิน", "Blue Line", "#2464df"],
  ["mrt-purple", "MRT สีม่วง", "Purple Line", "#985bc6"],
];
const fixes = {
  BL12: "กำแพงเพชร",
  BL21: "เพชรบุรี",
  BL34: "บางหว้า",
  BL35: "เพชรเกษม 48",
};
const lines = definitions.map(([id, name, nameEn, color]) => {
  let items = raw.filter((s) => s.lineNameEng === nameEn);
  const cen = raw.find((s) => s.stationId === "CEN");
  if (id === "bts-sukhumvit")
    items = [
      ...items.filter((s) => s.stationId.startsWith("N")).reverse(),
      cen,
      ...items.filter((s) => s.stationId.startsWith("E")),
    ];
  if (id === "bts-silom") items = [items[0], cen, ...items.slice(1)];
  const stations = items.map((s) => ({
    id: s.stationId,
    code: s.stationId,
    nameTh: fixes[s.stationId] ?? s.name.replaceAll("เเ", "แ"),
    nameEn:
      { CEN: "Siam", E2: "Phloen Chit", E7: "Ekkamai", BL34: "Bang Wa" }[
        s.stationId
      ] ?? s.nameEng,
    lat: Number(s.geoLat),
    lng: Number(s.geoLng),
  }));
  let order = stations.map((s) => s.id);
  if (id === "mrt-blue") order.splice(order.indexOf("BL33"), 0, "BL01");
  const edges = order.slice(1).map((to, i) => ({
    from: order[i],
    to,
    geometry: [
      stations.find((s) => s.id === order[i]),
      stations.find((s) => s.id === to),
    ].map((s) => ({ lat: s.lat, lng: s.lng })),
  }));
  return { id, name, nameEn, color, stations, edges };
});
const data = {
  version: "2026-09-24",
  source,
  license: "CC0-1.0",
  geometry: "station-chords",
  lines,
};
await fs.mkdir("backend/internal/adapter/outbound/transit", {
  recursive: true,
});
await fs.writeFile(
  "backend/internal/adapter/outbound/transit/transit.json",
  JSON.stringify(data, null, 2) + "\n",
);
await fs.mkdir("src/data", { recursive: true });
await fs.writeFile(
  "src/data/network.json",
  JSON.stringify(data, null, 2) + "\n",
);
console.log(
  lines
    .map(
      (l) =>
        `${l.name}: ${l.stations.length} stations, ${l.edges.length} edges`,
    )
    .join("\n"),
);
