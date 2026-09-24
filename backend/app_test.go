package backend

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHTTPAPI(t *testing.T) {
	handler, _, err := NewHandler()
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		method, path, body string
		want               int
	}{{"GET", "/health", "", 200}, {"GET", "/api/v1/lines", "", 200}, {"GET", "/api/v1/lines/mrt-blue/stations", "", 200}, {"GET", "/api/v1/stations/search?q=Siam", "", 200}, {"GET", "/api/v1/lines/nope/stations", "", 404}, {"POST", "/api/v1/location/resolve", `{"samples":[]}`, 400}, {"POST", "/api/v1/location/resolve", `{bad`, 400}, {"GET", "/api/not-found", "", 404}} {
		t.Run(tc.path+tc.body, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			handler(w, req)
			if w.Code != tc.want {
				t.Fatalf("got %d %s", w.Code, w.Body.String())
			}
			if !json.Valid(w.Body.Bytes()) {
				t.Fatal("not JSON")
			}
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("API must not cache location")
			}
		})
	}
}
func TestBodyLimit(t *testing.T) {
	h, _, _ := NewHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/location/resolve", strings.NewReader(strings.Repeat("x", 20000)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h(w, req)
	if w.Code != 413 {
		t.Fatalf("got %d", w.Code)
	}
}
