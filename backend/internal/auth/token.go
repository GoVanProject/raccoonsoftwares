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

type tokenClaims struct {
	Subject   string `json:"sub"`
	Expires   int64  `json:"exp"`
	TokenType string `json:"typ,omitempty"`
	ProjectID string `json:"project_id,omitempty"`
}

func NewTokenService(secret []byte, ttl time.Duration) *TokenService {
	return &TokenService{secret: append([]byte(nil), secret...), ttl: ttl}
}

func (s *TokenService) Create(userID string) (string, error) {
	if userID == "" || len(s.secret) < 32 {
		return "", errors.New("serviço de token não configurado")
	}
	return s.createToken(tokenClaims{Subject: userID}, s.ttl)
}

// CreateRoomTicket creates a short-lived token scoped to one project. It is
// used during the WebSocket upgrade because browsers cannot set Authorization
// headers on native WebSocket connections.
func (s *TokenService) CreateRoomTicket(userID, projectID string, ttl time.Duration) (string, error) {
	if userID == "" || projectID == "" || len(s.secret) < 32 {
		return "", errors.New("serviço de token não configurado")
	}
	if ttl <= 0 {
		ttl = 2 * time.Minute
	}
	return s.createToken(tokenClaims{Subject: userID, TokenType: "room", ProjectID: projectID}, ttl)
}

func (s *TokenService) createToken(claims tokenClaims, ttl time.Duration) (string, error) {
	now := time.Now()
	header := base64URL.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payloadMap := map[string]any{"sub": claims.Subject, "iat": now.Unix(), "exp": now.Add(ttl).Unix()}
	if claims.TokenType != "" {
		payloadMap["typ"] = claims.TokenType
	}
	if claims.ProjectID != "" {
		payloadMap["project_id"] = claims.ProjectID
	}
	payload, err := json.Marshal(payloadMap)
	if err != nil {
		return "", err
	}
	message := header + "." + base64URL.EncodeToString(payload)
	return message + "." + s.sign(message), nil
}

func (s *TokenService) Parse(token string) (string, error) {
	claims, err := s.parseToken(token)
	if err != nil {
		return "", err
	}
	if claims.TokenType == "room" {
		return "", errors.New("token de sala não pode autenticar esta operação")
	}
	return claims.Subject, nil
}

func (s *TokenService) ParseRoomTicket(token, projectID string) (string, error) {
	claims, err := s.parseToken(token)
	if err != nil {
		return "", err
	}
	if claims.TokenType != "room" || claims.ProjectID != projectID {
		return "", errors.New("ticket de sala inválido")
	}
	return claims.Subject, nil
}

func (s *TokenService) parseToken(token string) (tokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return tokenClaims{}, errors.New("token inválido")
	}
	expected := s.sign(parts[0] + "." + parts[1])
	if subtle.ConstantTimeCompare([]byte(expected), []byte(parts[2])) != 1 {
		return tokenClaims{}, errors.New("assinatura inválida")
	}
	headerBytes, err := base64URL.DecodeString(parts[0])
	if err != nil {
		return tokenClaims{}, errors.New("cabeçalho inválido")
	}
	var header struct {
		Alg string `json:"alg"`
	}
	if json.Unmarshal(headerBytes, &header) != nil || header.Alg != "HS256" {
		return tokenClaims{}, errors.New("algoritmo inválido")
	}
	payloadBytes, err := base64URL.DecodeString(parts[1])
	if err != nil {
		return tokenClaims{}, errors.New("payload inválido")
	}
	var claims tokenClaims
	if json.Unmarshal(payloadBytes, &claims) != nil || claims.Subject == "" {
		return tokenClaims{}, errors.New("payload inválido")
	}
	if claims.Expires <= time.Now().Unix() {
		return tokenClaims{}, errors.New("token expirado")
	}
	return claims, nil
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
