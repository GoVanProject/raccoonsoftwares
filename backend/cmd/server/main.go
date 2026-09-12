package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/raccoontech/taskboard/internal/api"
	"github.com/raccoontech/taskboard/internal/auth"
	"github.com/raccoontech/taskboard/internal/store"
)

func main() {
	dataFile := envOrDefault("DATA_FILE", "./data/taskboard.json")
	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET precisa ter pelo menos 32 caracteres")
	}

	database, err := store.New(dataFile)
	if err != nil {
		log.Fatalf("abrir armazenamento: %v", err)
	}

	server := api.NewServer(database, auth.NewTokenService([]byte(jwtSecret), 24*time.Hour), api.Config{
		CORSOrigin: envOrDefault("CORS_ORIGIN", "http://localhost:3000"),
	})

	address := envOrDefault("ADDRESS", ":8080")
	log.Printf("taskboard API ouvindo em %s", address)
	if err := http.ListenAndServe(address, server.Handler()); err != nil {
		log.Fatal(err)
	}
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
