package api

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
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
	outsider := call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{"email": "outsider@example.com", "password": "senha-outsider"}, http.StatusCreated)
	ownerToken := owner["token"].(string)
	memberID := member["user"].(map[string]any)["id"].(string)
	outsiderToken := outsider["token"].(string)

	project := call(t, handler, http.MethodPost, "/api/projects", ownerToken, map[string]any{
		"name":        "Projeto MVP",
		"description": "## Objetivo\n\nOrganizar o lançamento.",
		"image_data":  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	}, http.StatusCreated)
	projectPayload := project["project"].(map[string]any)
	projectID := projectPayload["id"].(string)
	call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/room/ticket", outsiderToken, nil, http.StatusForbidden)
	call(t, handler, http.MethodGet, "/api/projects/"+projectID+"/room/ws", "", nil, http.StatusUnauthorized)
	if projectPayload["description"] != "## Objetivo\n\nOrganizar o lançamento." || projectPayload["image_data"] != "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" {
		t.Fatalf("descrição ou imagem do projeto não foram persistidas: %#v", projectPayload)
	}
	updatedProject := call(t, handler, http.MethodPatch, "/api/projects/"+projectID, ownerToken, map[string]any{
		"name": "Projeto MVP atualizado", "description": "Descrição revisada", "image_data": "",
	}, http.StatusOK)
	if updatedProject["project"].(map[string]any)["name"] != "Projeto MVP atualizado" {
		t.Fatalf("projeto não foi editado: %#v", updatedProject)
	}
	call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/members", ownerToken, map[string]any{"user_id": memberID}, http.StatusOK)
	members := call(t, handler, http.MethodGet, "/api/projects/"+projectID+"/members", ownerToken, nil, http.StatusOK)
	if len(members["members"].([]any)) != 2 {
		t.Fatalf("esperava dois integrantes, recebeu %#v", members["members"])
	}
	updatedMembers := call(t, handler, http.MethodPatch, "/api/projects/"+projectID+"/members/"+memberID, ownerToken, map[string]any{"role": "viewer"}, http.StatusOK)
	memberPayload := updatedMembers["members"].([]any)
	for _, item := range memberPayload {
		memberView := item.(map[string]any)
		if memberView["id"] == memberID && memberView["role"] != "viewer" {
			t.Fatalf("permissão do membro não foi atualizada: %#v", memberView)
		}
	}
	roomTicket := call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/room/ticket", member["token"].(string), nil, http.StatusOK)
	if roomTicket["ticket"] == "" {
		t.Fatal("a sala deveria emitir um ticket temporário")
	}
	call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/tasks", member["token"].(string), map[string]any{
		"title": "Tarefa somente leitura", "status": "backlog", "priority": "low",
	}, http.StatusForbidden)
	task := call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/tasks", ownerToken, map[string]any{
		"title": "Construir login", "description": "**Aceite:** login funcionando", "status": "backlog", "priority": "high", "assignee_id": memberID,
	}, http.StatusCreated)
	taskPayload := task["task"].(map[string]any)
	if taskPayload["description"] != "**Aceite:** login funcionando" || taskPayload["status"] != "backlog" {
		t.Fatalf("descrição ou backlog da tarefa não foram persistidos: %#v", taskPayload)
	}
	taskID := task["task"].(map[string]any)["id"].(string)
	call(t, handler, http.MethodPatch, "/api/projects/"+projectID+"/members/"+memberID, ownerToken, map[string]any{"role": "editor"}, http.StatusOK)

	updatedTask := call(t, handler, http.MethodPatch, "/api/tasks/"+taskID, member["token"].(string), map[string]any{
		"title": "Construir login atualizado", "description": "Descrição revisada", "status": "in_progress",
	}, http.StatusOK)
	if updatedTask["task"].(map[string]any)["description"] != "Descrição revisada" {
		t.Fatalf("tarefa não foi editada: %#v", updatedTask)
	}
	tasks := call(t, handler, http.MethodGet, "/api/projects/"+projectID+"/tasks", member["token"].(string), nil, http.StatusOK)
	if len(tasks["tasks"].([]any)) != 1 {
		t.Fatalf("esperava uma tarefa, recebeu %#v", tasks["tasks"])
	}

	call(t, handler, http.MethodGet, "/api/projects", "", nil, http.StatusUnauthorized)
	call(t, handler, http.MethodDelete, "/api/projects/"+projectID, member["token"].(string), nil, http.StatusForbidden)
}

func TestTaskDetailsResources(t *testing.T) {
	storePath := t.TempDir() + "/taskboard.json"
	database, err := store.New(storePath)
	if err != nil {
		t.Fatal(err)
	}
	server := NewServer(database, auth.NewTokenService([]byte(strings.Repeat("r", 32)), time.Hour), Config{CORSOrigin: "http://localhost:3000"})
	handler := server.Handler()
	owner := call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{"email": "details-owner@example.com", "password": "senha-owner"}, http.StatusCreated)
	viewer := call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{"email": "details-viewer@example.com", "password": "senha-viewer"}, http.StatusCreated)
	outsider := call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{"email": "details-outsider@example.com", "password": "senha-outsider"}, http.StatusCreated)
	ownerToken := owner["token"].(string)
	viewerToken := viewer["token"].(string)
	viewerID := viewer["user"].(map[string]any)["id"].(string)
	project := call(t, handler, http.MethodPost, "/api/projects", ownerToken, map[string]any{"name": "Detalhes"}, http.StatusCreated)
	projectID := project["project"].(map[string]any)["id"].(string)
	call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/members", ownerToken, map[string]any{"user_id": viewerID}, http.StatusOK)
	call(t, handler, http.MethodPatch, "/api/projects/"+projectID+"/members/"+viewerID, ownerToken, map[string]any{"role": "viewer"}, http.StatusOK)
	task := call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/tasks", ownerToken, map[string]any{"title": "Analisar dados", "status": "todo", "priority": "medium"}, http.StatusCreated)
	taskID := task["task"].(map[string]any)["id"].(string)
	comment := call(t, handler, http.MethodPost, "/api/tasks/"+taskID+"/comments", ownerToken, map[string]any{"body": "Amostra pronta."}, http.StatusCreated)
	commentID := comment["comment"].(map[string]any)["id"].(string)
	if len(call(t, handler, http.MethodGet, "/api/tasks/"+taskID+"/comments", viewerToken, nil, http.StatusOK)["comments"].([]any)) != 1 {
		t.Fatal("integrante com acesso de leitura não recebeu o comentário")
	}
	call(t, handler, http.MethodPost, "/api/tasks/"+taskID+"/comments", viewerToken, map[string]any{"body": "Alteração negada"}, http.StatusForbidden)
	call(t, handler, http.MethodDelete, "/api/task-comments/"+commentID, viewerToken, nil, http.StatusForbidden)

	subtask := call(t, handler, http.MethodPost, "/api/tasks/"+taskID+"/subtasks", ownerToken, map[string]any{"title": "Validar amostra"}, http.StatusCreated)
	subtaskID := subtask["subtask"].(map[string]any)["id"].(string)
	updated := call(t, handler, http.MethodPatch, "/api/task-subtasks/"+subtaskID, ownerToken, map[string]any{"done": true}, http.StatusOK)
	if updated["subtask"].(map[string]any)["done"] != true {
		t.Fatal("estado da subtarefa não foi salvo")
	}
	if len(call(t, handler, http.MethodGet, "/api/tasks/"+taskID+"/subtasks", ownerToken, nil, http.StatusOK)["subtasks"].([]any)) != 1 {
		t.Fatal("subtarefa não foi persistida")
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "brief.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("arquivo de referência")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/tasks/"+taskID+"/attachments", body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Authorization", "Bearer "+ownerToken)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, body = %s", response.Code, response.Body.String())
	}
	var upload struct {
		Attachment struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Size int64  `json:"size"`
		} `json:"attachment"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &upload); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(response.Body.String(), `"data"`) {
		t.Fatal("resposta de upload não deve incluir o conteúdo do anexo")
	}
	if upload.Attachment.Name != "brief.txt" || upload.Attachment.Size != int64(len("arquivo de referência")) {
		t.Fatalf("metadados do anexo incorretos: %#v", upload.Attachment)
	}
	reopenedStore, err := store.New(storePath)
	if err != nil {
		t.Fatal(err)
	}
	persistedAttachment, err := reopenedStore.TaskAttachmentByID(upload.Attachment.ID)
	if err != nil || string(persistedAttachment.Data) != "arquivo de referência" {
		t.Fatalf("conteúdo do anexo não sobreviveu à reabertura do armazenamento: item=%#v erro=%v", persistedAttachment, err)
	}

	download := httptest.NewRequest(http.MethodGet, "/api/task-attachments/"+upload.Attachment.ID, nil)
	download.Header.Set("Authorization", "Bearer "+ownerToken)
	downloadResponse := httptest.NewRecorder()
	handler.ServeHTTP(downloadResponse, download)
	if downloadResponse.Code != http.StatusOK || downloadResponse.Body.String() != "arquivo de referência" || !strings.Contains(downloadResponse.Header().Get("Content-Disposition"), "attachment") {
		t.Fatalf("download incorreto: status=%d headers=%v body=%q", downloadResponse.Code, downloadResponse.Header(), downloadResponse.Body.String())
	}
	largeBody := &bytes.Buffer{}
	largeWriter := multipart.NewWriter(largeBody)
	largePart, err := largeWriter.CreateFormFile("file", "grande.bin")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := largePart.Write(bytes.Repeat([]byte("x"), maxTaskAttachmentBytes+1)); err != nil {
		t.Fatal(err)
	}
	if err := largeWriter.Close(); err != nil {
		t.Fatal(err)
	}
	largeRequest := httptest.NewRequest(http.MethodPost, "/api/tasks/"+taskID+"/attachments", largeBody)
	largeRequest.Header.Set("Content-Type", largeWriter.FormDataContentType())
	largeRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	largeResponse := httptest.NewRecorder()
	handler.ServeHTTP(largeResponse, largeRequest)
	if largeResponse.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("arquivo acima do limite retornou %d, corpo: %s", largeResponse.Code, largeResponse.Body.String())
	}
	call(t, handler, http.MethodGet, "/api/task-attachments/"+upload.Attachment.ID, outsider["token"].(string), nil, http.StatusForbidden)
	call(t, handler, http.MethodDelete, "/api/task-attachments/"+upload.Attachment.ID, viewerToken, nil, http.StatusForbidden)
	call(t, handler, http.MethodDelete, "/api/task-attachments/"+upload.Attachment.ID, ownerToken, nil, http.StatusNoContent)
	call(t, handler, http.MethodDelete, "/api/task-subtasks/"+subtaskID, ownerToken, nil, http.StatusNoContent)
	call(t, handler, http.MethodDelete, "/api/tasks/"+taskID, ownerToken, nil, http.StatusNoContent)
	call(t, handler, http.MethodGet, "/api/tasks/"+taskID+"/comments", ownerToken, nil, http.StatusNotFound)
}

func TestLeadPipelineFlow(t *testing.T) {
	database, err := store.New(t.TempDir() + "/taskboard.json")
	if err != nil {
		t.Fatal(err)
	}
	server := NewServer(database, auth.NewTokenService([]byte(strings.Repeat("s", 32)), time.Hour), Config{CORSOrigin: "http://localhost:3000"})
	handler := server.Handler()
	owner := call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{"email": "lead-owner@example.com", "password": "senha-owner"}, http.StatusCreated)
	viewer := call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{"email": "lead-viewer@example.com", "password": "senha-viewer"}, http.StatusCreated)
	viewerID := viewer["user"].(map[string]any)["id"].(string)
	project := call(t, handler, http.MethodPost, "/api/projects", owner["token"].(string), map[string]any{"name": "Prospecção"}, http.StatusCreated)
	projectID := project["project"].(map[string]any)["id"].(string)
	call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/members", owner["token"].(string), map[string]any{"user_id": viewerID}, http.StatusOK)
	call(t, handler, http.MethodPatch, "/api/projects/"+projectID+"/members/"+viewerID, owner["token"].(string), map[string]any{"role": "viewer"}, http.StatusOK)

	created := call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/leads", owner["token"].(string), map[string]any{
		"source_key": "santo|burger-12", "name": "Burger 12", "city": "Santo Antônio do Monte", "state": "MG",
		"category": "Hamburgueria", "phone": "(37) 99957-1856", "status": "new", "latitude": -20.9463, "longitude": -45.293,
		"location_precision": "city",
	}, http.StatusCreated)
	leadID := created["lead"].(map[string]any)["id"].(string)
	call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/leads/import", owner["token"].(string), map[string]any{"leads": []map[string]any{
		{"source_key": "santo|burger-12", "name": "Burger 12", "city": "Santo Antônio do Monte"},
		{"source_key": "vitoria|nakaya", "name": "Nakaya", "city": "Vitória da Conquista", "state": "BA"},
	}}, http.StatusCreated)
	listed := call(t, handler, http.MethodGet, "/api/projects/"+projectID+"/leads?city=Vitória+da+Conquista", owner["token"].(string), nil, http.StatusOK)
	if len(listed["leads"].([]any)) != 1 {
		t.Fatalf("esperava um lead filtrado: %#v", listed)
	}
	activity := call(t, handler, http.MethodPost, "/api/leads/"+leadID+"/activities", owner["token"].(string), map[string]any{"type": "whatsapp", "body": "Apresentei a solução.", "status_after": "contacted"}, http.StatusCreated)
	if activity["activity"].(map[string]any)["status_after"] != "contacted" {
		t.Fatalf("atividade não atualizou o status: %#v", activity)
	}
	updated := call(t, handler, http.MethodGet, "/api/leads/"+leadID, owner["token"].(string), nil, http.StatusOK)
	if updated["lead"].(map[string]any)["status"] != "contacted" {
		t.Fatalf("lead não refletiu o status da atividade: %#v", updated)
	}
	call(t, handler, http.MethodPost, "/api/projects/"+projectID+"/leads", viewer["token"].(string), map[string]any{"name": "Somente leitura", "city": "João Pessoa"}, http.StatusForbidden)
}

func TestRegisterProfile(t *testing.T) {
	database, err := store.New(t.TempDir() + "/taskboard.json")
	if err != nil {
		t.Fatal(err)
	}
	server := NewServer(database, auth.NewTokenService([]byte(strings.Repeat("s", 32)), time.Hour), Config{CORSOrigin: "http://localhost:3000"})
	handler := server.Handler()
	avatar := "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
	registered := call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{
		"alias":                 "Nina",
		"email":                 "nina@example.com",
		"password":              "senha-segura",
		"password_confirmation": "senha-segura",
		"avatar_data":           avatar,
	}, http.StatusCreated)
	user := registered["user"].(map[string]any)
	if user["alias"] != "Nina" || user["email"] != "nina@example.com" || user["avatar_data"] != avatar {
		t.Fatalf("perfil não foi persistido na resposta: %#v", user)
	}
	updated := call(t, handler, http.MethodPatch, "/api/auth/me", registered["token"].(string), map[string]any{
		"alias":                 "Nina Lima",
		"email":                 "nina.lima@example.com",
		"password":              "senha-nova",
		"password_confirmation": "senha-nova",
		"avatar_data":           "",
	}, http.StatusOK)
	updatedUser := updated["user"].(map[string]any)
	if updatedUser["alias"] != "Nina Lima" || updatedUser["email"] != "nina.lima@example.com" || updatedUser["avatar_data"] != nil {
		t.Fatalf("perfil não foi atualizado: %#v", updatedUser)
	}
	call(t, handler, http.MethodPost, "/api/auth/login", "", map[string]any{"email": "nina.lima@example.com", "password": "senha-nova"}, http.StatusOK)
	call(t, handler, http.MethodPost, "/api/auth/register", "", map[string]any{
		"alias":                 "Nina",
		"email":                 "outra@example.com",
		"password":              "senha-segura",
		"password_confirmation": "senha-diferente",
	}, http.StatusBadRequest)
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
