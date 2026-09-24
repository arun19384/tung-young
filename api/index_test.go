package handler

import (
	"net/http/httptest"
	"testing"
)

func TestVercelRewrite(t *testing.T) {
	for _, path := range []string{"/api/index?route=health", "/api/index?route=v1/lines", "/api/index?route=v1/stations/search&q=Siam"} {
		w := httptest.NewRecorder()
		Handler(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 {
			t.Fatalf("%s %d %s", path, w.Code, w.Body.String())
		}
	}
}
