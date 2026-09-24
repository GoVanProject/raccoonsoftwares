package store

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestTranslatePostgresUniqueViolationToConflict(t *testing.T) {
	err := translatePostgresError(&pgconn.PgError{Code: "23505"})
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("translatePostgresError() = %v, want ErrConflict", err)
	}
}
