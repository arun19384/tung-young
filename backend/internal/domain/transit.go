package domain

import "math"

type Point struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}
type Station struct {
	ID     string  `json:"id"`
	Code   string  `json:"code"`
	NameTh string  `json:"nameTh"`
	NameEn string  `json:"nameEn"`
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
}

func (s Station) Point() Point { return Point{s.Lat, s.Lng} }

type Edge struct {
	From     string  `json:"from"`
	To       string  `json:"to"`
	Geometry []Point `json:"geometry"`
}
type Line struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	NameEn   string    `json:"nameEn"`
	Color    string    `json:"color"`
	Stations []Station `json:"stations"`
	Edges    []Edge    `json:"edges,omitempty"`
}

func (l Line) Station(id string) (Station, bool) {
	for _, s := range l.Stations {
		if s.ID == id {
			return s, true
		}
	}
	return Station{}, false
}

type Sample struct {
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
	Accuracy  float64  `json:"accuracy"`
	Speed     *float64 `json:"speed,omitempty"`
	Heading   *float64 `json:"heading,omitempty"`
	Timestamp int64    `json:"timestamp"`
}

func (s Sample) Point() Point { return Point{s.Latitude, s.Longitude} }
func Distance(a, b Point) float64 {
	x := (b.Lng - a.Lng) * math.Pi / 180 * 6371000 * math.Cos((a.Lat+b.Lat)*math.Pi/360)
	y := (b.Lat - a.Lat) * math.Pi / 180 * 6371000
	return math.Hypot(x, y)
}

// Project onto every leg of the adapter-provided rail polyline; return distance and normalized arc progress.
func Project(p Point, geometry []Point) (float64, float64) {
	best, along, total := math.Inf(1), 0.0, 0.0
	for i := 1; i < len(geometry); i++ {
		total += Distance(geometry[i-1], geometry[i])
	}
	walked := 0.0
	for i := 1; i < len(geometry); i++ {
		a, b := geometry[i-1], geometry[i]
		scale := math.Cos(p.Lat * math.Pi / 180)
		dx, dy := (b.Lng-a.Lng)*scale, b.Lat-a.Lat
		px, py := (p.Lng-a.Lng)*scale, p.Lat-a.Lat
		den := dx*dx + dy*dy
		t := 0.0
		if den > 0 {
			t = math.Max(0, math.Min(1, (px*dx+py*dy)/den))
		}
		q := Point{a.Lat + t*(b.Lat-a.Lat), a.Lng + t*(b.Lng-a.Lng)}
		d := Distance(p, q)
		length := Distance(a, b)
		if d < best {
			best = d
			along = walked + t*length
		}
		walked += length
	}
	if total == 0 {
		return best, 0
	}
	return best, along / total
}

type Match struct {
	Edge     Edge
	Progress float64
	Distance float64
}

func NearestSegment(line Line, p Point) Match {
	best := Match{Distance: math.Inf(1)}
	for _, e := range line.Edges {
		d, t := Project(p, e.Geometry)
		if d < best.Distance {
			best = Match{e, t, d}
		}
	}
	return best
}

// BFS uses topology rather than station codes (the Blue Line revisits Tha Phra).
func Path(l Line, from, to string) []Station {
	queue := [][]string{{from}}
	seen := map[string]bool{from: true}
	for len(queue) > 0 {
		path := queue[0]
		queue = queue[1:]
		last := path[len(path)-1]
		if last == to {
			result := []Station{}
			for _, id := range path {
				s, ok := l.Station(id)
				if !ok {
					return nil
				}
				result = append(result, s)
			}
			return result
		}
		for _, e := range l.Edges {
			next := ""
			if e.From == last {
				next = e.To
			} else if e.To == last {
				next = e.From
			}
			if next != "" && !seen[next] {
				seen[next] = true
				p := append([]string{}, path...)
				queue = append(queue, append(p, next))
			}
		}
	}
	return nil
}
