export interface Station {
  id: string;
  nameTh: string;
  nameEn: string;
  code: string;
  lat: number;
  lng: number;
}
export interface Line {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  stations: Station[];
}
export interface Destination {
  lineId: string;
  stationId: string;
}
export interface Sample {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}
export interface Resolution {
  status: string;
  message?: string;
  line?: Line;
  previousStation?: Station;
  nextStation?: Station;
  destination?: Station;
  route?: Station[];
  progress: number;
  remainingStations: number;
  confidence: number;
  arrived: boolean;
  wrongDirection: boolean;
  direction?: string;
  etaMinutes: number;
  timestamp: number;
  distanceMeters: number;
}
