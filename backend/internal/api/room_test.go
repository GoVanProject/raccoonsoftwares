package api

import (
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/raccoontech/taskboard/internal/auth"
	"github.com/raccoontech/taskboard/internal/store"
)

func TestRoomManagerLimitsParticipantsAndPublishers(t *testing.T) {
	manager := newRoomManager()
	participants := make([]*roomParticipant, 0, roomParticipantLimit)
	for index := 0; index < roomParticipantLimit; index++ {
		participant, err := newRoomParticipant("user-"+string(rune('a'+index)), "user@example.com")
		if err != nil {
			t.Fatal(err)
		}
		participants = append(participants, participant)
		if err := manager.join("project-1", participant); err != nil {
			t.Fatalf("join() participant %d: %v", index, err)
		}
	}
	extra, err := newRoomParticipant("extra", "extra@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.join("project-1", extra); err != errRoomFull {
		t.Fatalf("join() error = %v, expected room full", err)
	}

	if err := manager.setPublishing("project-1", participants[0].id, true); err != nil {
		t.Fatal(err)
	}
	if err := manager.setPublishing("project-1", participants[1].id, true); err != nil {
		t.Fatal(err)
	}
	if err := manager.setPublishing("project-1", participants[2].id, true); err != errPublishersFull {
		t.Fatalf("setPublishing() error = %v, expected publishers full", err)
	}

	manager.leave("project-1", participants[0].id)
	if err := manager.setPublishing("project-1", participants[2].id, true); err != nil {
		t.Fatalf("setPublishing() after leave: %v", err)
	}
	manager.leave("project-1", participants[1].id)
	manager.leave("project-1", participants[2].id)
	for _, participant := range participants[3:] {
		manager.leave("project-1", participant.id)
	}
	if err := manager.setMicEnabled("project-1", "missing", true); err != store.ErrNotFound {
		t.Fatalf("setMicEnabled() error = %v, expected not found", err)
	}
}

func TestRoomTicketDoesNotRequireTurnConfiguration(t *testing.T) {
	server := &Server{config: Config{STUNURLs: []string{"stun:localhost:3478"}}}
	servers := server.roomICEServers(strings.Repeat("u", 8))
	if len(servers) != 1 || servers[0].URLs[0] != "stun:localhost:3478" {
		t.Fatalf("roomICEServers() = %#v", servers)
	}
}

func TestRoomWebSocketAcceptsScopedTicket(t *testing.T) {
	database, err := store.New(t.TempDir() + "/taskboard.json")
	if err != nil {
		t.Fatal(err)
	}
	user, err := database.CreateUser("owner@example.com", "hash")
	if err != nil {
		t.Fatal(err)
	}
	project, err := database.CreateProject(user.ID, "Projeto ao vivo", "", "")
	if err != nil {
		t.Fatal(err)
	}
	tokens := auth.NewTokenService([]byte(strings.Repeat("s", 32)), time.Hour)
	server := NewServer(database, tokens, Config{CORSOrigin: "http://localhost:3000"})
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Skipf("ambiente não permite abrir listener para teste WebSocket: %v", err)
	}
	httpServer := httptest.NewUnstartedServer(server.Handler())
	httpServer.Listener = listener
	httpServer.Start()
	defer httpServer.Close()

	ticket, err := tokens.CreateRoomTicket(user.ID, project.ID, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	wsURL := "ws" + strings.TrimPrefix(httpServer.URL, "http") + "/api/projects/" + project.ID + "/room/ws"
	dialer := websocket.Dialer{Subprotocols: []string{roomProtocol, ticket}}
	connection, response, err := dialer.Dial(wsURL, http.Header{"Origin": []string{"http://localhost:3000"}})
	if err != nil {
		if response != nil {
			t.Fatalf("Dial() status = %s, error = %v", response.Status, err)
		}
		t.Fatal(err)
	}
	defer connection.Close()

	var message roomMessage
	if err := connection.ReadJSON(&message); err != nil {
		t.Fatal(err)
	}
	if message.Type != "room_state" || message.SelfID == "" {
		t.Fatalf("room state inválido: %#v", message)
	}
}
