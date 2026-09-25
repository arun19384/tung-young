package httpadapter

import (
	"github.com/arun19384/tung-young/backend/internal/application/port/inbound"
	"github.com/arun19384/tung-young/backend/internal/application/service"
	"github.com/arun19384/tung-young/backend/internal/domain"
	"github.com/arun19384/tung-young/backend/internal/infrastructure/config"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"strings"
	"time"
)

func New(r inbound.TransitUseCase, cfg config.Config) *fiber.App {
	mrtFares := newMRTFareClient()
	app := fiber.New(fiber.Config{BodyLimit: 16 * 1024, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, ErrorHandler: func(c fiber.Ctx, err error) error {
		code := 500
		if e, ok := err.(*fiber.Error); ok {
			code = e.Code
		}
		return c.Status(code).JSON(fiber.Map{"error": "request failed"})
	}})
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{AllowOrigins: cfg.Origins, AllowMethods: []string{"GET", "POST", "OPTIONS"}, AllowHeaders: []string{"Content-Type"}}))
	app.Use(func(c fiber.Ctx) error {
		c.Set("Cache-Control", "no-store")
		c.Set("X-Content-Type-Options", "nosniff")
		return c.Next()
	})
	health := func(c fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ok"}) }
	app.Get("/health", health)
	app.Get("/api/health", health)
	app.Get("/api/v1/config", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"locationUpdateInterval": cfg.UpdateInterval, "maxGpsAccuracy": cfg.MaxAccuracy})
	})
	app.Get("/api/v1/lines", func(c fiber.Ctx) error {
		lines := []domain.Line{}
		for _, l := range r.Lines() {
			l.Edges = nil
			lines = append(lines, l)
		}
		return c.JSON(lines)
	})
	app.Get("/api/v1/lines/:lineId/stations", func(c fiber.Ctx) error {
		for _, l := range r.Lines() {
			if l.ID == c.Params("lineId") {
				return c.JSON(l.Stations)
			}
		}
		return c.Status(404).JSON(fiber.Map{"error": "line not found"})
	})
	stations := func(c fiber.Ctx) error {
		result := []fiber.Map{}
		q := strings.ToLower(strings.TrimSpace(c.Query("q")))
		for _, l := range r.Lines() {
			for _, s := range l.Stations {
				if strings.Contains(strings.ToLower(s.NameTh+" "+s.NameEn+" "+s.Code), q) {
					result = append(result, fiber.Map{"lineId": l.ID, "station": s})
				}
			}
		}
		return c.JSON(result)
	}
	app.Get("/api/v1/stations", stations)
	app.Get("/api/v1/stations/search", stations)
	app.Get("/api/v1/fares/mrt", func(c fiber.Ctx) error {
		fare, err := mrtFares.Fare(c.Context(), c.Query("from"), c.Query("to"))
		if err != nil {
			return c.Status(502).JSON(fiber.Map{"error": "official fare unavailable"})
		}
		return c.JSON(fiber.Map{"fare": fare, "currency": "THB", "passengerType": "adult", "source": "BEM official fare calculator"})
	})
	app.Post("/api/v1/location/resolve", func(c fiber.Ctx) error {
		var req service.ResolveRequest
		if !strings.HasPrefix(c.Get("Content-Type"), "application/json") {
			return c.Status(415).JSON(fiber.Map{"error": "JSON required"})
		}
		if err := c.Bind().JSON(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid JSON"})
		}
		result, err := r.Resolve(req, time.Now())
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(result)
	})
	app.Use(func(c fiber.Ctx) error { return c.Status(404).JSON(fiber.Map{"error": "not found"}) })
	return app
}
