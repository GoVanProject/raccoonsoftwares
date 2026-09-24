package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
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
	ErrReadOnly      = errors.New("este membro tem permissão somente para visualização")
	ErrNotAuthor     = errors.New("somente o autor pode remover este comentário")
)

const (
	MemberRoleOwner  = "owner"
	MemberRoleEditor = "editor"
	MemberRoleViewer = "viewer"
)

type User struct {
	ID           string    `json:"id"`
	Alias        string    `json:"alias"`
	Email        string    `json:"email"`
	AvatarData   string    `json:"avatar_data,omitempty"`
	PasswordHash string    `json:"password_hash"`
	CreatedAt    time.Time `json:"created_at"`
}

type Project struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	ImageData   string            `json:"image_data,omitempty"`
	OwnerID     string            `json:"owner_id"`
	MemberIDs   []string          `json:"member_ids"`
	MemberRoles map[string]string `json:"member_roles,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type ProjectMember struct {
	User User
	Role string
}

type Task struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"project_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	Priority    string    `json:"priority"`
	AssigneeID  string    `json:"assignee_id,omitempty"`
	LabelIDs    []string  `json:"label_ids"`
	DueDate     string    `json:"due_date,omitempty"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TaskComment struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	AuthorID  string    `json:"author_id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

type TaskSubtask struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	Title     string    `json:"title"`
	Done      bool      `json:"done"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TaskAttachment struct {
	ID          string    `json:"id"`
	TaskID      string    `json:"task_id"`
	Name        string    `json:"name"`
	ContentType string    `json:"content_type"`
	Size        int64     `json:"size"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	Data        []byte    `json:"data,omitempty"`
}

type Label struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"created_at"`
}

const (
	LeadStatusNew        = "new"
	LeadStatusContacted  = "contacted"
	LeadStatusNoResponse = "no_response"
	LeadStatusInterested = "interested"
	LeadStatusProposal   = "proposal"
	LeadStatusCustomer   = "customer"
	LeadStatusDiscarded  = "discarded"
	LeadActivityWhatsApp = "whatsapp"
	LeadActivityPhone    = "phone"
	LeadActivityEmail    = "email"
	LeadActivityMeeting  = "meeting"
	LeadActivityNote     = "note"
)

type Lead struct {
	ID                string    `json:"id"`
	ProjectID         string    `json:"project_id"`
	SourceKey         string    `json:"source_key,omitempty"`
	Name              string    `json:"name"`
	ContactName       string    `json:"contact_name,omitempty"`
	Phone             string    `json:"phone,omitempty"`
	Email             string    `json:"email,omitempty"`
	PreferredChannel  string    `json:"preferred_channel,omitempty"`
	City              string    `json:"city"`
	State             string    `json:"state"`
	Category          string    `json:"category,omitempty"`
	Address           string    `json:"address,omitempty"`
	Neighborhood      string    `json:"neighborhood,omitempty"`
	Rating            *float64  `json:"rating,omitempty"`
	RatingSource      string    `json:"rating_source,omitempty"`
	Website           string    `json:"website,omitempty"`
	WebsiteLabel      string    `json:"website_label,omitempty"`
	MapURL            string    `json:"map_url,omitempty"`
	Notes             string    `json:"notes,omitempty"`
	Latitude          *float64  `json:"latitude,omitempty"`
	Longitude         *float64  `json:"longitude,omitempty"`
	LocationPrecision string    `json:"location_precision,omitempty"`
	Status            string    `json:"status"`
	AssigneeID        string    `json:"assignee_id,omitempty"`
	NextContactAt     string    `json:"next_contact_at,omitempty"`
	LastContactAt     string    `json:"last_contact_at,omitempty"`
	CreatedBy         string    `json:"created_by"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type LeadActivity struct {
	ID          string    `json:"id"`
	LeadID      string    `json:"lead_id"`
	AuthorID    string    `json:"author_id"`
	Type        string    `json:"type"`
	Body        string    `json:"body"`
	StatusAfter string    `json:"status_after,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type LeadFilters struct {
	Search     string
	City       string
	Category   string
	Status     string
	AssigneeID string
}

type LeadImport struct {
	SourceKey         string   `json:"source_key"`
	Name              string   `json:"name"`
	ContactName       string   `json:"contact_name"`
	Phone             string   `json:"phone"`
	Email             string   `json:"email"`
	PreferredChannel  string   `json:"preferred_channel"`
	City              string   `json:"city"`
	State             string   `json:"state"`
	Category          string   `json:"category"`
	Address           string   `json:"address"`
	Neighborhood      string   `json:"neighborhood"`
	Rating            *float64 `json:"rating"`
	RatingSource      string   `json:"rating_source"`
	Website           string   `json:"website"`
	WebsiteLabel      string   `json:"website_label"`
	MapURL            string   `json:"map_url"`
	Notes             string   `json:"notes"`
	Latitude          *float64 `json:"latitude"`
	Longitude         *float64 `json:"longitude"`
	LocationPrecision string   `json:"location_precision"`
}

type data struct {
	Users           map[string]User           `json:"users"`
	Projects        map[string]Project        `json:"projects"`
	Tasks           map[string]Task           `json:"tasks"`
	Labels          map[string]Label          `json:"labels"`
	Leads           map[string]Lead           `json:"leads"`
	LeadActivities  map[string]LeadActivity   `json:"lead_activities"`
	TaskComments    map[string]TaskComment    `json:"task_comments"`
	TaskSubtasks    map[string]TaskSubtask    `json:"task_subtasks"`
	TaskAttachments map[string]TaskAttachment `json:"task_attachments"`
}

type Store struct {
	mu   sync.RWMutex
	path string
	data data
}

// Repository is the persistence contract consumed by the HTTP API.
// Store remains available for fast unit tests; PostgresStore is used by the server.
type Repository interface {
	CreateUser(email, passwordHash string, profile ...string) (User, error)
	UserByEmail(email string) (User, error)
	UserByID(id string) (User, error)
	UpdateUser(id, alias, email, passwordHash, avatarData string) (User, error)
	ListUsers(query string) []User
	ListProjects(userID string) []Project
	CreateProject(ownerID, name, description, imageData string) (Project, error)
	ProjectByID(id string) (Project, error)
	UpdateProject(id, actorID, name, description, imageData string) (Project, error)
	DeleteProject(id, actorID string) error
	AddMember(projectID, actorID, userID string) (Project, error)
	RemoveMember(projectID, actorID, userID string) error
	ListProjectMembers(projectID string) ([]ProjectMember, error)
	UpdateMemberRole(projectID, actorID, userID, role string) ([]ProjectMember, error)
	TasksByProject(projectID string) []Task
	TaskCountByProject(projectID string) int
	LabelsByProject(projectID string) []Label
	CreateLabel(projectID, actorID, name, color string) (Label, error)
	CreateTask(projectID, creatorID, title, description, status, priority, assigneeID, dueDate string, labelIDs []string) (Task, error)
	TaskByID(id string) (Task, error)
	UpdateTask(id, actorID, title, description, status, priority, assigneeID, dueDate string, labelIDs []string) (Task, error)
	DeleteTask(id, actorID string) error
	TaskComments(taskID string) ([]TaskComment, error)
	CreateTaskComment(taskID, authorID, body string) (TaskComment, error)
	DeleteTaskComment(commentID, actorID string) error
	TaskSubtasks(taskID string) ([]TaskSubtask, error)
	CreateTaskSubtask(taskID, actorID, title string) (TaskSubtask, error)
	UpdateTaskSubtask(id, actorID string, title *string, done *bool) (TaskSubtask, error)
	DeleteTaskSubtask(id, actorID string) error
	TaskAttachments(taskID string) ([]TaskAttachment, error)
	CreateTaskAttachment(taskID, actorID, name, contentType string, content []byte) (TaskAttachment, error)
	TaskAttachmentByID(id string) (TaskAttachment, error)
	DeleteTaskAttachment(id, actorID string) error
	ListLeads(projectID string, filters LeadFilters) []Lead
	CreateLead(projectID, creatorID string, lead Lead) (Lead, error)
	ImportLeads(projectID, creatorID string, leads []LeadImport) (created []Lead, skipped int, err error)
	LeadByID(id string) (Lead, error)
	UpdateLead(id, actorID string, lead Lead) (Lead, error)
	DeleteLead(id, actorID string) error
	ListLeadActivities(leadID string) ([]LeadActivity, error)
	CreateLeadActivity(leadID, authorID string, activity LeadActivity) (LeadActivity, error)
}

func New(path string) (*Store, error) {
	if path == "" {
		return nil, errors.New("caminho do armazenamento vazio")
	}
	s := &Store{path: path, data: data{
		Users:           make(map[string]User),
		Projects:        make(map[string]Project),
		Tasks:           make(map[string]Task),
		Labels:          make(map[string]Label),
		Leads:           make(map[string]Lead),
		LeadActivities:  make(map[string]LeadActivity),
		TaskComments:    make(map[string]TaskComment),
		TaskSubtasks:    make(map[string]TaskSubtask),
		TaskAttachments: make(map[string]TaskAttachment),
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
	if s.data.Labels == nil {
		s.data.Labels = make(map[string]Label)
	}
	for taskID, task := range s.data.Tasks {
		if task.LabelIDs == nil {
			task.LabelIDs = []string{}
			s.data.Tasks[taskID] = task
		}
	}
	if s.data.Leads == nil {
		s.data.Leads = make(map[string]Lead)
	}
	if s.data.LeadActivities == nil {
		s.data.LeadActivities = make(map[string]LeadActivity)
	}
	if s.data.TaskComments == nil {
		s.data.TaskComments = make(map[string]TaskComment)
	}
	if s.data.TaskSubtasks == nil {
		s.data.TaskSubtasks = make(map[string]TaskSubtask)
	}
	if s.data.TaskAttachments == nil {
		s.data.TaskAttachments = make(map[string]TaskAttachment)
	}
	return s, nil
}

func (s *Store) CreateUser(email, passwordHash string, profile ...string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, existing := range s.data.Users {
		if strings.EqualFold(existing.Email, email) {
			return User{}, ErrConflict
		}
	}
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	alias := ""
	avatarData := ""
	if len(profile) > 0 {
		alias = strings.TrimSpace(profile[0])
	}
	if len(profile) > 1 {
		avatarData = strings.TrimSpace(profile[1])
	}
	if alias == "" {
		alias = strings.Split(normalizedEmail, "@")[0]
	}
	user := User{ID: newID(), Alias: alias, Email: normalizedEmail, AvatarData: avatarData, PasswordHash: passwordHash, CreatedAt: time.Now().UTC()}
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

func (s *Store) UpdateUser(id, alias, email, passwordHash, avatarData string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	user, ok := s.data.Users[id]
	if !ok {
		return User{}, ErrNotFound
	}
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	for otherID, existing := range s.data.Users {
		if otherID != id && strings.EqualFold(existing.Email, normalizedEmail) {
			return User{}, ErrConflict
		}
	}
	user.Alias = strings.TrimSpace(alias)
	user.Email = normalizedEmail
	user.AvatarData = strings.TrimSpace(avatarData)
	if passwordHash != "" {
		user.PasswordHash = passwordHash
	}
	s.data.Users[id] = user
	return user, s.persistLocked()
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

func (s *Store) CreateProject(ownerID, name, description, imageData string) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	project := Project{ID: newID(), Name: name, Description: description, ImageData: imageData, OwnerID: ownerID, MemberIDs: []string{ownerID}, MemberRoles: map[string]string{ownerID: MemberRoleOwner}, CreatedAt: now, UpdatedAt: now}
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
	project.MemberRoles = cloneMemberRoles(project.MemberRoles)
	return project, nil
}

func (s *Store) ListProjects(userID string) []Project {
	s.mu.RLock()
	defer s.mu.RUnlock()
	projects := make([]Project, 0)
	for _, project := range s.data.Projects {
		if project.OwnerID == userID || contains(project.MemberIDs, userID) {
			project.MemberIDs = append([]string(nil), project.MemberIDs...)
			project.MemberRoles = cloneMemberRoles(project.MemberRoles)
			projects = append(projects, project)
		}
	}
	return projects
}

func (s *Store) UpdateProject(id, actorID, name, description, imageData string) (Project, error) {
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
	project.ImageData = imageData
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
			s.deleteTaskDetailsLocked(taskID)
		}
	}
	for labelID, label := range s.data.Labels {
		if label.ProjectID == id {
			delete(s.data.Labels, labelID)
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
		if project.MemberRoles == nil {
			project.MemberRoles = make(map[string]string)
		}
		project.MemberRoles[userID] = MemberRoleEditor
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
	if project.MemberRoles != nil {
		delete(project.MemberRoles, userID)
	}
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

func (s *Store) ListProjectMembers(projectID string) ([]ProjectMember, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	project, ok := s.data.Projects[projectID]
	if !ok {
		return nil, ErrNotFound
	}
	members := make([]ProjectMember, 0, len(project.MemberIDs))
	for _, memberID := range project.MemberIDs {
		user, exists := s.data.Users[memberID]
		if !exists {
			continue
		}
		members = append(members, ProjectMember{User: user, Role: memberRole(project, memberID)})
	}
	return members, nil
}

func (s *Store) UpdateMemberRole(projectID, actorID, userID, role string) ([]ProjectMember, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[projectID]
	if !ok {
		return nil, ErrNotFound
	}
	if project.OwnerID != actorID {
		return nil, ErrOwnerRequired
	}
	if userID == project.OwnerID || !contains(project.MemberIDs, userID) {
		return nil, ErrInvalid
	}
	if role != MemberRoleEditor && role != MemberRoleViewer {
		return nil, ErrInvalid
	}
	if project.MemberRoles == nil {
		project.MemberRoles = make(map[string]string)
	}
	project.MemberRoles[userID] = role
	project.UpdatedAt = time.Now().UTC()
	s.data.Projects[projectID] = project
	if err := s.persistLocked(); err != nil {
		return nil, err
	}

	members := make([]ProjectMember, 0, len(project.MemberIDs))
	for _, memberID := range project.MemberIDs {
		user, exists := s.data.Users[memberID]
		if exists {
			members = append(members, ProjectMember{User: user, Role: memberRole(project, memberID)})
		}
	}
	return members, nil
}

func (s *Store) LabelsByProject(projectID string) []Label {
	s.mu.RLock()
	defer s.mu.RUnlock()
	labels := make([]Label, 0)
	for _, label := range s.data.Labels {
		if label.ProjectID == projectID {
			labels = append(labels, label)
		}
	}
	return labels
}

func (s *Store) CreateLabel(projectID, actorID, name, color string) (Label, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[projectID]
	if !ok {
		return Label{}, ErrNotFound
	}
	if !contains(project.MemberIDs, actorID) {
		return Label{}, ErrNotMember
	}
	if memberRole(project, actorID) == MemberRoleViewer {
		return Label{}, ErrReadOnly
	}
	for _, label := range s.data.Labels {
		if label.ProjectID == projectID && strings.EqualFold(label.Name, name) {
			return Label{}, ErrConflict
		}
	}
	label := Label{ID: newID(), ProjectID: projectID, Name: name, Color: color, CreatedAt: time.Now().UTC()}
	s.data.Labels[label.ID] = label
	return label, s.persistLocked()
}

func (s *Store) CreateTask(projectID, creatorID, title, description, status, priority, assigneeID, dueDate string, labelIDs []string) (Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[projectID]
	if !ok {
		return Task{}, ErrNotFound
	}
	if !contains(project.MemberIDs, creatorID) {
		return Task{}, ErrNotMember
	}
	if memberRole(project, creatorID) == MemberRoleViewer {
		return Task{}, ErrReadOnly
	}
	if assigneeID != "" && !contains(project.MemberIDs, assigneeID) {
		return Task{}, ErrNotMember
	}
	labelIDs = normalizeIDs(labelIDs)
	if !s.labelsBelongToProjectLocked(projectID, labelIDs) {
		return Task{}, ErrInvalid
	}
	now := time.Now().UTC()
	task := Task{ID: newID(), ProjectID: projectID, Title: title, Description: description, Status: status, Priority: priority, AssigneeID: assigneeID, LabelIDs: labelIDs, DueDate: dueDate, CreatedBy: creatorID, CreatedAt: now, UpdatedAt: now}
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

func (s *Store) TaskCountByProject(projectID string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	count := 0
	for _, task := range s.data.Tasks {
		if task.ProjectID == projectID {
			count++
		}
	}
	return count
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

func (s *Store) UpdateTask(id, actorID, title, description, status, priority, assigneeID, dueDate string, labelIDs []string) (Task, error) {
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
	if memberRole(project, actorID) == MemberRoleViewer {
		return Task{}, ErrReadOnly
	}
	if assigneeID != "" && !contains(project.MemberIDs, assigneeID) {
		return Task{}, ErrNotMember
	}
	labelIDs = normalizeIDs(labelIDs)
	if !s.labelsBelongToProjectLocked(task.ProjectID, labelIDs) {
		return Task{}, ErrInvalid
	}
	if title != "" {
		task.Title = title
	}
	task.Description = description
	task.Status = status
	task.Priority = priority
	task.AssigneeID = assigneeID
	task.LabelIDs = labelIDs
	task.DueDate = dueDate
	task.UpdatedAt = time.Now().UTC()
	s.data.Tasks[id] = task
	return task, s.persistLocked()
}

func (s *Store) labelsBelongToProjectLocked(projectID string, labelIDs []string) bool {
	for _, labelID := range labelIDs {
		label, ok := s.data.Labels[labelID]
		if !ok || label.ProjectID != projectID {
			return false
		}
	}
	return true
}

func normalizeIDs(ids []string) []string {
	normalized := make([]string, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}
	return normalized
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
	if memberRole(project, actorID) == MemberRoleViewer {
		return ErrReadOnly
	}
	delete(s.data.Tasks, id)
	s.deleteTaskDetailsLocked(id)
	return s.persistLocked()
}

func (s *Store) deleteTaskDetailsLocked(taskID string) {
	for id, item := range s.data.TaskComments {
		if item.TaskID == taskID {
			delete(s.data.TaskComments, id)
		}
	}
	for id, item := range s.data.TaskSubtasks {
		if item.TaskID == taskID {
			delete(s.data.TaskSubtasks, id)
		}
	}
	for id, item := range s.data.TaskAttachments {
		if item.TaskID == taskID {
			delete(s.data.TaskAttachments, id)
		}
	}
}

func (s *Store) taskAccessLocked(taskID, actorID string, write bool) error {
	task, ok := s.data.Tasks[taskID]
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
	if write && memberRole(project, actorID) == MemberRoleViewer {
		return ErrReadOnly
	}
	return nil
}

func (s *Store) TaskComments(taskID string) ([]TaskComment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.data.Tasks[taskID]; !ok {
		return nil, ErrNotFound
	}
	items := make([]TaskComment, 0)
	for _, item := range s.data.TaskComments {
		if item.TaskID == taskID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.Before(items[j].CreatedAt) })
	return items, nil
}

func (s *Store) CreateTaskComment(taskID, authorID, body string) (TaskComment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.taskAccessLocked(taskID, authorID, true); err != nil {
		return TaskComment{}, err
	}
	item := TaskComment{ID: newID(), TaskID: taskID, AuthorID: authorID, Body: body, CreatedAt: time.Now().UTC()}
	s.data.TaskComments[item.ID] = item
	return item, s.persistLocked()
}

func (s *Store) DeleteTaskComment(commentID, actorID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.data.TaskComments[commentID]
	if !ok {
		return ErrNotFound
	}
	if err := s.taskAccessLocked(item.TaskID, actorID, true); err != nil {
		return err
	}
	if item.AuthorID != actorID {
		return ErrNotAuthor
	}
	delete(s.data.TaskComments, commentID)
	return s.persistLocked()
}

func (s *Store) TaskSubtasks(taskID string) ([]TaskSubtask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.data.Tasks[taskID]; !ok {
		return nil, ErrNotFound
	}
	items := make([]TaskSubtask, 0)
	for _, item := range s.data.TaskSubtasks {
		if item.TaskID == taskID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Position == items[j].Position {
			return items[i].CreatedAt.Before(items[j].CreatedAt)
		}
		return items[i].Position < items[j].Position
	})
	return items, nil
}

func (s *Store) CreateTaskSubtask(taskID, actorID, title string) (TaskSubtask, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.taskAccessLocked(taskID, actorID, true); err != nil {
		return TaskSubtask{}, err
	}
	position := 0
	for _, item := range s.data.TaskSubtasks {
		if item.TaskID == taskID && item.Position >= position {
			position = item.Position + 1
		}
	}
	now := time.Now().UTC()
	item := TaskSubtask{ID: newID(), TaskID: taskID, Title: title, Position: position, CreatedAt: now, UpdatedAt: now}
	s.data.TaskSubtasks[item.ID] = item
	return item, s.persistLocked()
}

func (s *Store) UpdateTaskSubtask(id, actorID string, title *string, done *bool) (TaskSubtask, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.data.TaskSubtasks[id]
	if !ok {
		return TaskSubtask{}, ErrNotFound
	}
	if err := s.taskAccessLocked(item.TaskID, actorID, true); err != nil {
		return TaskSubtask{}, err
	}
	if title != nil {
		item.Title = *title
	}
	if done != nil {
		item.Done = *done
	}
	item.UpdatedAt = time.Now().UTC()
	s.data.TaskSubtasks[id] = item
	return item, s.persistLocked()
}

func (s *Store) DeleteTaskSubtask(id, actorID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.data.TaskSubtasks[id]
	if !ok {
		return ErrNotFound
	}
	if err := s.taskAccessLocked(item.TaskID, actorID, true); err != nil {
		return err
	}
	delete(s.data.TaskSubtasks, id)
	return s.persistLocked()
}

func (s *Store) TaskAttachments(taskID string) ([]TaskAttachment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.data.Tasks[taskID]; !ok {
		return nil, ErrNotFound
	}
	items := make([]TaskAttachment, 0)
	for _, item := range s.data.TaskAttachments {
		if item.TaskID == taskID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.Before(items[j].CreatedAt) })
	return items, nil
}

func (s *Store) CreateTaskAttachment(taskID, actorID, name, contentType string, content []byte) (TaskAttachment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.taskAccessLocked(taskID, actorID, true); err != nil {
		return TaskAttachment{}, err
	}
	item := TaskAttachment{ID: newID(), TaskID: taskID, Name: name, ContentType: contentType, Size: int64(len(content)), CreatedBy: actorID, CreatedAt: time.Now().UTC(), Data: append([]byte(nil), content...)}
	s.data.TaskAttachments[item.ID] = item
	return item, s.persistLocked()
}

func (s *Store) TaskAttachmentByID(id string) (TaskAttachment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	item, ok := s.data.TaskAttachments[id]
	if !ok {
		return TaskAttachment{}, ErrNotFound
	}
	return item, nil
}

func (s *Store) DeleteTaskAttachment(id, actorID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.data.TaskAttachments[id]
	if !ok {
		return ErrNotFound
	}
	if err := s.taskAccessLocked(item.TaskID, actorID, true); err != nil {
		return err
	}
	delete(s.data.TaskAttachments, id)
	return s.persistLocked()
}

func (s *Store) ListLeads(projectID string, filters LeadFilters) []Lead {
	s.mu.RLock()
	defer s.mu.RUnlock()
	search := strings.ToLower(strings.TrimSpace(filters.Search))
	leads := make([]Lead, 0)
	for _, lead := range s.data.Leads {
		if lead.ProjectID != projectID {
			continue
		}
		haystack := strings.ToLower(strings.Join([]string{lead.Name, lead.ContactName, lead.Phone, lead.Email, lead.City, lead.State, lead.Category, lead.Address, lead.Neighborhood, lead.Notes}, " "))
		if search != "" && !strings.Contains(haystack, search) {
			continue
		}
		if filters.City != "" && lead.City != filters.City {
			continue
		}
		if filters.Category != "" && lead.Category != filters.Category {
			continue
		}
		if filters.Status != "" && lead.Status != filters.Status {
			continue
		}
		if filters.AssigneeID != "" && lead.AssigneeID != filters.AssigneeID {
			continue
		}
		leads = append(leads, lead)
	}
	return leads
}

func (s *Store) CreateLead(projectID, creatorID string, lead Lead) (Lead, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[projectID]
	if !ok {
		return Lead{}, ErrNotFound
	}
	if !contains(project.MemberIDs, creatorID) {
		return Lead{}, ErrNotMember
	}
	if memberRole(project, creatorID) == MemberRoleViewer {
		return Lead{}, ErrReadOnly
	}
	if lead.AssigneeID != "" && !contains(project.MemberIDs, lead.AssigneeID) {
		return Lead{}, ErrNotMember
	}
	if lead.SourceKey != "" && s.leadExistsBySourceKey(projectID, lead.SourceKey) {
		return Lead{}, ErrConflict
	}
	now := time.Now().UTC()
	lead.ID = newID()
	lead.ProjectID = projectID
	lead.CreatedBy = creatorID
	lead.CreatedAt = now
	lead.UpdatedAt = now
	if lead.Status == "" {
		lead.Status = LeadStatusNew
	}
	s.data.Leads[lead.ID] = lead
	return lead, s.persistLocked()
}

func (s *Store) ImportLeads(projectID, creatorID string, imports []LeadImport) (created []Lead, skipped int, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	project, ok := s.data.Projects[projectID]
	if !ok {
		return nil, 0, ErrNotFound
	}
	if !contains(project.MemberIDs, creatorID) {
		return nil, 0, ErrNotMember
	}
	if memberRole(project, creatorID) == MemberRoleViewer {
		return nil, 0, ErrReadOnly
	}
	now := time.Now().UTC()
	created = make([]Lead, 0, len(imports))
	for _, item := range imports {
		if strings.TrimSpace(item.Name) == "" || strings.TrimSpace(item.City) == "" {
			return nil, 0, ErrInvalid
		}
		sourceKey := strings.TrimSpace(item.SourceKey)
		if sourceKey == "" {
			sourceKey = leadDedupeKey(item.Name, item.City, item.Address)
		}
		if s.leadExistsBySourceKey(projectID, sourceKey) {
			skipped++
			continue
		}
		lead := Lead{
			ID:                newID(),
			ProjectID:         projectID,
			SourceKey:         sourceKey,
			Name:              strings.TrimSpace(item.Name),
			ContactName:       strings.TrimSpace(item.ContactName),
			Phone:             strings.TrimSpace(item.Phone),
			Email:             strings.TrimSpace(item.Email),
			PreferredChannel:  strings.TrimSpace(item.PreferredChannel),
			City:              strings.TrimSpace(item.City),
			State:             strings.TrimSpace(item.State),
			Category:          strings.TrimSpace(item.Category),
			Address:           strings.TrimSpace(item.Address),
			Neighborhood:      strings.TrimSpace(item.Neighborhood),
			Rating:            item.Rating,
			RatingSource:      strings.TrimSpace(item.RatingSource),
			Website:           strings.TrimSpace(item.Website),
			WebsiteLabel:      strings.TrimSpace(item.WebsiteLabel),
			MapURL:            strings.TrimSpace(item.MapURL),
			Notes:             strings.TrimSpace(item.Notes),
			Latitude:          item.Latitude,
			Longitude:         item.Longitude,
			LocationPrecision: strings.TrimSpace(item.LocationPrecision),
			Status:            LeadStatusNew,
			CreatedBy:         creatorID,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		if lead.AssigneeID != "" && !contains(project.MemberIDs, lead.AssigneeID) {
			return nil, 0, ErrNotMember
		}
		s.data.Leads[lead.ID] = lead
		created = append(created, lead)
	}
	if err := s.persistLocked(); err != nil {
		return nil, 0, err
	}
	return created, skipped, nil
}

func (s *Store) LeadByID(id string) (Lead, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	lead, ok := s.data.Leads[id]
	if !ok {
		return Lead{}, ErrNotFound
	}
	return lead, nil
}

func (s *Store) UpdateLead(id, actorID string, lead Lead) (Lead, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.data.Leads[id]
	if !ok {
		return Lead{}, ErrNotFound
	}
	project, ok := s.data.Projects[current.ProjectID]
	if !ok {
		return Lead{}, ErrNotFound
	}
	if !contains(project.MemberIDs, actorID) {
		return Lead{}, ErrNotMember
	}
	if memberRole(project, actorID) == MemberRoleViewer {
		return Lead{}, ErrReadOnly
	}
	if lead.AssigneeID != "" && !contains(project.MemberIDs, lead.AssigneeID) {
		return Lead{}, ErrNotMember
	}
	if lead.SourceKey != "" && lead.SourceKey != current.SourceKey && s.leadExistsBySourceKey(project.ID, lead.SourceKey) {
		return Lead{}, ErrConflict
	}
	lead.ID = current.ID
	lead.ProjectID = current.ProjectID
	lead.SourceKey = current.SourceKey
	lead.CreatedBy = current.CreatedBy
	lead.CreatedAt = current.CreatedAt
	lead.UpdatedAt = time.Now().UTC()
	s.data.Leads[id] = lead
	return lead, s.persistLocked()
}

func (s *Store) DeleteLead(id, actorID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	lead, ok := s.data.Leads[id]
	if !ok {
		return ErrNotFound
	}
	project, ok := s.data.Projects[lead.ProjectID]
	if !ok {
		return ErrNotFound
	}
	if !contains(project.MemberIDs, actorID) {
		return ErrNotMember
	}
	if memberRole(project, actorID) == MemberRoleViewer {
		return ErrReadOnly
	}
	delete(s.data.Leads, id)
	for activityID, activity := range s.data.LeadActivities {
		if activity.LeadID == id {
			delete(s.data.LeadActivities, activityID)
		}
	}
	return s.persistLocked()
}

func (s *Store) ListLeadActivities(leadID string) ([]LeadActivity, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.data.Leads[leadID]; !ok {
		return nil, ErrNotFound
	}
	activities := make([]LeadActivity, 0)
	for _, activity := range s.data.LeadActivities {
		if activity.LeadID == leadID {
			activities = append(activities, activity)
		}
	}
	return activities, nil
}

func (s *Store) CreateLeadActivity(leadID, authorID string, activity LeadActivity) (LeadActivity, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	lead, ok := s.data.Leads[leadID]
	if !ok {
		return LeadActivity{}, ErrNotFound
	}
	project, ok := s.data.Projects[lead.ProjectID]
	if !ok {
		return LeadActivity{}, ErrNotFound
	}
	if !contains(project.MemberIDs, authorID) {
		return LeadActivity{}, ErrNotMember
	}
	if memberRole(project, authorID) == MemberRoleViewer {
		return LeadActivity{}, ErrReadOnly
	}
	now := time.Now().UTC()
	activity.ID = newID()
	activity.LeadID = leadID
	activity.AuthorID = authorID
	activity.CreatedAt = now
	s.data.LeadActivities[activity.ID] = activity
	if activity.StatusAfter != "" {
		lead.Status = activity.StatusAfter
	}
	if activity.Type != LeadActivityNote {
		lead.LastContactAt = now.Format(time.RFC3339)
	}
	lead.UpdatedAt = now
	s.data.Leads[lead.ID] = lead
	if err := s.persistLocked(); err != nil {
		return LeadActivity{}, err
	}
	return activity, nil
}

func (s *Store) leadExistsBySourceKey(projectID, sourceKey string) bool {
	for _, lead := range s.data.Leads {
		if lead.ProjectID == projectID && lead.SourceKey == sourceKey {
			return true
		}
	}
	return false
}

func leadDedupeKey(name, city, address string) string {
	return strings.ToLower(strings.Join([]string{strings.TrimSpace(name), strings.TrimSpace(city), strings.TrimSpace(address)}, "|"))
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

func memberRole(project Project, userID string) string {
	if project.OwnerID == userID {
		return MemberRoleOwner
	}
	if role := project.MemberRoles[userID]; role == MemberRoleViewer || role == MemberRoleEditor {
		return role
	}
	return MemberRoleEditor
}

func cloneMemberRoles(roles map[string]string) map[string]string {
	if roles == nil {
		return nil
	}
	copy := make(map[string]string, len(roles))
	for userID, role := range roles {
		copy[userID] = role
	}
	return copy
}

func newID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err == nil {
		return hex.EncodeToString(bytes)
	}
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
