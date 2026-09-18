package api

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/raccoontech/taskboard/internal/store"
)

const (
	roomProtocol         = "raccoon-room-v1"
	roomTicketTTL        = 2 * time.Minute
	roomParticipantLimit = 10
	roomPublisherLimit   = 2
)

var (
	errRoomFull       = errors.New("a sala atingiu o limite de participantes")
	errPublishersFull = errors.New("já existem duas telas compartilhadas")
)

type roomIceServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

type roomPeer struct {
	ID         string `json:"id"`
	Alias      string `json:"alias"`
	Email      string `json:"email"`
	AvatarData string `json:"avatar_data,omitempty"`
	Publishing bool   `json:"publishing"`
	MicEnabled bool   `json:"mic_enabled"`
}

type roomMessage struct {
	Type    string          `json:"type"`
	Code    string          `json:"code,omitempty"`
	Message string          `json:"message,omitempty"`
	SelfID  string          `json:"self_id,omitempty"`
	Peer    *roomPeer       `json:"peer,omitempty"`
	Peers   []roomPeer      `json:"peers,omitempty"`
	From    string          `json:"from,omitempty"`
	Target  string          `json:"target,omitempty"`
	Signal  json.RawMessage `json:"signal,omitempty"`
}

type roomClientMessage struct {
	Type    string          `json:"type"`
	Target  string          `json:"target"`
	Enabled *bool           `json:"enabled"`
	Signal  json.RawMessage `json:"signal"`
}

type roomParticipant struct {
	id         string
	userID     string
	alias      string
	email      string
	avatarData string
	send       chan []byte
	publishing bool
	micEnabled bool
}

type room struct {
	participants map[string]*roomParticipant
}

type roomManager struct {
	mu    sync.Mutex
	rooms map[string]*room
}

func newRoomManager() *roomManager {
	return &roomManager{rooms: make(map[string]*room)}
}

func (m *roomManager) join(projectID string, participant *roomParticipant) error {
	m.mu.Lock()
	current := m.rooms[projectID]
	if current == nil {
		current = &room{participants: make(map[string]*roomParticipant)}
		m.rooms[projectID] = current
	}
	if len(current.participants) >= roomParticipantLimit {
		m.mu.Unlock()
		return errRoomFull
	}
	peers := make([]roomPeer, 0, len(current.participants))
	for _, existing := range current.participants {
		peers = append(peers, toRoomPeer(existing))
	}
	current.participants[participant.id] = participant
	m.mu.Unlock()

	enqueueRoomMessage(participant, roomMessage{Type: "room_state", SelfID: participant.id, Peer: pointerToRoomPeer(toRoomPeer(participant)), Peers: peers})
	m.broadcast(projectID, participant.id, roomMessage{Type: "peer_joined", Peer: pointerToRoomPeer(toRoomPeer(participant))})
	return nil
}

func (m *roomManager) leave(projectID, participantID string) {
	m.mu.Lock()
	current := m.rooms[projectID]
	if current == nil {
		m.mu.Unlock()
		return
	}
	participant, ok := current.participants[participantID]
	if !ok {
		m.mu.Unlock()
		return
	}
	delete(current.participants, participantID)
	if len(current.participants) == 0 {
		delete(m.rooms, projectID)
	}
	m.mu.Unlock()

	m.broadcast(projectID, "", roomMessage{Type: "peer_left", Peer: pointerToRoomPeer(toRoomPeer(participant))})
}

func (m *roomManager) setPublishing(projectID, participantID string, enabled bool) error {
	m.mu.Lock()
	current := m.rooms[projectID]
	if current == nil || current.participants[participantID] == nil {
		m.mu.Unlock()
		return store.ErrNotFound
	}
	participant := current.participants[participantID]
	if enabled && !participant.publishing {
		publishers := 0
		for _, peer := range current.participants {
			if peer.publishing {
				publishers++
			}
		}
		if publishers >= roomPublisherLimit {
			m.mu.Unlock()
			return errPublishersFull
		}
	}
	participant.publishing = enabled
	peer := toRoomPeer(participant)
	m.mu.Unlock()

	m.broadcast(projectID, "", roomMessage{Type: "peer_state", Peer: pointerToRoomPeer(peer)})
	return nil
}

func (m *roomManager) setMicEnabled(projectID, participantID string, enabled bool) error {
	m.mu.Lock()
	current := m.rooms[projectID]
	if current == nil || current.participants[participantID] == nil {
		m.mu.Unlock()
		return store.ErrNotFound
	}
	participant := current.participants[participantID]
	participant.micEnabled = enabled
	peer := toRoomPeer(participant)
	m.mu.Unlock()

	m.broadcast(projectID, "", roomMessage{Type: "peer_state", Peer: pointerToRoomPeer(peer)})
	return nil
}

func (m *roomManager) relay(projectID, senderID, targetID string, signal json.RawMessage) error {
	m.mu.Lock()
	current := m.rooms[projectID]
	if current == nil || current.participants[senderID] == nil || current.participants[targetID] == nil {
		m.mu.Unlock()
		return store.ErrNotFound
	}
	target := current.participants[targetID]
	m.mu.Unlock()

	enqueueRoomMessage(target, roomMessage{Type: "signal", From: senderID, Signal: signal})
	return nil
}

func (m *roomManager) broadcast(projectID, exceptID string, message roomMessage) {
	m.mu.Lock()
	current := m.rooms[projectID]
	if current == nil {
		m.mu.Unlock()
		return
	}
	participants := make([]*roomParticipant, 0, len(current.participants))
	for id, participant := range current.participants {
		if id != exceptID {
			participants = append(participants, participant)
		}
	}
	m.mu.Unlock()

	for _, participant := range participants {
		enqueueRoomMessage(participant, message)
	}
}

func toRoomPeer(participant *roomParticipant) roomPeer {
	return roomPeer{ID: participant.id, Alias: participant.alias, Email: participant.email, AvatarData: participant.avatarData, Publishing: participant.publishing, MicEnabled: participant.micEnabled}
}

func pointerToRoomPeer(peer roomPeer) *roomPeer {
	return &peer
}

func enqueueRoomMessage(participant *roomParticipant, message roomMessage) {
	payload, err := json.Marshal(message)
	if err != nil {
		return
	}
	select {
	case participant.send <- payload:
	default:
		// A stalled client cannot be allowed to block the room manager.
	}
}

func (s *Server) createRoomTicket(w http.ResponseWriter, r *http.Request, userID string) {
	project, err := s.store.ProjectByID(r.PathValue("projectID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a este projeto")
		return
	}
	ticket, err := s.tokens.CreateRoomTicket(userID, project.ID, roomTicketTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "não foi possível abrir a sala")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ticket":      ticket,
		"expires_at":  time.Now().UTC().Add(roomTicketTTL),
		"ice_servers": s.roomICEServers(userID),
	})
}

func (s *Server) roomICEServers(userID string) []roomIceServer {
	servers := make([]roomIceServer, 0, 2)
	if len(s.config.STUNURLs) > 0 {
		servers = append(servers, roomIceServer{URLs: append([]string(nil), s.config.STUNURLs...)})
	}
	if s.config.TURN == nil || s.config.TURN.Host == "" || s.config.TURN.Secret == "" {
		return servers
	}
	expires := time.Now().Add(10 * time.Minute).Unix()
	username := fmt.Sprintf("%d:%s", expires, userID)
	signature := hmac.New(sha1.New, []byte(s.config.TURN.Secret))
	_, _ = signature.Write([]byte(username))
	credential := base64.StdEncoding.EncodeToString(signature.Sum(nil))
	host := s.config.TURN.Host
	port := s.config.TURN.Port
	if port == 0 {
		port = 3478
	}
	servers = append(servers, roomIceServer{
		URLs:       []string{fmt.Sprintf("turn:%s:%d?transport=udp", host, port), fmt.Sprintf("turn:%s:%d?transport=tcp", host, port)},
		Username:   username,
		Credential: credential,
	})
	return servers
}

func roomTicketFromRequest(r *http.Request) string {
	for _, protocol := range strings.Split(r.Header.Get("Sec-WebSocket-Protocol"), ",") {
		protocol = strings.TrimSpace(protocol)
		if protocol != "" && protocol != roomProtocol {
			return protocol
		}
	}
	return ""
}

func newRoomParticipant(userID, email string, profile ...string) (*roomParticipant, error) {
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err != nil {
		return nil, err
	}
	alias := strings.Split(email, "@")[0]
	avatarData := ""
	if len(profile) > 0 && profile[0] != "" {
		alias = profile[0]
	}
	if len(profile) > 1 {
		avatarData = profile[1]
	}
	return &roomParticipant{id: hex.EncodeToString(bytes), userID: userID, alias: alias, email: email, avatarData: avatarData, send: make(chan []byte, 128)}, nil
}

func (s *Server) roomWebSocket(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("projectID")
	ticket := roomTicketFromRequest(r)
	userID, err := s.tokens.ParseRoomTicket(ticket, projectID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "ticket de sala inválido ou expirado")
		return
	}
	project, err := s.store.ProjectByID(projectID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a este projeto")
		return
	}
	user, err := s.store.UserByID(userID)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	upgrader := websocket.Upgrader{
		ReadBufferSize:  2048,
		WriteBufferSize: 8192,
		Subprotocols:    []string{roomProtocol},
		CheckOrigin: func(request *http.Request) bool {
			origin := request.Header.Get("Origin")
			return origin == "" || s.config.CORSOrigin == "" || origin == s.config.CORSOrigin
		},
	}
	connection, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	participant, err := newRoomParticipant(user.ID, user.Email, userAlias(user), user.AvatarData)
	if err != nil {
		_ = connection.Close()
		return
	}
	if err := s.rooms.join(projectID, participant); err != nil {
		enqueueRoomMessage(participant, roomMessage{Type: "error", Code: "room_full", Message: err.Error()})
		_ = connection.WriteJSON(roomMessage{Type: "error", Code: "room_full", Message: err.Error()})
		_ = connection.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseTryAgainLater, err.Error()), time.Now().Add(time.Second))
		_ = connection.Close()
		return
	}

	go participant.writePump(connection)
	participant.readPump(connection, func(message roomClientMessage) {
		s.handleRoomMessage(projectID, participant, message)
	})
	s.rooms.leave(projectID, participant.id)
	_ = connection.Close()
}

func (s *Server) handleRoomMessage(projectID string, participant *roomParticipant, message roomClientMessage) {
	switch message.Type {
	case "signal":
		if message.Target != "" && len(message.Signal) > 0 {
			_ = s.rooms.relay(projectID, participant.id, message.Target, message.Signal)
		}
	case "publish_request":
		if err := s.rooms.setPublishing(projectID, participant.id, true); err != nil {
			code := "publish_failed"
			if errors.Is(err, errPublishersFull) {
				code = "publish_full"
			}
			enqueueRoomMessage(participant, roomMessage{Type: "publish_rejected", Code: code, Message: err.Error()})
			return
		}
		enqueueRoomMessage(participant, roomMessage{Type: "publish_accepted"})
	case "publish_stop":
		_ = s.rooms.setPublishing(projectID, participant.id, false)
	case "mic_state":
		if message.Enabled != nil {
			_ = s.rooms.setMicEnabled(projectID, participant.id, *message.Enabled)
		}
	}
}

func (p *roomParticipant) readPump(connection *websocket.Conn, handle func(roomClientMessage)) {
	defer connection.Close()
	connection.SetReadLimit(1 << 20)
	_ = connection.SetReadDeadline(time.Now().Add(90 * time.Second))
	connection.SetPongHandler(func(string) error {
		return connection.SetReadDeadline(time.Now().Add(90 * time.Second))
	})
	for {
		_, payload, err := connection.ReadMessage()
		if err != nil {
			return
		}
		var message roomClientMessage
		if json.Unmarshal(payload, &message) == nil {
			handle(message)
		}
	}
}

func (p *roomParticipant) writePump(connection *websocket.Conn) {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case payload := <-p.send:
			_ = connection.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := connection.WriteMessage(websocket.TextMessage, payload); err != nil {
				return
			}
		case <-ticker.C:
			_ = connection.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := connection.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
