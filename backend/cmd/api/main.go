package main

import (
	"github.com/arun19384/tung-young/backend"
	"log"
	"net/http"
	"time"
)

func main() {
	handler, port, err := backend.NewHandler()
	if err != nil {
		log.Fatal(err)
	}
	server := http.Server{Addr: ":" + port, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("API listening on :%s", port)
	log.Fatal(server.ListenAndServe())
}
