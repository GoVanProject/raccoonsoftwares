package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/mail"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/raccoontech/taskboard/internal/auth"
	"github.com/raccoontech/taskboard/internal/store"
)

type Config struct {
	CORSOrigin string
	STUNURLs   []string
	TURN       *TURNConfig
}

type TURNConfig struct {
	Host   string
	Port   int
	Secret string
}

type Server struct {
	store  store.Repository
	tokens *auth.TokenService
	config Config
	rooms  *roomManager
}

func NewServer(database store.Repository, tokens *auth.TokenService, config Config) *Server {
	return &Server{store: database, tokens: tokens, config: config, rooms: newRoomManager()}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("POST /api/auth/register", s.register)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("GET /api/auth/me", s.requireAuth(s.me))
	mux.HandleFunc("PATCH /api/auth/me", s.requireAuth(s.updateMe))
	mux.HandleFunc("GET /api/users", s.requireAuth(s.listUsers))

	mux.HandleFunc("GET /api/projects", s.requireAuth(s.listProjects))
	mux.HandleFunc("POST /api/projects", s.requireAuth(s.createProject))
	mux.HandleFunc("GET /api/projects/{projectID}", s.requireAuth(s.getProject))
	mux.HandleFunc("PATCH /api/projects/{projectID}", s.requireAuth(s.updateProject))
	mux.HandleFunc("DELETE /api/projects/{projectID}", s.requireAuth(s.deleteProject))
	mux.HandleFunc("GET /api/projects/{projectID}/members", s.requireAuth(s.listMembers))
	mux.HandleFunc("POST /api/projects/{projectID}/members", s.requireAuth(s.addMember))
	mux.HandleFunc("PATCH /api/projects/{projectID}/members/{userID}", s.requireAuth(s.updateMemberRole))
	mux.HandleFunc("DELETE /api/projects/{projectID}/members/{userID}", s.requireAuth(s.removeMember))
	mux.HandleFunc("POST /api/projects/{projectID}/room/ticket", s.requireAuth(s.createRoomTicket))
	mux.HandleFunc("GET /api/projects/{projectID}/room/ws", s.roomWebSocket)
	mux.HandleFunc("GET /api/projects/{projectID}/tasks", s.requireAuth(s.listTasks))
	mux.HandleFunc("POST /api/projects/{projectID}/tasks", s.requireAuth(s.createTask))
	mux.HandleFunc("GET /api/projects/{projectID}/labels", s.requireAuth(s.listLabels))
	mux.HandleFunc("POST /api/projects/{projectID}/labels", s.requireAuth(s.createLabel))
	mux.HandleFunc("GET /api/projects/{projectID}/leads", s.requireAuth(s.listLeads))
	mux.HandleFunc("POST /api/projects/{projectID}/leads", s.requireAuth(s.createLead))
	mux.HandleFunc("POST /api/projects/{projectID}/leads/import", s.requireAuth(s.importLeads))

	mux.HandleFunc("GET /api/tasks/{taskID}", s.requireAuth(s.getTask))
	mux.HandleFunc("PATCH /api/tasks/{taskID}", s.requireAuth(s.updateTask))
	mux.HandleFunc("DELETE /api/tasks/{taskID}", s.requireAuth(s.deleteTask))
	mux.HandleFunc("GET /api/tasks/{taskID}/comments", s.requireAuth(s.listTaskComments))
	mux.HandleFunc("POST /api/tasks/{taskID}/comments", s.requireAuth(s.createTaskComment))
	mux.HandleFunc("DELETE /api/task-comments/{commentID}", s.requireAuth(s.deleteTaskComment))
	mux.HandleFunc("GET /api/tasks/{taskID}/subtasks", s.requireAuth(s.listTaskSubtasks))
	mux.HandleFunc("POST /api/tasks/{taskID}/subtasks", s.requireAuth(s.createTaskSubtask))
	mux.HandleFunc("PATCH /api/task-subtasks/{subtaskID}", s.requireAuth(s.updateTaskSubtask))
	mux.HandleFunc("DELETE /api/task-subtasks/{subtaskID}", s.requireAuth(s.deleteTaskSubtask))
	mux.HandleFunc("GET /api/tasks/{taskID}/attachments", s.requireAuth(s.listTaskAttachments))
	mux.HandleFunc("POST /api/tasks/{taskID}/attachments", s.requireAuth(s.createTaskAttachment))
	mux.HandleFunc("GET /api/task-attachments/{attachmentID}", s.requireAuth(s.downloadTaskAttachment))
	mux.HandleFunc("DELETE /api/task-attachments/{attachmentID}", s.requireAuth(s.deleteTaskAttachment))
	mux.HandleFunc("GET /api/leads/{leadID}", s.requireAuth(s.getLead))
	mux.HandleFunc("PATCH /api/leads/{leadID}", s.requireAuth(s.updateLead))
	mux.HandleFunc("DELETE /api/leads/{leadID}", s.requireAuth(s.deleteLead))
	mux.HandleFunc("GET /api/leads/{leadID}/activities", s.requireAuth(s.listLeadActivities))
	mux.HandleFunc("POST /api/leads/{leadID}/activities", s.requireAuth(s.createLeadActivity))

	return s.cors(mux)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerRequest struct {
	Alias                string `json:"alias"`
	Email                string `json:"email"`
	Password             string `json:"password"`
	PasswordConfirmation string `json:"password_confirmation"`
	AvatarData           string `json:"avatar_data"`
}

type profileUpdateRequest struct {
	Alias                *string `json:"alias"`
	Email                *string `json:"email"`
	Password             *string `json:"password"`
	PasswordConfirmation *string `json:"password_confirmation"`
	AvatarData           *string `json:"avatar_data"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var request registerRequest
	if !readJSON(w, r, &request) {
		return
	}
	email, password, err := validateCredentials(credentialsRequest{Email: request.Email, Password: request.Password})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	alias := strings.TrimSpace(request.Alias)
	if alias == "" {
		// Keep older API clients working while the new UI requires an alias.
		alias = strings.Split(email, "@")[0]
	}
	if len(alias) > 60 {
		writeError(w, http.StatusBadRequest, "o nome deve ter até 60 caracteres")
		return
	}
	if request.PasswordConfirmation != "" && request.PasswordConfirmation != password {
		writeError(w, http.StatusBadRequest, "as senhas não conferem")
		return
	}
	avatarData := strings.TrimSpace(request.AvatarData)
	if err := validateAvatarData(avatarData); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "não foi possível proteger a senha")
		return
	}
	user, err := s.store.CreateUser(email, passwordHash, alias, avatarData)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "este email já está cadastrado")
			return
		}
		writeError(w, http.StatusInternalServerError, "não foi possível criar o usuário")
		return
	}
	token, err := s.tokens.Create(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "não foi possível criar a sessão")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": publicUser(user)})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var request credentialsRequest
	if !readJSON(w, r, &request) {
		return
	}
	email, password, err := validateCredentials(request)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, err := s.store.UserByEmail(email)
	if err != nil || !auth.CheckPassword(password, user.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "email ou senha inválidos")
		return
	}
	token, err := s.tokens.Create(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "não foi possível criar a sessão")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": publicUser(user)})
}

func (s *Server) me(w http.ResponseWriter, _ *http.Request, userID string) {
	user, err := s.store.UserByID(userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "usuário não encontrado")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": publicUser(user)})
}

func (s *Server) updateMe(w http.ResponseWriter, r *http.Request, userID string) {
	current, err := s.store.UserByID(userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "usuário não encontrado")
		return
	}
	var request profileUpdateRequest
	if !readJSON(w, r, &request) {
		return
	}
	alias := userAlias(current)
	if request.Alias != nil {
		alias = strings.TrimSpace(*request.Alias)
	}
	if alias == "" || len(alias) > 60 {
		writeError(w, http.StatusBadRequest, "o nome é obrigatório e deve ter até 60 caracteres")
		return
	}
	email := current.Email
	if request.Email != nil {
		email = strings.TrimSpace(*request.Email)
	}
	normalizedEmail, err := validateEmail(email)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	passwordHash := ""
	if request.Password != nil && *request.Password != "" {
		password := *request.Password
		if len(password) < 8 {
			writeError(w, http.StatusBadRequest, "a nova senha deve ter pelo menos 8 caracteres")
			return
		}
		if request.PasswordConfirmation == nil || *request.PasswordConfirmation != password {
			writeError(w, http.StatusBadRequest, "as senhas não conferem")
			return
		}
		passwordHash, err = auth.HashPassword(password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "não foi possível proteger a senha")
			return
		}
	}
	avatarData := current.AvatarData
	if request.AvatarData != nil {
		avatarData = strings.TrimSpace(*request.AvatarData)
	}
	if err := validateAvatarData(avatarData); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	updated, err := s.store.UpdateUser(userID, alias, normalizedEmail, passwordHash, avatarData)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "este email já está cadastrado")
			return
		}
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": publicUser(updated)})
}

func (s *Server) listUsers(w http.ResponseWriter, r *http.Request, _ string) {
	users := s.store.ListUsers(r.URL.Query().Get("q"))
	response := make([]publicUserResponse, 0, len(users))
	for _, user := range users {
		response = append(response, publicUser(user))
	}
	sort.Slice(response, func(i, j int) bool { return response[i].Email < response[j].Email })
	writeJSON(w, http.StatusOK, map[string]any{"users": response})
}

type projectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	ImageData   string `json:"image_data"`
}

type projectUpdateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	ImageData   *string `json:"image_data"`
}

func (s *Server) listProjects(w http.ResponseWriter, _ *http.Request, userID string) {
	projects := s.store.ListProjects(userID)
	response := make([]projectResponse, 0, len(projects))
	for _, project := range projects {
		response = append(response, s.projectView(project))
	}
	sort.Slice(response, func(i, j int) bool { return response[i].UpdatedAt.After(response[j].UpdatedAt) })
	writeJSON(w, http.StatusOK, map[string]any{"projects": response})
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request, userID string) {
	var request projectRequest
	if !readJSON(w, r, &request) {
		return
	}
	request.Name = strings.TrimSpace(request.Name)
	if request.Name == "" || len(request.Name) > 120 {
		writeError(w, http.StatusBadRequest, "o nome do projeto é obrigatório e deve ter até 120 caracteres")
		return
	}
	if len(request.Description) > maxProjectDescriptionLength {
		writeError(w, http.StatusBadRequest, "a descrição deve ter até 5000 caracteres")
		return
	}
	request.ImageData = strings.TrimSpace(request.ImageData)
	if err := validateImageData(request.ImageData); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	project, err := s.store.CreateProject(userID, request.Name, strings.TrimSpace(request.Description), request.ImageData)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"project": s.projectView(project)})
}

func (s *Server) getProject(w http.ResponseWriter, r *http.Request, userID string) {
	project, err := s.store.ProjectByID(r.PathValue("projectID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a este projeto")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": s.projectView(project)})
}

func (s *Server) updateProject(w http.ResponseWriter, r *http.Request, userID string) {
	project, err := s.store.ProjectByID(r.PathValue("projectID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	var request projectUpdateRequest
	if !readJSON(w, r, &request) {
		return
	}
	name := project.Name
	if request.Name != nil {
		name = strings.TrimSpace(*request.Name)
	}
	description := project.Description
	if request.Description != nil {
		description = strings.TrimSpace(*request.Description)
	}
	imageData := project.ImageData
	if request.ImageData != nil {
		imageData = strings.TrimSpace(*request.ImageData)
	}
	if name == "" || len(name) > 120 || len(description) > maxProjectDescriptionLength {
		writeError(w, http.StatusBadRequest, "dados do projeto inválidos")
		return
	}
	if err := validateImageData(imageData); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	updated, err := s.store.UpdateProject(project.ID, userID, name, description, imageData)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": s.projectView(updated)})
}

func (s *Server) deleteProject(w http.ResponseWriter, r *http.Request, userID string) {
	if err := s.store.DeleteProject(r.PathValue("projectID"), userID); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type memberRequest struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
}

type memberRoleRequest struct {
	Role string `json:"role"`
}

func (s *Server) listMembers(w http.ResponseWriter, r *http.Request, userID string) {
	project, err := s.store.ProjectByID(r.PathValue("projectID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a este projeto")
		return
	}
	members, err := s.store.ListProjectMembers(project.ID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	response := make([]projectMemberResponse, 0, len(members))
	for _, member := range members {
		response = append(response, projectMember(member))
	}
	sort.Slice(response, func(i, j int) bool { return response[i].Alias < response[j].Alias })
	writeJSON(w, http.StatusOK, map[string]any{"members": response})
}

func (s *Server) addMember(w http.ResponseWriter, r *http.Request, userID string) {
	var request memberRequest
	if !readJSON(w, r, &request) {
		return
	}
	targetID := strings.TrimSpace(request.UserID)
	if targetID == "" && strings.TrimSpace(request.Email) != "" {
		user, err := s.store.UserByEmail(request.Email)
		if err != nil {
			writeError(w, http.StatusNotFound, "usuário não encontrado")
			return
		}
		targetID = user.ID
	}
	if targetID == "" {
		writeError(w, http.StatusBadRequest, "informe user_id ou email")
		return
	}
	project, err := s.store.AddMember(r.PathValue("projectID"), userID, targetID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": s.projectView(project)})
}

func (s *Server) updateMemberRole(w http.ResponseWriter, r *http.Request, userID string) {
	var request memberRoleRequest
	if !readJSON(w, r, &request) {
		return
	}
	members, err := s.store.UpdateMemberRole(r.PathValue("projectID"), userID, r.PathValue("userID"), strings.TrimSpace(request.Role))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	response := make([]projectMemberResponse, 0, len(members))
	for _, member := range members {
		response = append(response, projectMember(member))
	}
	sort.Slice(response, func(i, j int) bool { return response[i].Email < response[j].Email })
	writeJSON(w, http.StatusOK, map[string]any{"members": response})
}

func (s *Server) removeMember(w http.ResponseWriter, r *http.Request, userID string) {
	if err := s.store.RemoveMember(r.PathValue("projectID"), userID, r.PathValue("userID")); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type taskRequest struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Status      string   `json:"status"`
	Priority    string   `json:"priority"`
	AssigneeID  string   `json:"assignee_id"`
	DueDate     string   `json:"due_date"`
	LabelIDs    []string `json:"label_ids"`
}

type taskUpdateRequest struct {
	Title       *string   `json:"title"`
	Description *string   `json:"description"`
	Status      *string   `json:"status"`
	Priority    *string   `json:"priority"`
	AssigneeID  *string   `json:"assignee_id"`
	DueDate     *string   `json:"due_date"`
	LabelIDs    *[]string `json:"label_ids"`
}

type labelRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

func (s *Server) listLabels(w http.ResponseWriter, r *http.Request, userID string) {
	project, err := s.store.ProjectByID(r.PathValue("projectID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a este projeto")
		return
	}
	labels := s.store.LabelsByProject(project.ID)
	sort.Slice(labels, func(i, j int) bool {
		return strings.ToLower(labels[i].Name) < strings.ToLower(labels[j].Name)
	})
	writeJSON(w, http.StatusOK, map[string]any{"labels": labels})
}

func (s *Server) createLabel(w http.ResponseWriter, r *http.Request, userID string) {
	var request labelRequest
	if !readJSON(w, r, &request) {
		return
	}
	request.Name = strings.TrimSpace(request.Name)
	request.Color = strings.TrimSpace(request.Color)
	if request.Name == "" || len(request.Name) > 40 {
		writeError(w, http.StatusBadRequest, "o nome da etiqueta é obrigatório e deve ter até 40 caracteres")
		return
	}
	if !oneOf(request.Color, "blue", "purple", "green", "orange", "red", "cyan", "gray") {
		writeError(w, http.StatusBadRequest, "cor de etiqueta inválida")
		return
	}
	label, err := s.store.CreateLabel(r.PathValue("projectID"), userID, request.Name, request.Color)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"label": label})
}

func (s *Server) listTasks(w http.ResponseWriter, r *http.Request, userID string) {
	project, err := s.store.ProjectByID(r.PathValue("projectID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a este projeto")
		return
	}
	tasks := s.store.TasksByProject(project.ID)
	sort.Slice(tasks, func(i, j int) bool { return tasks[i].CreatedAt.Before(tasks[j].CreatedAt) })
	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks})
}

func (s *Server) createTask(w http.ResponseWriter, r *http.Request, userID string) {
	var request taskRequest
	if !readJSON(w, r, &request) {
		return
	}
	request.Title = strings.TrimSpace(request.Title)
	request.Description = strings.TrimSpace(request.Description)
	request.Status = strings.TrimSpace(request.Status)
	request.Priority = strings.TrimSpace(request.Priority)
	request.AssigneeID = strings.TrimSpace(request.AssigneeID)
	request.DueDate = strings.TrimSpace(request.DueDate)
	if request.Status == "" {
		request.Status = "todo"
	}
	if request.Priority == "" {
		request.Priority = "medium"
	}
	if err := validateTask(request.Title, request.Description, request.Status, request.Priority, request.DueDate); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	task, err := s.store.CreateTask(r.PathValue("projectID"), userID, request.Title, request.Description, request.Status, request.Priority, request.AssigneeID, request.DueDate, request.LabelIDs)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"task": task})
}

func (s *Server) getTask(w http.ResponseWriter, r *http.Request, userID string) {
	task, err := s.store.TaskByID(r.PathValue("taskID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	project, err := s.store.ProjectByID(task.ProjectID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a esta tarefa")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"task": task})
}

func (s *Server) updateTask(w http.ResponseWriter, r *http.Request, userID string) {
	task, err := s.store.TaskByID(r.PathValue("taskID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	var request taskUpdateRequest
	if !readJSON(w, r, &request) {
		return
	}
	title, description, status, priority, assigneeID, dueDate := task.Title, task.Description, task.Status, task.Priority, task.AssigneeID, task.DueDate
	labelIDs := task.LabelIDs
	if request.Title != nil {
		title = strings.TrimSpace(*request.Title)
	}
	if request.Description != nil {
		description = strings.TrimSpace(*request.Description)
	}
	if request.Status != nil {
		status = strings.TrimSpace(*request.Status)
	}
	if request.Priority != nil {
		priority = strings.TrimSpace(*request.Priority)
	}
	if request.AssigneeID != nil {
		assigneeID = strings.TrimSpace(*request.AssigneeID)
	}
	if request.DueDate != nil {
		dueDate = strings.TrimSpace(*request.DueDate)
	}
	if request.LabelIDs != nil {
		labelIDs = *request.LabelIDs
	}
	if err := validateTask(title, description, status, priority, dueDate); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	updated, err := s.store.UpdateTask(task.ID, userID, title, description, status, priority, assigneeID, dueDate, labelIDs)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"task": updated})
}

func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request, userID string) {
	if err := s.store.DeleteTask(r.PathValue("taskID"), userID); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) accessibleTask(w http.ResponseWriter, taskID, userID string) (store.Task, bool) {
	task, err := s.store.TaskByID(taskID)
	if err != nil {
		writeStoreError(w, err)
		return store.Task{}, false
	}
	project, err := s.store.ProjectByID(task.ProjectID)
	if err != nil {
		writeStoreError(w, err)
		return store.Task{}, false
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a esta tarefa")
		return store.Task{}, false
	}
	return task, true
}

func (s *Server) listTaskComments(w http.ResponseWriter, r *http.Request, userID string) {
	task, ok := s.accessibleTask(w, r.PathValue("taskID"), userID)
	if !ok {
		return
	}
	items, err := s.store.TaskComments(task.ID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"comments": items})
}

func (s *Server) createTaskComment(w http.ResponseWriter, r *http.Request, userID string) {
	if _, ok := s.accessibleTask(w, r.PathValue("taskID"), userID); !ok {
		return
	}
	var request struct {
		Body string `json:"body"`
	}
	if !readJSON(w, r, &request) {
		return
	}
	request.Body = strings.TrimSpace(request.Body)
	if request.Body == "" || len(request.Body) > 5000 {
		writeError(w, http.StatusBadRequest, "o comentário é obrigatório e deve ter até 5.000 caracteres")
		return
	}
	item, err := s.store.CreateTaskComment(r.PathValue("taskID"), userID, request.Body)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"comment": item})
}

func (s *Server) deleteTaskComment(w http.ResponseWriter, r *http.Request, userID string) {
	if err := s.store.DeleteTaskComment(r.PathValue("commentID"), userID); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listTaskSubtasks(w http.ResponseWriter, r *http.Request, userID string) {
	task, ok := s.accessibleTask(w, r.PathValue("taskID"), userID)
	if !ok {
		return
	}
	items, err := s.store.TaskSubtasks(task.ID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"subtasks": items})
}

func (s *Server) createTaskSubtask(w http.ResponseWriter, r *http.Request, userID string) {
	if _, ok := s.accessibleTask(w, r.PathValue("taskID"), userID); !ok {
		return
	}
	var request struct {
		Title string `json:"title"`
	}
	if !readJSON(w, r, &request) {
		return
	}
	request.Title = strings.TrimSpace(request.Title)
	if request.Title == "" || len(request.Title) > 200 {
		writeError(w, http.StatusBadRequest, "o título da subtarefa é obrigatório e deve ter até 200 caracteres")
		return
	}
	item, err := s.store.CreateTaskSubtask(r.PathValue("taskID"), userID, request.Title)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"subtask": item})
}

func (s *Server) updateTaskSubtask(w http.ResponseWriter, r *http.Request, userID string) {
	var request struct {
		Title *string `json:"title"`
		Done  *bool   `json:"done"`
	}
	if !readJSON(w, r, &request) {
		return
	}
	if request.Title == nil && request.Done == nil {
		writeError(w, http.StatusBadRequest, "informe o título ou o estado da subtarefa")
		return
	}
	if request.Title != nil {
		value := strings.TrimSpace(*request.Title)
		if value == "" || len(value) > 200 {
			writeError(w, http.StatusBadRequest, "o título da subtarefa é obrigatório e deve ter até 200 caracteres")
			return
		}
		request.Title = &value
	}
	item, err := s.store.UpdateTaskSubtask(r.PathValue("subtaskID"), userID, request.Title, request.Done)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"subtask": item})
}

func (s *Server) deleteTaskSubtask(w http.ResponseWriter, r *http.Request, userID string) {
	if err := s.store.DeleteTaskSubtask(r.PathValue("subtaskID"), userID); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

const maxTaskAttachmentBytes = 10 << 20

func (s *Server) listTaskAttachments(w http.ResponseWriter, r *http.Request, userID string) {
	task, ok := s.accessibleTask(w, r.PathValue("taskID"), userID)
	if !ok {
		return
	}
	items, err := s.store.TaskAttachments(task.ID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	views := make([]taskAttachmentResponse, 0, len(items))
	for _, item := range items {
		views = append(views, taskAttachmentView(item))
	}
	writeJSON(w, http.StatusOK, map[string]any{"attachments": views})
}

func (s *Server) createTaskAttachment(w http.ResponseWriter, r *http.Request, userID string) {
	if _, ok := s.accessibleTask(w, r.PathValue("taskID"), userID); !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxTaskAttachmentBytes+(1<<20))
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		if errors.Is(err, http.ErrNotMultipart) {
			writeError(w, http.StatusBadRequest, "envie o arquivo em formato multipart")
			return
		}
		writeError(w, http.StatusRequestEntityTooLarge, "o arquivo deve ter até 10 MB")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "selecione um arquivo para anexar")
		return
	}
	defer file.Close()
	content, err := io.ReadAll(io.LimitReader(file, maxTaskAttachmentBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "não foi possível ler o arquivo")
		return
	}
	if len(content) == 0 {
		writeError(w, http.StatusBadRequest, "o arquivo está vazio")
		return
	}
	if len(content) > maxTaskAttachmentBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "o arquivo deve ter até 10 MB")
		return
	}
	name := filepath.Base(strings.ReplaceAll(strings.TrimSpace(header.Filename), `\`, "/"))
	if name == "" || name == "." || len(name) > 255 {
		writeError(w, http.StatusBadRequest, "nome de arquivo inválido")
		return
	}
	contentType := http.DetectContentType(content)
	item, err := s.store.CreateTaskAttachment(r.PathValue("taskID"), userID, name, contentType, content)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"attachment": taskAttachmentView(item)})
}

func (s *Server) downloadTaskAttachment(w http.ResponseWriter, r *http.Request, userID string) {
	item, err := s.store.TaskAttachmentByID(r.PathValue("attachmentID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if _, ok := s.accessibleTask(w, item.TaskID, userID); !ok {
		return
	}
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": item.Name})
	if disposition == "" {
		disposition = `attachment; filename="download"`
	}
	w.Header().Set("Content-Type", item.ContentType)
	w.Header().Set("Content-Disposition", disposition)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(item.Data)))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(item.Data)
}

func (s *Server) deleteTaskAttachment(w http.ResponseWriter, r *http.Request, userID string) {
	if err := s.store.DeleteTaskAttachment(r.PathValue("attachmentID"), userID); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type leadImportRequest struct {
	Leads []store.LeadImport `json:"leads"`
}

func (s *Server) listLeads(w http.ResponseWriter, r *http.Request, userID string) {
	project, err := s.store.ProjectByID(r.PathValue("projectID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a este projeto")
		return
	}
	query := r.URL.Query()
	leads := s.store.ListLeads(project.ID, store.LeadFilters{
		Search: query.Get("search"), City: query.Get("city"), Category: query.Get("category"),
		Status: query.Get("status"), AssigneeID: query.Get("assignee_id"),
	})
	sort.Slice(leads, func(i, j int) bool {
		if leads[i].City == leads[j].City {
			return strings.ToLower(leads[i].Name) < strings.ToLower(leads[j].Name)
		}
		return strings.ToLower(leads[i].City) < strings.ToLower(leads[j].City)
	})
	writeJSON(w, http.StatusOK, map[string]any{"leads": leads})
}

func (s *Server) createLead(w http.ResponseWriter, r *http.Request, userID string) {
	var lead store.Lead
	if !readJSON(w, r, &lead) {
		return
	}
	if lead.Status == "" {
		lead.Status = store.LeadStatusNew
	}
	if err := validateLead(lead); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	created, err := s.store.CreateLead(r.PathValue("projectID"), userID, lead)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"lead": created})
}

func (s *Server) importLeads(w http.ResponseWriter, r *http.Request, userID string) {
	var request leadImportRequest
	if !readJSON(w, r, &request) {
		return
	}
	if len(request.Leads) == 0 || len(request.Leads) > 5000 {
		writeError(w, http.StatusBadRequest, "envie entre 1 e 5000 leads")
		return
	}
	created, skipped, err := s.store.ImportLeads(r.PathValue("projectID"), userID, request.Leads)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"leads": created, "created": len(created), "skipped": skipped})
}

func (s *Server) getLead(w http.ResponseWriter, r *http.Request, userID string) {
	lead, err := s.store.LeadByID(r.PathValue("leadID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	project, err := s.store.ProjectByID(lead.ProjectID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a este lead")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lead": lead})
}

func (s *Server) updateLead(w http.ResponseWriter, r *http.Request, userID string) {
	current, err := s.store.LeadByID(r.PathValue("leadID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	var lead store.Lead
	if !readJSON(w, r, &lead) {
		return
	}
	lead.ID = current.ID
	lead.ProjectID = current.ProjectID
	lead.SourceKey = current.SourceKey
	lead.CreatedBy = current.CreatedBy
	lead.CreatedAt = current.CreatedAt
	if lead.Status == "" {
		lead.Status = current.Status
	}
	if err := validateLead(lead); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	updated, err := s.store.UpdateLead(current.ID, userID, lead)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lead": updated})
}

func (s *Server) deleteLead(w http.ResponseWriter, r *http.Request, userID string) {
	if err := s.store.DeleteLead(r.PathValue("leadID"), userID); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listLeadActivities(w http.ResponseWriter, r *http.Request, userID string) {
	lead, err := s.store.LeadByID(r.PathValue("leadID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	project, err := s.store.ProjectByID(lead.ProjectID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if !projectAccessible(project, userID) {
		writeError(w, http.StatusForbidden, "você não tem acesso a este lead")
		return
	}
	activities, err := s.store.ListLeadActivities(lead.ID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"activities": activities})
}

func (s *Server) createLeadActivity(w http.ResponseWriter, r *http.Request, userID string) {
	lead, err := s.store.LeadByID(r.PathValue("leadID"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	var activity store.LeadActivity
	if !readJSON(w, r, &activity) {
		return
	}
	activity.LeadID = lead.ID
	if err := validateLeadActivity(activity); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	created, err := s.store.CreateLeadActivity(lead.ID, userID, activity)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"activity": created})
}

func (s *Server) requireAuth(next func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			writeError(w, http.StatusUnauthorized, "token de acesso ausente")
			return
		}
		userID, err := s.tokens.Parse(strings.TrimSpace(parts[1]))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "token de acesso inválido ou expirado")
			return
		}
		next(w, r, userID)
	}
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := s.config.CORSOrigin
		if origin == "" {
			origin = "http://localhost:3000"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type publicUserResponse struct {
	ID         string    `json:"id"`
	Alias      string    `json:"alias"`
	Email      string    `json:"email"`
	AvatarData string    `json:"avatar_data,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type projectMemberResponse struct {
	ID         string    `json:"id"`
	Alias      string    `json:"alias"`
	Email      string    `json:"email"`
	AvatarData string    `json:"avatar_data,omitempty"`
	Role       string    `json:"role"`
	CreatedAt  time.Time `json:"created_at"`
}

type taskAttachmentResponse struct {
	ID          string    `json:"id"`
	TaskID      string    `json:"task_id"`
	Name        string    `json:"name"`
	ContentType string    `json:"content_type"`
	Size        int64     `json:"size"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

func taskAttachmentView(item store.TaskAttachment) taskAttachmentResponse {
	return taskAttachmentResponse{
		ID: item.ID, TaskID: item.TaskID, Name: item.Name, ContentType: item.ContentType,
		Size: item.Size, CreatedBy: item.CreatedBy, CreatedAt: item.CreatedAt,
	}
}

type projectResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	ImageData   string    `json:"image_data,omitempty"`
	OwnerID     string    `json:"owner_id"`
	MemberIDs   []string  `json:"member_ids"`
	TaskCount   int       `json:"task_count"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func publicUser(user store.User) publicUserResponse {
	return publicUserResponse{ID: user.ID, Alias: userAlias(user), Email: user.Email, AvatarData: user.AvatarData, CreatedAt: user.CreatedAt}
}

func projectMember(member store.ProjectMember) projectMemberResponse {
	return projectMemberResponse{ID: member.User.ID, Alias: userAlias(member.User), Email: member.User.Email, AvatarData: member.User.AvatarData, Role: member.Role, CreatedAt: member.User.CreatedAt}
}

func userAlias(user store.User) string {
	if user.Alias != "" {
		return user.Alias
	}
	return strings.Split(user.Email, "@")[0]
}

func (s *Server) projectView(project store.Project) projectResponse {
	return projectResponse{
		ID: project.ID, Name: project.Name, Description: project.Description, ImageData: project.ImageData, OwnerID: project.OwnerID,
		MemberIDs: project.MemberIDs, TaskCount: s.store.TaskCountByProject(project.ID), CreatedAt: project.CreatedAt, UpdatedAt: project.UpdatedAt,
	}
}

func projectAccessible(project store.Project, userID string) bool {
	if project.OwnerID == userID {
		return true
	}
	for _, memberID := range project.MemberIDs {
		if memberID == userID {
			return true
		}
	}
	return false
}

func validateCredentials(request credentialsRequest) (string, string, error) {
	email, err := validateEmail(request.Email)
	if err != nil {
		return "", "", err
	}
	if len(request.Password) < 8 {
		return "", "", errors.New("a senha deve ter pelo menos 8 caracteres")
	}
	return email, request.Password, nil
}

func validateEmail(rawEmail string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(rawEmail))
	if len(email) > 254 {
		return "", errors.New("email inválido")
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || !strings.Contains(email, "@") {
		return "", errors.New("email inválido")
	}
	return email, nil
}

const (
	maxProjectDescriptionLength = 5000
	maxTaskDescriptionLength    = 10000
	maxProjectImageBytes        = 512 * 1024
	maxAvatarImageBytes         = 512 * 1024
)

func validateTask(title, description, status, priority, dueDate string) error {
	if title == "" || len(title) > 200 {
		return errors.New("o título da tarefa é obrigatório e deve ter até 200 caracteres")
	}
	if len(description) > maxTaskDescriptionLength {
		return errors.New("a descrição deve ter até 10000 caracteres")
	}
	if !oneOf(status, "backlog", "todo", "in_progress", "done") {
		return errors.New("status deve ser backlog, todo, in_progress ou done")
	}
	if !oneOf(priority, "low", "medium", "high") {
		return errors.New("prioridade deve ser low, medium ou high")
	}
	if dueDate != "" {
		if _, err := time.Parse("2006-01-02", dueDate); err != nil {
			return errors.New("due_date deve estar no formato YYYY-MM-DD")
		}
	}
	return nil
}

func validateLead(lead store.Lead) error {
	if strings.TrimSpace(lead.Name) == "" || len(lead.Name) > 200 {
		return errors.New("o nome do restaurante é obrigatório e deve ter até 200 caracteres")
	}
	if strings.TrimSpace(lead.City) == "" || len(lead.City) > 120 {
		return errors.New("a cidade é obrigatória e deve ter até 120 caracteres")
	}
	if len(lead.State) > 2 || len(lead.Category) > 120 || len(lead.Address) > 300 || len(lead.Neighborhood) > 120 {
		return errors.New("os dados de localização ou categoria são inválidos")
	}
	if len(lead.Notes) > 10000 || len(lead.ContactName) > 160 || len(lead.Phone) > 80 || len(lead.Email) > 254 {
		return errors.New("os dados de contato ou observações excedem o limite permitido")
	}
	if lead.Email != "" {
		if _, err := validateEmail(lead.Email); err != nil {
			return errors.New("email do contato inválido")
		}
	}
	if lead.Status == "" {
		lead.Status = store.LeadStatusNew
	}
	if !oneOf(lead.Status, store.LeadStatusNew, store.LeadStatusContacted, store.LeadStatusNoResponse, store.LeadStatusInterested, store.LeadStatusProposal, store.LeadStatusCustomer, store.LeadStatusDiscarded) {
		return errors.New("status do lead inválido")
	}
	if lead.PreferredChannel != "" && !oneOf(lead.PreferredChannel, store.LeadActivityWhatsApp, store.LeadActivityPhone, store.LeadActivityEmail, "instagram", "other") {
		return errors.New("canal preferido inválido")
	}
	if lead.NextContactAt != "" {
		if _, err := time.Parse("2006-01-02", lead.NextContactAt); err != nil {
			return errors.New("next_contact_at deve estar no formato YYYY-MM-DD")
		}
	}
	if lead.LocationPrecision != "" && !oneOf(lead.LocationPrecision, "address", "neighborhood", "city", "unknown") {
		return errors.New("precisão da localização inválida")
	}
	return nil
}

func validateLeadActivity(activity store.LeadActivity) error {
	if !oneOf(activity.Type, store.LeadActivityWhatsApp, store.LeadActivityPhone, store.LeadActivityEmail, store.LeadActivityMeeting, store.LeadActivityNote) {
		return errors.New("tipo de atividade inválido")
	}
	if strings.TrimSpace(activity.Body) == "" || len(activity.Body) > 5000 {
		return errors.New("a atividade precisa ter uma descrição de até 5000 caracteres")
	}
	if activity.StatusAfter != "" && !oneOf(activity.StatusAfter, store.LeadStatusNew, store.LeadStatusContacted, store.LeadStatusNoResponse, store.LeadStatusInterested, store.LeadStatusProposal, store.LeadStatusCustomer, store.LeadStatusDiscarded) {
		return errors.New("status posterior inválido")
	}
	return nil
}

func validateImageData(imageData string) error {
	if imageData == "" {
		return nil
	}
	separator := strings.IndexByte(imageData, ',')
	if separator <= 0 || separator == len(imageData)-1 {
		return errors.New("a imagem deve ser um arquivo PNG, JPEG ou WebP válido")
	}
	metadata := strings.Split(imageData[:separator], ";")
	if len(metadata) != 2 || !oneOf(metadata[0], "data:image/png", "data:image/jpeg", "data:image/webp") || metadata[1] != "base64" {
		return errors.New("a imagem deve ser um arquivo PNG, JPEG ou WebP válido")
	}
	decoded, err := base64.StdEncoding.DecodeString(imageData[separator+1:])
	if err != nil || len(decoded) == 0 {
		return errors.New("a imagem deve ser um arquivo PNG, JPEG ou WebP válido")
	}
	if len(decoded) > maxProjectImageBytes {
		return errors.New("a imagem deve ter até 512 KB")
	}
	mimeType := strings.TrimPrefix(metadata[0], "data:")
	if !imageBytesMatchMime(mimeType, decoded) {
		return errors.New("a imagem deve ser um arquivo PNG, JPEG ou WebP válido")
	}
	return nil
}

func validateAvatarData(imageData string) error {
	if imageData == "" {
		return nil
	}
	separator := strings.IndexByte(imageData, ',')
	if separator <= 0 || separator == len(imageData)-1 {
		return errors.New("a foto deve ser um arquivo GIF, PNG ou JPG válido")
	}
	metadata := strings.Split(imageData[:separator], ";")
	if len(metadata) != 2 || !oneOf(metadata[0], "data:image/gif", "data:image/png", "data:image/jpeg", "data:image/jpg") || metadata[1] != "base64" {
		return errors.New("a foto deve ser um arquivo GIF, PNG ou JPG válido")
	}
	decoded, err := base64.StdEncoding.DecodeString(imageData[separator+1:])
	if err != nil || len(decoded) == 0 {
		return errors.New("a foto deve ser um arquivo GIF, PNG ou JPG válido")
	}
	if len(decoded) > maxAvatarImageBytes {
		return errors.New("a foto deve ter até 512 KB")
	}
	mimeType := strings.TrimPrefix(metadata[0], "data:")
	if !avatarBytesMatchMime(mimeType, decoded) {
		return errors.New("a foto deve ser um arquivo GIF, PNG ou JPG válido")
	}
	return nil
}

func avatarBytesMatchMime(mimeType string, content []byte) bool {
	switch mimeType {
	case "image/png":
		return bytes.HasPrefix(content, []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a})
	case "image/jpeg", "image/jpg":
		return len(content) >= 3 && content[0] == 0xff && content[1] == 0xd8 && content[2] == 0xff
	case "image/gif":
		return bytes.HasPrefix(content, []byte("GIF87a")) || bytes.HasPrefix(content, []byte("GIF89a"))
	default:
		return false
	}
}

func imageBytesMatchMime(mimeType string, content []byte) bool {
	switch mimeType {
	case "image/png":
		return bytes.HasPrefix(content, []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a})
	case "image/jpeg":
		return len(content) >= 3 && content[0] == 0xff && content[1] == 0xd8 && content[2] == 0xff
	case "image/webp":
		return len(content) >= 12 && bytes.Equal(content[:4], []byte("RIFF")) && bytes.Equal(content[8:12], []byte("WEBP"))
	default:
		return false
	}
}

func oneOf(value string, values ...string) bool {
	for _, allowed := range values {
		if value == allowed {
			return true
		}
	}
	return false
}

func readJSON(w http.ResponseWriter, r *http.Request, destination any) bool {
	defer r.Body.Close()
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeError(w, http.StatusBadRequest, "o corpo deve conter apenas um objeto JSON")
		return false
	}
	return true
}

func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "registro não encontrado")
	case errors.Is(err, store.ErrConflict):
		writeError(w, http.StatusConflict, "registro já existe")
	case errors.Is(err, store.ErrNotMember):
		writeError(w, http.StatusForbidden, "usuário não pertence ao projeto")
	case errors.Is(err, store.ErrOwnerRequired):
		writeError(w, http.StatusForbidden, "somente o proprietário pode realizar esta ação")
	case errors.Is(err, store.ErrReadOnly):
		writeError(w, http.StatusForbidden, "este membro tem permissão somente para visualização")
	case errors.Is(err, store.ErrNotAuthor):
		writeError(w, http.StatusForbidden, "somente o autor pode remover este comentário")
	case errors.Is(err, store.ErrInvalid):
		writeError(w, http.StatusBadRequest, "operação inválida")
	default:
		writeError(w, http.StatusInternalServerError, "erro interno")
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
