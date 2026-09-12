package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var (
	ErrNotFound      = errors.New("registro não encontrado")
	ErrConflict      = errors.New("registro já existe")
	ErrInvalid       = errors.New("dados inválidos")
	ErrNotMember     = errors.New("usuário não pertence ao projeto")
	ErrOwnerRequired = errors.New("somente o proprietário pode realizar esta ação")
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"password_hash"`
	CreatedAt    time.Time `json:"created_at"`
}

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	OwnerID     string    `json:"owner_id"`
	MemberIDs   []string  `json:"member_ids"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Task struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"project_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	Priority    string    `json:"priority"`
	AssigneeID  string    `json:"assignee_id,omitempty"`
	DueDate     string    `json:"due_date,omitempty"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type data struct {
	Users    map[string]User    `json:"users"`
	Projects map[string]Project `json:"projects"`
	Tasks    map[string]Task    `json:"tasks"`
}

type Store struct {
	mu   sync.RWMutex
	path string
	data data
}

func New(path string) (*Store, error) {
	if path == "" {
		return nil, errors.New("caminho do armazenamento vazio")
	}
	s := &Store{path: path, data: data{
		Users:    make(map[string]User),
		Projects: make(map[string]Project),
		Tasks:    make(map[string]Task),
	}}
	contents, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, fmt.Errorf("ler armazenamento: %w", err)
	}
	if err := json.Unmarshal(contents, &s.data); err != nil {
		return nil, fmt.Errorf("decodificar armazenamento: %w", err)
	}
	if s.data.Users == nil {
		s.data.Users = make(map[string]User)
	}
	if s.data.Projects == nil {
		s.data.Projects = make(map[string]Project)
	}
	if s.data.Tasks == nil {
		s.data.Tasks = make(map[string]Task)
	}
	return s, nil
}

func (s *Store) CreateUser(email, passwordHash string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, existing := range s.data.Users {
		if strings.EqualFold(existing.Email, email) {
			return User{}, ErrConflict
		}
	}
	user := User{ID: newID(), Email: strings.ToLower(strings.TrimSpace(email)), PasswordHash: passwordHash, CreatedAt: time.Now().UTC()}
	s.data.Users[user.ID] = user
	return user, s.persistLocked()
}

func (s *Store) UserByEmail(email string) (User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, user := range s.data.Users {
		if strings.EqualFold(user.Email, strings.TrimSpace(email)) {
			return user, nil
		}
	}
	return User{}, ErrNotFound
}

func (s *Store) UserByID(id string) (User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	user, ok := s.data.Users[id]
	if !ok {
		return User{}, ErrNotFound
	}
	return user, nil
}

func (s *Store) ListUsers(query string) []User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	query = strings.ToLower(strings.TrimSpace(query))
	users := make([]User, 0, len(s.data.Users))
	for _, user := range s.data.Users {
		if query == "" || strings.Contains(strings.ToLower(user.Email), query) {
			users = append(users, user)
		}
	}
	return users
}

func (s *Store) CreateProject(ownerID, name, description string) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	project := Project{ID: newID(), Name: name, Description: description, OwnerID: ownerID, MemberIDs: []string{ownerID}, CreatedAt: now, UpdatedAt: now}
	s.data.Projects[project.ID] = project
	return project, s.persistLocked()
}

func (s *Store) ProjectByID(id string) (Project, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	project, ok := s.data.Projects[id]
	if !ok {
		return Project{}, ErrNotFound
	}
	project.MemberIDs = append([]string(nil), project.MemberIDs...)
	return project, nil
}

func (s *Store) ListProjects(userID string) []Project {
	s.mu.RLock()
	defer s.mu.RUnlock()
	projects := make([]Project, 0)
	for _, project := range s.data.Projects {
		if project.OwnerID == userID || contains(project.MemberIDs, userID) {
			project.MemberIDs = append([]string(nil), project.MemberIDs...)
			projects = append(projects, project)
		}
	}
	return projects
}

func (s *Store) UpdateProject(id, actorID, name, description string) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[id]
	if !ok {
		return Project{}, ErrNotFound
	}
	if project.OwnerID != actorID {
		return Project{}, ErrOwnerRequired
	}
	if name != "" {
		project.Name = name
	}
	project.Description = description
	project.UpdatedAt = time.Now().UTC()
	s.data.Projects[id] = project
	return project, s.persistLocked()
}

func (s *Store) DeleteProject(id, actorID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[id]
	if !ok {
		return ErrNotFound
	}
	if project.OwnerID != actorID {
		return ErrOwnerRequired
	}
	delete(s.data.Projects, id)
	for taskID, task := range s.data.Tasks {
		if task.ProjectID == id {
			delete(s.data.Tasks, taskID)
		}
	}
	return s.persistLocked()
}

func (s *Store) AddMember(projectID, actorID, userID string) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[projectID]
	if !ok {
		return Project{}, ErrNotFound
	}
	if project.OwnerID != actorID {
		return Project{}, ErrOwnerRequired
	}
	if _, ok := s.data.Users[userID]; !ok {
		return Project{}, ErrNotFound
	}
	if !contains(project.MemberIDs, userID) {
		project.MemberIDs = append(project.MemberIDs, userID)
		project.UpdatedAt = time.Now().UTC()
		s.data.Projects[projectID] = project
		if err := s.persistLocked(); err != nil {
			return Project{}, err
		}
	}
	return project, nil
}

func (s *Store) RemoveMember(projectID, actorID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[projectID]
	if !ok {
		return ErrNotFound
	}
	if project.OwnerID != actorID {
		return ErrOwnerRequired
	}
	if userID == project.OwnerID {
		return ErrInvalid
	}
	filtered := make([]string, 0, len(project.MemberIDs))
	for _, memberID := range project.MemberIDs {
		if memberID != userID {
			filtered = append(filtered, memberID)
		}
	}
	project.MemberIDs = filtered
	project.UpdatedAt = time.Now().UTC()
	s.data.Projects[projectID] = project
	for taskID, task := range s.data.Tasks {
		if task.ProjectID == projectID && task.AssigneeID == userID {
			task.AssigneeID = ""
			task.UpdatedAt = time.Now().UTC()
			s.data.Tasks[taskID] = task
		}
	}
	return s.persistLocked()
}

func (s *Store) CreateTask(projectID, creatorID, title, description, status, priority, assigneeID, dueDate string) (Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[projectID]
	if !ok {
		return Task{}, ErrNotFound
	}
	if !contains(project.MemberIDs, creatorID) {
		return Task{}, ErrNotMember
	}
	if assigneeID != "" && !contains(project.MemberIDs, assigneeID) {
		return Task{}, ErrNotMember
	}
	now := time.Now().UTC()
	task := Task{ID: newID(), ProjectID: projectID, Title: title, Description: description, Status: status, Priority: priority, AssigneeID: assigneeID, DueDate: dueDate, CreatedBy: creatorID, CreatedAt: now, UpdatedAt: now}
	s.data.Tasks[task.ID] = task
	return task, s.persistLocked()
}

func (s *Store) TasksByProject(projectID string) []Task {
	s.mu.RLock()
	defer s.mu.RUnlock()
	tasks := make([]Task, 0)
	for _, task := range s.data.Tasks {
		if task.ProjectID == projectID {
			tasks = append(tasks, task)
		}
	}
	return tasks
}

func (s *Store) TaskByID(id string) (Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	task, ok := s.data.Tasks[id]
	if !ok {
		return Task{}, ErrNotFound
	}
	return task, nil
}

func (s *Store) UpdateTask(id, actorID, title, description, status, priority, assigneeID, dueDate string) (Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	task, ok := s.data.Tasks[id]
	if !ok {
		return Task{}, ErrNotFound
	}
	project, ok := s.data.Projects[task.ProjectID]
	if !ok {
		return Task{}, ErrNotFound
	}
	if !contains(project.MemberIDs, actorID) {
		return Task{}, ErrNotMember
	}
	if assigneeID != "" && !contains(project.MemberIDs, assigneeID) {
		return Task{}, ErrNotMember
	}
	if title != "" {
		task.Title = title
	}
	task.Description = description
	task.Status = status
	task.Priority = priority
	task.AssigneeID = assigneeID
	task.DueDate = dueDate
	task.UpdatedAt = time.Now().UTC()
	s.data.Tasks[id] = task
	return task, s.persistLocked()
}

func (s *Store) DeleteTask(id, actorID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	task, ok := s.data.Tasks[id]
	if !ok {
		return ErrNotFound
	}
	project, ok := s.data.Projects[task.ProjectID]
	if !ok {
		return ErrNotFound
	}
	if !contains(project.MemberIDs, actorID) {
		return ErrNotMember
	}
	delete(s.data.Tasks, id)
	return s.persistLocked()
}

func (s *Store) HasProjectAccess(projectID, userID string) bool {
	project, err := s.ProjectByID(projectID)
	return err == nil && (project.OwnerID == userID || contains(project.MemberIDs, userID))
}

func (s *Store) persistLocked() error {
	directory := filepath.Dir(s.path)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return fmt.Errorf("criar diretório de dados: %w", err)
	}
	temporary, err := os.CreateTemp(directory, ".taskboard-*.tmp")
	if err != nil {
		return fmt.Errorf("criar arquivo temporário: %w", err)
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	encoder := json.NewEncoder(temporary)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(s.data); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("codificar armazenamento: %w", err)
	}
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("proteger armazenamento: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("fechar armazenamento: %w", err)
	}
	if err := os.Rename(temporaryName, s.path); err != nil {
		return fmt.Errorf("salvar armazenamento: %w", err)
	}
	return nil
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func newID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err == nil {
		return hex.EncodeToString(bytes)
	}
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
