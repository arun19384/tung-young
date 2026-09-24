package transit

import (
	"embed"
	"encoding/json"
	"fmt"
	"github.com/arun19384/tung-young/backend/internal/domain"
)

//go:embed transit.json
var files embed.FS

type Repository struct{ lines []domain.Line }

func New() (*Repository, error) {
	b, err := files.ReadFile("transit.json")
	if err != nil {
		return nil, err
	}
	var data struct {
		Lines []domain.Line `json:"lines"`
	}
	if err = json.Unmarshal(b, &data); err != nil {
		return nil, err
	}
	for _, l := range data.Lines {
		if len(l.Stations) < 2 || len(l.Edges) == 0 {
			return nil, fmt.Errorf("invalid line %s", l.ID)
		}
		for _, e := range l.Edges {
			_, a := l.Station(e.From)
			_, b := l.Station(e.To)
			if !a || !b || len(e.Geometry) < 2 {
				return nil, fmt.Errorf("invalid edge in %s", l.ID)
			}
		}
	}
	return &Repository{data.Lines}, nil
}
func (r *Repository) Lines() []domain.Line { return r.lines }
