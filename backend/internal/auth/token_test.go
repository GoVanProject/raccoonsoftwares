package auth

import (
	"strings"
	"testing"
	"time"
)

func TestTokenService(t *testing.T) {
	service := NewTokenService([]byte(strings.Repeat("x", 32)), time.Hour)
	token, err := service.Create("user-1")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	userID, err := service.Parse(token)
	if err != nil || userID != "user-1" {
		t.Fatalf("Parse() = %q, %v", userID, err)
	}
	if _, err := service.Parse(token + "x"); err == nil {
		t.Fatal("token adulterado deveria ser rejeitado")
	}
}
