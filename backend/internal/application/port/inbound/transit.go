package inbound

import (
	"github.com/arun19384/tung-young/backend/internal/application/service"
	"github.com/arun19384/tung-young/backend/internal/domain"
	"time"
)

type TransitUseCase interface {
	Lines() []domain.Line
	Resolve(service.ResolveRequest, time.Time) (service.Resolution, error)
}
