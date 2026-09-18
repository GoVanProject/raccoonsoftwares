package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/raccoontech/taskboard/internal/api"
	"github.com/raccoontech/taskboard/internal/auth"
	"github.com/raccoontech/taskboard/internal/store"
)

func main() {
	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET precisa ter pelo menos 32 caracteres")
	}

	database, err := store.NewPostgres(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("abrir banco de dados: %v", err)
	}
	defer database.Close()

	server := api.NewServer(database, auth.NewTokenService([]byte(jwtSecret), 24*time.Hour), api.Config{
		CORSOrigin: envOrDefault("CORS_ORIGIN", "http://localhost:3000"),
		STUNURLs:   splitEnv("STUN_URLS"),
		TURN:       turnConfigFromEnv(),
	})

	address := envOrDefault("ADDRESS", ":8080")
	httpServer := &http.Server{
		Addr:              address,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	shutdownSignal, stopSignal := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignal()

	log.Printf("taskboard API ouvindo em %s", address)
	serverError := make(chan error, 1)
	go func() {
		serverError <- httpServer.ListenAndServe()
	}()

	select {
	case err := <-serverError:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	case <-shutdownSignal.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownContext); err != nil {
			log.Printf("encerrar API: %v", err)
		}
	}
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func splitEnv(key string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func turnConfigFromEnv() *api.TURNConfig {
	host := strings.TrimSpace(os.Getenv("TURN_HOST"))
	secret := strings.TrimSpace(os.Getenv("TURN_SECRET"))
	if host == "" || secret == "" {
		return nil
	}
	port := 3478
	if configured := strings.TrimSpace(os.Getenv("TURN_PORT")); configured != "" {
		if parsed, err := strconv.Atoi(configured); err == nil && parsed > 0 && parsed < 65536 {
			port = parsed
		}
	}
	return &api.TURNConfig{Host: host, Port: port, Secret: secret}
}
