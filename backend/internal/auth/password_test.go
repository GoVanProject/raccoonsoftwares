package auth

import "testing"

func TestPasswordHashAndCheck(t *testing.T) {
	hash, err := HashPassword("senha-super-segura")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	if !CheckPassword("senha-super-segura", hash) {
		t.Fatal("a senha correta deveria ser aceita")
	}
	if CheckPassword("senha-errada", hash) {
		t.Fatal("uma senha incorreta não deveria ser aceita")
	}
}

func TestPasswordMinimumLength(t *testing.T) {
	if _, err := HashPassword("curta"); err == nil {
		t.Fatal("senha curta deveria ser rejeitada")
	}
}
