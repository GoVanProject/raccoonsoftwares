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

func TestRoomTicketIsScopedAndCannotBeUsedAsAccessToken(t *testing.T) {
	service := NewTokenService([]byte(strings.Repeat("x", 32)), time.Hour)
	ticket, err := service.CreateRoomTicket("user-1", "project-1", time.Minute)
	if err != nil {
		t.Fatalf("CreateRoomTicket() error = %v", err)
	}
	if userID, err := service.ParseRoomTicket(ticket, "project-1"); err != nil || userID != "user-1" {
		t.Fatalf("ParseRoomTicket() = %q, %v", userID, err)
	}
	if _, err := service.ParseRoomTicket(ticket, "project-2"); err == nil {
		t.Fatal("ticket deveria ser rejeitado para outro projeto")
	}
	if _, err := service.Parse(ticket); err == nil {
		t.Fatal("ticket de sala não deveria autenticar uma chamada REST")
	}
}
