package domain_test

import (
	"github.com/arun19384/tung-young/backend/internal/adapter/outbound/transit"
	"github.com/arun19384/tung-young/backend/internal/domain"
	"math"
	"testing"
)

func TestPolylineProjection(t *testing.T) {
	d, p := domain.Project(domain.Point{Lat: 13, Lng: 100.005}, []domain.Point{{Lat: 13, Lng: 100}, {Lat: 13, Lng: 100.01}, {Lat: 13.01, Lng: 100.01}})
	if d > 1 || p <= 0 || p >= .5 {
		t.Fatalf("distance=%f progress=%f", d, p)
	}
	_, p = domain.Project(domain.Point{Lat: 12, Lng: 99}, []domain.Point{{Lat: 13, Lng: 100}, {Lat: 13, Lng: 100.01}})
	if p != 0 {
		t.Fatal("clamp", p)
	}
}
func TestTopologyAndCoordinateSanity(t *testing.T) {
	repo, err := transit.New()
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range repo.Lines() {
		ids := map[string]bool{}
		for _, s := range l.Stations {
			if ids[s.ID] || s.Lat < 13 || s.Lat > 15 || s.Lng < 100 || s.Lng > 102 {
				t.Fatalf("invalid %s %+v", l.ID, s)
			}
			ids[s.ID] = true
		}
		for _, e := range l.Edges {
			a, _ := l.Station(e.From)
			b, _ := l.Station(e.To)
			d := domain.Distance(a.Point(), b.Point())
			if math.IsNaN(d) || d < 50 || d > 7000 {
				t.Fatalf("suspicious edge %s %s-%s: %fm", l.ID, e.From, e.To, d)
			}
		}
		if l.ID == "mrt-blue" {
			p := domain.Path(l, "BL32", "BL33")
			if len(p) != 3 || p[1].ID != "BL01" {
				t.Fatalf("must pass Tha Phra: %+v", p)
			}
		}
	}
}
