package backend

import (
	httpadapter "github.com/arun19384/tung-young/backend/internal/adapter/inbound/http"
	"github.com/arun19384/tung-young/backend/internal/adapter/outbound/transit"
	"github.com/arun19384/tung-young/backend/internal/application/service"
	"github.com/arun19384/tung-young/backend/internal/infrastructure/config"
	"github.com/gofiber/fiber/v3/middleware/adaptor"
	"net/http"
)

func NewHandler() (http.HandlerFunc, string, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, "", err
	}
	repo, err := transit.New()
	if err != nil {
		return nil, "", err
	}
	app := httpadapter.New(service.Resolver{Repo: repo, MaxAccuracy: cfg.MaxAccuracy, StationRadius: cfg.StationRadius, MaxDistance: cfg.MaxDistance}, cfg)
	return adaptor.FiberApp(app), cfg.Port, nil
}
