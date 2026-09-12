package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/raccoontech/taskboard/internal/auth"
	"github.com/raccoontech/taskboard/internal/store"
)

func TestKanbanFlow(t *testing.T) {
	database, err := store.New(t.TempDir() + "/taskboard.json")
	if err != nil {
		t.Fatal(err)
	}
	server := NewServer(database, auth.NewTokenService([]byte(strings.Repeat("s", 32)), time.Hour), Config{CORSOrigin: "http://localhost:3000"})
	handler := server.Handler()

	owner := call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{"email": "owner@example.com", "password": "senha-owner"}, http.StatusCreated)
	member := call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{"email": "member@example.com", "password": "senha-member"}, http.StatusCreated)
	ownerToken := owner["token"].(string)
	memberID := member["user"].(map[string]any)["id"].(string)

	project := call(t, handler, http.MethodPost, "/api/projects", ownerToken, map[string]any{"name": "Projeto MVP"}, http.StatusCreated)
	projectID := project["project"].(map[string]any)["id"].(string)

	call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/members", ownerToken, map[string]any{"user_id": memberID}, http.StatusOK)
	task := call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/tasks", ownerToken, map[string]any{
		"title": "Construir login", "status": "todo", "priority": "high", "assignee_id": memberID,
	}, http.StatusCreated)
	taskID := task["task"].(map[string]any)["id"].(string)

	call(t, handler, http.MethodPatch, "/api/tasks/"+taskID, member["token"].(string), map[string]any{"status": "in_progress"}, http.StatusOK)
	tasks := call(t, handler, http.MethodGet, "/api/projects/"+projectID+"/tasks", member["token"].(string), nil, http.StatusOK)
	if len(tasks["tasks"].([]any)) != 1 {
		t.Fatalf("esperava uma tarefa, recebeu %#v", tasks["tasks"])
	}

	call(t, handler, http.MethodGet, "/api/projects", "", nil, http.StatusUnauthorized)
	call(t, handler, http.MethodDelete, "/api/projects/"+projectID, member["token"].(string), nil, http.StatusForbidden)
}

func call(t *testing.T, handler http.Handler, method, path, token string, body any, expectedStatus int) map[string]any {
	t.Helper()
	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(payload))
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != expectedStatus {
		t.Fatalf("%s %s status = %d, body = %s; expected %d", method, path, recorder.Code, recorder.Body.String(), expectedStatus)
	}
	if recorder.Body.Len() == 0 {
		return nil
	}
	var result map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatalf("resposta inválida: %v", err)
	}
	return result
}
