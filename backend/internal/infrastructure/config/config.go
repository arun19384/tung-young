package config

import (
	"errors"
	"github.com/spf13/viper"
	"os"
)

type Config struct {
	Env            string
	Port           string
	Origins        []string
	UpdateInterval int
	MaxAccuracy    float64
	StationRadius  float64
	MaxDistance    float64
}

func Load() (Config, error) {
	v := viper.New()
	v.SetDefault("APP_ENV", "development")
	v.SetDefault("PORT", "8080")
	v.SetDefault("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173", "http://localhost:4173"})
	v.SetDefault("LOCATION_UPDATE_INTERVAL", 4000)
	v.SetDefault("MAX_GPS_ACCURACY", 100)
	v.SetDefault("STATION_RADIUS", 90)
	v.SetDefault("MAX_ROUTE_DISTANCE", 300)
	// Local files are optional. Deployed functions take their settings from environment variables.
	if os.Getenv("VERCEL") == "" {
		v.SetConfigFile("backend/config.yaml")
		if err := v.ReadInConfig(); err != nil && !os.IsNotExist(err) {
			return Config{}, err
		}
		if f, err := os.Open(".env"); err == nil {
			defer f.Close()
			v.SetConfigType("env")
			if err = v.MergeConfig(f); err != nil {
				return Config{}, err
			}
		}
	}
	v.AutomaticEnv()
	cfg := Config{v.GetString("APP_ENV"), v.GetString("PORT"), v.GetStringSlice("CORS_ALLOWED_ORIGINS"), v.GetInt("LOCATION_UPDATE_INTERVAL"), v.GetFloat64("MAX_GPS_ACCURACY"), v.GetFloat64("STATION_RADIUS"), v.GetFloat64("MAX_ROUTE_DISTANCE")}
	if cfg.UpdateInterval < 1000 || cfg.UpdateInterval > 10000 || cfg.MaxAccuracy <= 0 || cfg.StationRadius <= 0 || cfg.MaxDistance <= 0 {
		return Config{}, errors.New("invalid tracking configuration")
	}
	return cfg, nil
}
