package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
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

	mux.HandleFunc("GET /api/tasks/{taskID}", s.requireAuth(s.getTask))
	mux.HandleFunc("PATCH /api/tasks/{taskID}", s.requireAuth(s.updateTask))
	mux.HandleFunc("DELETE /api/tasks/{taskID}", s.requireAuth(s.deleteTask))

	return s.cors(mux)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var request credentialsRequest
	if !readJSON(w, r, &request) {
		return
	}
	email, password, err := validateCredentials(request)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "não foi possível proteger a senha")
		return
	}
	user, err := s.store.CreateUser(email, passwordHash)
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
	sort.Slice(response, func(i, j int) bool { return response[i].Email < response[j].Email })
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
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Priority    string `json:"priority"`
	AssigneeID  string `json:"assignee_id"`
	DueDate     string `json:"due_date"`
}

type taskUpdateRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	Priority    *string `json:"priority"`
	AssigneeID  *string `json:"assignee_id"`
	DueDate     *string `json:"due_date"`
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
	task, err := s.store.CreateTask(r.PathValue("projectID"), userID, request.Title, request.Description, request.Status, request.Priority, request.AssigneeID, request.DueDate)
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
	if err := validateTask(title, description, status, priority, dueDate); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	updated, err := s.store.UpdateTask(task.ID, userID, title, description, status, priority, assigneeID, dueDate)
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
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

type projectMemberResponse struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
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
	return publicUserResponse{ID: user.ID, Email: user.Email, CreatedAt: user.CreatedAt}
}

func projectMember(member store.ProjectMember) projectMemberResponse {
	return projectMemberResponse{ID: member.User.ID, Email: member.User.Email, Role: member.Role, CreatedAt: member.User.CreatedAt}
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
	email := strings.ToLower(strings.TrimSpace(request.Email))
	if len(email) > 254 {
		return "", "", errors.New("email inválido")
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || !strings.Contains(email, "@") {
		return "", "", errors.New("email inválido")
	}
	if len(request.Password) < 8 {
		return "", "", errors.New("a senha deve ter pelo menos 8 caracteres")
	}
	return email, request.Password, nil
}

const (
	maxProjectDescriptionLength = 5000
	maxTaskDescriptionLength    = 10000
	maxProjectImageBytes        = 512 * 1024
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
