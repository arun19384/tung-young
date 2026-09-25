package service

import (
	"github.com/arun19384/tung-young/backend/internal/adapter/outbound/transit"
	"github.com/arun19384/tung-young/backend/internal/domain"
	"testing"
	"time"
)

func fixture(t *testing.T) (Resolver, domain.Line) {
	t.Helper()
	repo, err := transit.New()
	if err != nil {
		t.Fatal(err)
	}
	return Resolver{Repo: repo, MaxAccuracy: 100, StationRadius: 90, MaxDistance: 300}, repo.Lines()[0]
}
func samplesAt(a, b domain.Station, progress []float64, now time.Time) []domain.Sample {
	out := []domain.Sample{}
	for i, p := range progress {
		out = append(out, domain.Sample{Latitude: a.Lat + (b.Lat-a.Lat)*p, Longitude: a.Lng + (b.Lng-a.Lng)*p, Accuracy: 8, Timestamp: now.Add(time.Duration(i-len(progress)+1) * 4 * time.Second).UnixMilli()})
	}
	return out
}
func TestAsokToSiamAndReverse(t *testing.T) {
	r, l := fixture(t)
	a, _ := l.Station("E4")
	b, _ := l.Station("E3")
	now := time.Now()
	for _, tc := range []struct {
		dest, prev, next string
		remaining        int
	}{{"CEN", "E4", "E3", 4}, {"E5", "E3", "E4", 2}} {
		got, err := r.Resolve(ResolveRequest{LineID: l.ID, DestinationStationID: tc.dest, Samples: samplesAt(a, b, []float64{.35, .4, .45}, now)}, now)
		if err != nil {
			t.Fatal(err)
		}
		if got.Status != "tracking" || got.PreviousStation.ID != tc.prev || got.NextStation.ID != tc.next || got.RemainingStations != tc.remaining || got.Progress < 0 || got.Progress > 1 {
			t.Fatalf("unexpected resolution %+v", got)
		}
		if tc.dest == "E5" && !got.WrongDirection {
			t.Fatal("must detect movement away from destination")
		}
	}
}
func TestRejectUnreliableFixes(t *testing.T) {
	r, l := fixture(t)
	a, _ := l.Station("E4")
	b, _ := l.Station("E3")
	now := time.Now()
	for _, tc := range []struct {
		name, status string
		edit         func([]domain.Sample) []domain.Sample
	}{
		{"single", "acquiring", func(s []domain.Sample) []domain.Sample { return s[2:] }},
		{"poor accuracy", "low_accuracy", func(s []domain.Sample) []domain.Sample { s[2].Accuracy = 500; return s }},
		{"stale", "stale", func(s []domain.Sample) []domain.Sample {
			for i := range s {
				s[i].Timestamp -= 30000
			}
			return s
		}},
		{"off route", "off_route", func(s []domain.Sample) []domain.Sample { s[2].Latitude = 12.5; return s }},
		{"jump", "jump", func(s []domain.Sample) []domain.Sample {
			far, _ := l.Station("E8")
			s[2].Latitude = far.Lat
			s[2].Longitude = far.Lng
			return s
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := r.Resolve(ResolveRequest{LineID: l.ID, DestinationStationID: "CEN", Samples: tc.edit(samplesAt(a, b, []float64{.3, .35, .4}, now))}, now)
			if err != nil || got.Status != tc.status || got.Arrived {
				t.Fatalf("%+v %v", got, err)
			}
		})
	}
}
func TestArrivalRequiresRepeatedFixes(t *testing.T) {
	r, l := fixture(t)
	dest, _ := l.Station("CEN")
	now := time.Now()
	s := samplesAt(dest, dest, []float64{0, 0, 0}, now)
	got, err := r.Resolve(ResolveRequest{LineID: l.ID, DestinationStationID: "CEN", Samples: s}, now)
	if err != nil || !got.Arrived || got.RemainingStations != 0 {
		t.Fatalf("arrival %+v %v", got, err)
	}
	s[2].Accuracy = 70
	got, err = r.Resolve(ResolveRequest{LineID: l.ID, DestinationStationID: "CEN", Samples: s}, now)
	if err != nil || got.Arrived {
		t.Fatalf("inaccurate fix must not confirm arrival: %+v %v", got, err)
	}
}
func TestSingleBoundaryFixDoesNotAdvance(t *testing.T) {
	r, l := fixture(t)
	a, _ := l.Station("E4")
	b, _ := l.Station("E3")
	c, _ := l.Station("E2")
	now := time.Now()
	s := samplesAt(a, b, []float64{.8, .9, .99}, now.Add(-4*time.Second))
	tail := samplesAt(b, c, []float64{.04}, now)
	s = append(s, tail...)
	got, err := r.Resolve(ResolveRequest{LineID: l.ID, DestinationStationID: "CEN", Samples: s}, now)
	if err != nil || got.Status != "transition" {
		t.Fatalf("single crossing %+v %v", got, err)
	}
}
func TestInvalidDestinationAndTimestamp(t *testing.T) {
	r, l := fixture(t)
	a, _ := l.Station("E4")
	now := time.Now()
	s := samplesAt(a, a, []float64{0, 0, 0}, now)
	if _, err := r.Resolve(ResolveRequest{LineID: l.ID, DestinationStationID: "BL01", Samples: s}, now); err == nil {
		t.Fatal("must reject wrong-line destination")
	}
	s[2].Timestamp = s[1].Timestamp
	if _, err := r.Resolve(ResolveRequest{LineID: l.ID, DestinationStationID: "CEN", Samples: s}, now); err == nil {
		t.Fatal("duplicate fixes must not confirm station")
	}
}

func TestCrossLineRoute(t *testing.T) {
	r, l := fixture(t)
	a, _ := l.Station("E4")
	b, _ := l.Station("E3")
	now := time.Now()
	got, err := r.Resolve(ResolveRequest{DestinationStationID: "BL01", DestinationLineID: "mrt-blue", Samples: samplesAt(a, b, []float64{.35, .4, .45}, now)}, now)
	if err != nil || got.Status != "tracking" || got.Destination.ID != "BL01" || got.RemainingStations < 2 {
		t.Fatalf("cross-line resolution %+v %v", got, err)
	}
}
