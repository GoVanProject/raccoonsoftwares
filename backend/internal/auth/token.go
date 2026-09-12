package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var base64URL = base64.RawURLEncoding

type TokenService struct {
	secret []byte
	ttl    time.Duration
}

func NewTokenService(secret []byte, ttl time.Duration) *TokenService {
	return &TokenService{secret: append([]byte(nil), secret...), ttl: ttl}
}

func (s *TokenService) Create(userID string) (string, error) {
	if userID == "" || len(s.secret) < 32 {
		return "", errors.New("serviço de token não configurado")
	}
	now := time.Now()
	header := base64URL.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload, err := json.Marshal(map[string]any{
		"sub": userID,
		"iat": now.Unix(),
		"exp": now.Add(s.ttl).Unix(),
	})
	if err != nil {
		return "", err
	}
	message := header + "." + base64URL.EncodeToString(payload)
	return message + "." + s.sign(message), nil
}

func (s *TokenService) Parse(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", errors.New("token inválido")
	}
	expected := s.sign(parts[0] + "." + parts[1])
	if subtle.ConstantTimeCompare([]byte(expected), []byte(parts[2])) != 1 {
		return "", errors.New("assinatura inválida")
	}
	headerBytes, err := base64URL.DecodeString(parts[0])
	if err != nil {
		return "", errors.New("cabeçalho inválido")
	}
	var header struct {
		Alg string `json:"alg"`
	}
	if json.Unmarshal(headerBytes, &header) != nil || header.Alg != "HS256" {
		return "", errors.New("algoritmo inválido")
	}
	payloadBytes, err := base64URL.DecodeString(parts[1])
	if err != nil {
		return "", errors.New("payload inválido")
	}
	var payload struct {
		Subject string `json:"sub"`
		Expires int64  `json:"exp"`
	}
	if json.Unmarshal(payloadBytes, &payload) != nil || payload.Subject == "" {
		return "", errors.New("payload inválido")
	}
	if payload.Expires <= time.Now().Unix() {
		return "", errors.New("token expirado")
	}
	return payload.Subject, nil
}

func (s *TokenService) sign(message string) string {
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(message))
	return base64URL.EncodeToString(mac.Sum(nil))
}

func NewSecret() ([]byte, error) {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return nil, fmt.Errorf("gerar segredo: %w", err)
	}
	return secret, nil
}
