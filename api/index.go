package handler

import (
	"github.com/arun19384/tung-young/backend"
	"net/http"
	"strings"
	"sync"
)

var once sync.Once
var app http.HandlerFunc
var initErr error

func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(func() { app, _, initErr = backend.NewHandler() })
	if initErr != nil {
		http.Error(w, "API configuration error", http.StatusServiceUnavailable)
		return
	}
	// Explicit route survives platform rewrites; local direct API paths still work.
	if route := r.URL.Query().Get("route"); route != "" {
		clone := r.Clone(r.Context())
		url := *r.URL
		url.Path = "/api/" + strings.TrimPrefix(route, "/")
		url.RawPath = ""
		query := url.Query()
		query.Del("route")
		url.RawQuery = query.Encode()
		clone.URL = &url
		clone.RequestURI = url.RequestURI()
		r = clone
	}
	app(w, r)
}
