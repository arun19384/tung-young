package service

import (
	"errors"
	"github.com/arun19384/tung-young/backend/internal/application/port/outbound"
	"github.com/arun19384/tung-young/backend/internal/domain"
	"math"
	"time"
)

type ResolveRequest struct {
	LineID               string          `json:"lineId"`
	DestinationStationID string          `json:"destinationStationId"`
	Samples              []domain.Sample `json:"samples"`
	DestinationLineID    string          `json:"destinationLineId"`
}
type Resolution struct {
	Status            string           `json:"status"`
	Message           string           `json:"message,omitempty"`
	Line              *domain.Line     `json:"line,omitempty"`
	PreviousStation   *domain.Station  `json:"previousStation,omitempty"`
	NextStation       *domain.Station  `json:"nextStation,omitempty"`
	Destination       *domain.Station  `json:"destination,omitempty"`
	Route             []domain.Station `json:"route,omitempty"`
	Progress          float64          `json:"progress"`
	RemainingStations int              `json:"remainingStations"`
	Confidence        float64          `json:"confidence"`
	Arrived           bool             `json:"arrived"`
	WrongDirection    bool             `json:"wrongDirection"`
	Direction         string           `json:"direction,omitempty"`
	ETA               int              `json:"etaMinutes"`
	Timestamp         int64            `json:"timestamp"`
	Distance          float64          `json:"distanceMeters"`
}
type Resolver struct {
	Repo          outbound.TransitRepository
	MaxAccuracy   float64
	StationRadius float64
	MaxDistance   float64
}

func (r Resolver) Lines() []domain.Line { return r.Repo.Lines() }
func (r Resolver) Resolve(req ResolveRequest, now time.Time) (Resolution, error) {
	if len(req.Samples) == 0 || len(req.Samples) > 12 {
		return Resolution{}, errors.New("samples must contain 1–12 positions")
	}
	for i, s := range req.Samples {
		if math.IsNaN(s.Latitude) || math.IsNaN(s.Longitude) || s.Latitude < -90 || s.Latitude > 90 || s.Longitude < -180 || s.Longitude > 180 || s.Accuracy <= 0 || s.Accuracy > 100000 || s.Timestamp <= 0 || s.Timestamp > now.UnixMilli()+5000 {
			return Resolution{}, errors.New("invalid position")
		}
		if i > 0 && s.Timestamp <= req.Samples[i-1].Timestamp {
			return Resolution{}, errors.New("timestamps must increase")
		}
	}
	latest := req.Samples[len(req.Samples)-1]
	empty := Resolution{Timestamp: latest.Timestamp}
	if now.UnixMilli()-latest.Timestamp > 20000 {
		empty.Status = "stale"
		empty.Message = "ตำแหน่งเก่าเกินไป กำลังรอสัญญาณใหม่"
		return empty, nil
	}
	if latest.Accuracy > r.MaxAccuracy {
		empty.Status = "low_accuracy"
		empty.Message = "สัญญาณ GPS ยังไม่แม่นพอ"
		return empty, nil
	}
	var line domain.Line
	best := math.Inf(1)
	for _, l := range r.Repo.Lines() {
		if req.LineID != "" && l.ID != req.LineID {
			continue
		}
		m := domain.NearestSegment(l, latest.Point())
		if m.Distance < best {
			best = m.Distance
			line = l
		}
	}
	if line.ID == "" {
		return Resolution{}, errors.New("unknown line")
	}
	if best > r.MaxDistance {
		empty.Status = "off_route"
		empty.Message = "ยังไม่อยู่ใกล้เส้นทางที่เลือก หรือ GPS คลาดเคลื่อน"
		return empty, nil
	}
	destinationLine := line
	if req.DestinationLineID != "" {
		found := false
		for _, candidate := range r.Repo.Lines() {
			if candidate.ID == req.DestinationLineID {
				destinationLine, found = candidate, true
				break
			}
		}
		if !found {
			return Resolution{}, errors.New("unknown destination line")
		}
	}
	dest, hasDest := destinationLine.Station(req.DestinationStationID)
	if req.DestinationStationID != "" && !hasDest {
		return Resolution{}, errors.New("destination is not on the selected line")
	}
	valid := []domain.Sample{}
	matches := []domain.Match{}
	for _, s := range req.Samples {
		if now.UnixMilli()-s.Timestamp > 60000 || s.Accuracy > r.MaxAccuracy {
			continue
		}
		if len(valid) > 0 {
			prev := valid[len(valid)-1]
			dt := float64(s.Timestamp-prev.Timestamp) / 1000
			if domain.Distance(prev.Point(), s.Point()) > dt*45+prev.Accuracy+s.Accuracy {
				if s.Timestamp == latest.Timestamp {
					empty.Status = "jump"
					empty.Message = "ตำแหน่งกระโดด กำลังรอยืนยันอีกครั้ง"
					return empty, nil
				}
				continue
			}
		}
		m := domain.NearestSegment(line, s.Point())
		if m.Distance <= r.MaxDistance {
			valid = append(valid, s)
			matches = append(matches, m)
		}
	}
	if len(valid) < 3 || valid[len(valid)-1].Timestamp-valid[len(valid)-3].Timestamp < 4000 {
		empty.Status = "acquiring"
		empty.Message = "กำลังยืนยันตำแหน่งจากสัญญาณหลายจุด"
		return empty, nil
	}
	// Select the most recent segment confirmed by three consecutive fixes.
	confirmed := -1
	for i := 2; i < len(matches); i++ {
		if sameEdge(matches[i], matches[i-1]) && sameEdge(matches[i], matches[i-2]) && valid[i].Timestamp-valid[i-2].Timestamp >= 4000 {
			confirmed = i
		}
	}
	if confirmed < 0 {
		empty.Status = "acquiring"
		empty.Message = "กำลังยืนยันการผ่านสถานี"
		return empty, nil
	}
	match := matches[confirmed]
	edge := match.Edge
	if !sameEdge(match, matches[len(matches)-1]) {
		empty.Status = "transition"
		empty.Message = "กำลังยืนยันสถานีถัดไป"
		return empty, nil
	}
	progress := 0.0
	count := 0
	for i := len(matches) - 1; i >= 0 && count < 3; i-- {
		if !sameEdge(match, matches[i]) {
			break
		}
		progress += matches[i].Progress
		count++
	}
	progress /= float64(count)
	from, _ := line.Station(edge.From)
	to, _ := line.Station(edge.To)
	route := []domain.Station{from, to}
	reverse := false
	if hasDest {
		a, b := networkPath(r.Repo.Lines(), line.ID, edge.From, destinationLine.ID, dest.ID), networkPath(r.Repo.Lines(), line.ID, edge.To, destinationLine.ID, dest.ID)
		if len(a) == 0 || len(b) == 0 {
			return Resolution{}, errors.New("no connected route")
		}
		reverse = float64(len(a)-1)+progress < float64(len(b)-1)+1-progress
		if reverse {
			route = append([]domain.Station{to}, a...)
		} else {
			route = append([]domain.Station{from}, b...)
		}
	}
	observed := matches[len(matches)-1].Progress - matches[max(0, len(matches)-3)].Progress
	if count < 3 {
		observed = 0
	}
	if !hasDest && observed < -0.015 {
		reverse = true
		route = []domain.Station{to, from}
	}
	if reverse {
		from, to = to, from
		progress = 1 - progress
	}
	// An arrival needs three fresh, accurate fixes near the destination, never one lucky point.
	arrived := hasDest
	for _, s := range valid[len(valid)-3:] {
		if s.Accuracy > 50 || domain.Distance(s.Point(), dest.Point()) > r.StationRadius {
			arrived = false
		}
	}
	summary := line
	summary.Stations = nil
	summary.Edges = nil
	result := Resolution{Status: "tracking", Line: &summary, PreviousStation: &from, NextStation: &to, Route: route, Progress: math.Max(0, math.Min(1, progress)), RemainingStations: len(route) - 1, Confidence: math.Max(0, 1-latest.Accuracy/r.MaxAccuracy*.4-best/r.MaxDistance*.3), Timestamp: latest.Timestamp, Distance: best, Direction: to.NameTh}
	if hasDest {
		result.Destination = &dest
		result.WrongDirection = math.Abs(observed) > .04 && ((observed > 0 && reverse) || (observed < 0 && !reverse))
		result.ETA = int(math.Ceil((float64(result.RemainingStations) - result.Progress) * 2))
		if arrived {
			result.Status = "arrived"
			result.Arrived = true
			result.RemainingStations = 0
			result.Progress = 1
			result.ETA = 0
			result.Route = []domain.Station{dest}
			result.PreviousStation = &dest
			result.NextStation = &dest
		}
	}
	return result, nil
}
func sameEdge(a, b domain.Match) bool { return a.Edge.From == b.Edge.From && a.Edge.To == b.Edge.To }

type networkStop struct{ lineID, stationID string }

// networkPath joins line topology with the official paid-area/walking interchanges
// supported by the app. Keeping line identity in the graph avoids collisions such as CEN.
func networkPath(lines []domain.Line, fromLine, fromID, toLine, toID string) []domain.Station {
	key := func(line, station string) string { return line + ":" + station }
	stations := map[string]domain.Station{}
	neighbours := map[string][]string{}
	connect := func(a, b string) { neighbours[a] = append(neighbours[a], b); neighbours[b] = append(neighbours[b], a) }
	for _, line := range lines {
		for _, station := range line.Stations {
			stations[key(line.ID, station.ID)] = station
		}
		for _, edge := range line.Edges {
			connect(key(line.ID, edge.From), key(line.ID, edge.To))
		}
	}
	transfers := [][2]networkStop{
		{{"bts-sukhumvit", "CEN"}, {"bts-silom", "CEN"}},
		{{"bts-sukhumvit", "E4"}, {"mrt-blue", "BL22"}},
		{{"bts-sukhumvit", "N8"}, {"mrt-blue", "BL13"}},
		{{"bts-silom", "S2"}, {"mrt-blue", "BL26"}},
		{{"bts-silom", "S12"}, {"mrt-blue", "BL34"}},
		{{"mrt-blue", "BL10"}, {"mrt-purple", "PP16"}},
	}
	for _, pair := range transfers {
		connect(key(pair[0].lineID, pair[0].stationID), key(pair[1].lineID, pair[1].stationID))
	}
	start, finish := key(fromLine, fromID), key(toLine, toID)
	queue, seen := [][]string{{start}}, map[string]bool{start: true}
	for len(queue) > 0 {
		path := queue[0]
		queue = queue[1:]
		last := path[len(path)-1]
		if last == finish {
			result := make([]domain.Station, 0, len(path))
			for _, id := range path {
				result = append(result, stations[id])
			}
			return result
		}
		for _, next := range neighbours[last] {
			if !seen[next] {
				seen[next] = true
				candidate := append([]string{}, path...)
				queue = append(queue, append(candidate, next))
			}
		}
	}
	return nil
}
