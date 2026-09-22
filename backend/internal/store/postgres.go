package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStore is the production repository backed by PostgreSQL.
type PostgresStore struct {
	pool *pgxpool.Pool
}

var _ Repository = (*PostgresStore)(nil)

func NewPostgres(databaseURL string) (*PostgresStore, error) {
	if strings.TrimSpace(databaseURL) == "" {
		return nil, errors.New("DATABASE_URL não configurada")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("configurar conexão PostgreSQL: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("conectar ao PostgreSQL: %w", err)
	}

	store := &PostgresStore{pool: pool}
	if err := store.migrate(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrar banco de dados: %w", err)
	}
	return store, nil
}

func (s *PostgresStore) Close() {
	s.pool.Close()
}

func (s *PostgresStore) migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    alias TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    avatar_data TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS alias TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_data TEXT NOT NULL DEFAULT '',
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_data TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS project_members (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'editor',
    PRIMARY KEY (project_id, user_id)
);
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'editor';
UPDATE project_members pm SET role = 'owner'
FROM projects p
WHERE pm.project_id = p.id AND pm.user_id = p.owner_id;

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    due_date TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks (project_id);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members (user_id);

CREATE TABLE IF NOT EXISTS restaurant_leads (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_key TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    contact_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    preferred_channel TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    neighborhood TEXT NOT NULL DEFAULT '',
    rating DOUBLE PRECISION,
    rating_source TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    website_label TEXT NOT NULL DEFAULT '',
    map_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_precision TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    next_contact_at TEXT NOT NULL DEFAULT '',
    last_contact_at TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS restaurant_leads_project_id_idx ON restaurant_leads (project_id);
CREATE INDEX IF NOT EXISTS restaurant_leads_status_idx ON restaurant_leads (project_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_leads_source_key_idx ON restaurant_leads (project_id, source_key) WHERE source_key <> '';

CREATE TABLE IF NOT EXISTS lead_activities (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES restaurant_leads(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    status_after TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS lead_activities_lead_id_idx ON lead_activities (lead_id, created_at);
`)
	return err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanUser(row rowScanner) (User, error) {
	var user User
	if err := row.Scan(&user.ID, &user.Alias, &user.Email, &user.AvatarData, &user.PasswordHash, &user.CreatedAt); err != nil {
		return User{}, translatePostgresError(err)
	}
	if user.Alias == "" {
		user.Alias = strings.Split(user.Email, "@")[0]
	}
	return user, nil
}

func scanProject(row rowScanner) (Project, error) {
	var project Project
	if err := row.Scan(&project.ID, &project.Name, &project.Description, &project.ImageData, &project.OwnerID, &project.MemberIDs, &project.CreatedAt, &project.UpdatedAt); err != nil {
		return Project{}, translatePostgresError(err)
	}
	return project, nil
}

func scanTask(row rowScanner) (Task, error) {
	var task Task
	if err := row.Scan(&task.ID, &task.ProjectID, &task.Title, &task.Description, &task.Status, &task.Priority, &task.AssigneeID, &task.DueDate, &task.CreatedBy, &task.CreatedAt, &task.UpdatedAt); err != nil {
		return Task{}, translatePostgresError(err)
	}
	return task, nil
}

func scanLead(row rowScanner) (Lead, error) {
	var lead Lead
	var rating, latitude, longitude float64
	if err := row.Scan(
		&lead.ID, &lead.ProjectID, &lead.SourceKey, &lead.Name, &lead.ContactName, &lead.Phone,
		&lead.Email, &lead.PreferredChannel, &lead.City, &lead.State, &lead.Category,
		&lead.Address, &lead.Neighborhood, &rating, &lead.RatingSource, &lead.Website,
		&lead.WebsiteLabel, &lead.MapURL, &lead.Notes, &latitude, &longitude,
		&lead.LocationPrecision, &lead.Status, &lead.AssigneeID, &lead.NextContactAt,
		&lead.LastContactAt, &lead.CreatedBy, &lead.CreatedAt, &lead.UpdatedAt,
	); err != nil {
		return Lead{}, translatePostgresError(err)
	}
	if rating > 0 {
		lead.Rating = &rating
	}
	if latitude != 0 || longitude != 0 {
		lead.Latitude = &latitude
		lead.Longitude = &longitude
	}
	return lead, nil
}

func scanLeadActivity(row rowScanner) (LeadActivity, error) {
	var activity LeadActivity
	if err := row.Scan(&activity.ID, &activity.LeadID, &activity.AuthorID, &activity.Type, &activity.Body, &activity.StatusAfter, &activity.CreatedAt); err != nil {
		return LeadActivity{}, translatePostgresError(err)
	}
	return activity, nil
}

func translatePostgresError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) && postgresError.Code == "23505" {
		return ErrConflict
	}
	return err
}

func projectSelectQuery() string {
	return `
SELECT p.id, p.name, p.description, p.image_data, p.owner_id,
       COALESCE(array_agg(pm.user_id ORDER BY pm.user_id) FILTER (WHERE pm.user_id IS NOT NULL), ARRAY[]::TEXT[]),
       p.created_at, p.updated_at
FROM projects p
LEFT JOIN project_members pm ON pm.project_id = p.id`
}

func (s *PostgresStore) CreateUser(email, passwordHash string, profile ...string) (User, error) {
	ctx := context.Background()
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
	return scanUser(s.pool.QueryRow(ctx, `
INSERT INTO users (id, alias, email, avatar_data, password_hash, created_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, alias, email, avatar_data, password_hash, created_at`, newID(), alias, normalizedEmail, avatarData, passwordHash, time.Now().UTC()))
}

func (s *PostgresStore) UpdateUser(id, alias, email, passwordHash, avatarData string) (User, error) {
	return scanUser(s.pool.QueryRow(context.Background(), `
UPDATE users
SET alias = $2,
    email = $3,
    avatar_data = $4,
    password_hash = CASE WHEN $5 = '' THEN password_hash ELSE $5 END
WHERE id = $1
RETURNING id, alias, email, avatar_data, password_hash, created_at`, id, strings.TrimSpace(alias), strings.ToLower(strings.TrimSpace(email)), strings.TrimSpace(avatarData), passwordHash))
}

func (s *PostgresStore) UserByEmail(email string) (User, error) {
	return scanUser(s.pool.QueryRow(context.Background(), `
SELECT id, alias, email, avatar_data, password_hash, created_at
FROM users
WHERE LOWER(email) = LOWER($1)`, strings.TrimSpace(email)))
}

func (s *PostgresStore) UserByID(id string) (User, error) {
	return scanUser(s.pool.QueryRow(context.Background(), `
SELECT id, alias, email, avatar_data, password_hash, created_at
FROM users
WHERE id = $1`, id))
}

func (s *PostgresStore) ListUsers(query string) []User {
	rows, err := s.pool.Query(context.Background(), `
SELECT id, alias, email, avatar_data, password_hash, created_at
FROM users
WHERE $1 = '' OR POSITION(LOWER($1) IN LOWER(email)) > 0
ORDER BY email`, strings.ToLower(strings.TrimSpace(query)))
	if err != nil {
		return []User{}
	}
	defer rows.Close()
	users := make([]User, 0)
	for rows.Next() {
		user, scanErr := scanUser(rows)
		if scanErr == nil {
			users = append(users, user)
		}
	}
	return users
}

func (s *PostgresStore) CreateProject(ownerID, name, description, imageData string) (Project, error) {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Project{}, fmt.Errorf("iniciar criação de projeto: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	now := time.Now().UTC()
	project := Project{ID: newID(), Name: name, Description: description, ImageData: imageData, OwnerID: ownerID, MemberIDs: []string{ownerID}, CreatedAt: now, UpdatedAt: now}
	if _, err := tx.Exec(ctx, `
INSERT INTO projects (id, name, description, image_data, owner_id, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)`, project.ID, project.Name, project.Description, project.ImageData, project.OwnerID, project.CreatedAt, project.UpdatedAt); err != nil {
		return Project{}, translatePostgresError(err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')`, project.ID, ownerID); err != nil {
		return Project{}, translatePostgresError(err)
	}
	if err := tx.Commit(ctx); err != nil {
		return Project{}, fmt.Errorf("confirmar criação de projeto: %w", err)
	}
	return project, nil
}

func (s *PostgresStore) ProjectByID(id string) (Project, error) {
	query := projectSelectQuery() + ` WHERE p.id = $1 GROUP BY p.id, p.name, p.description, p.image_data, p.owner_id, p.created_at, p.updated_at`
	return scanProject(s.pool.QueryRow(context.Background(), query, id))
}

func (s *PostgresStore) ListProjects(userID string) []Project {
	query := projectSelectQuery() + `
WHERE p.owner_id = $1 OR EXISTS (SELECT 1 FROM project_members visible_member WHERE visible_member.project_id = p.id AND visible_member.user_id = $1)
GROUP BY p.id, p.name, p.description, p.image_data, p.owner_id, p.created_at, p.updated_at
ORDER BY p.updated_at DESC`
	rows, err := s.pool.Query(context.Background(), query, userID)
	if err != nil {
		return []Project{}
	}
	defer rows.Close()
	projects := make([]Project, 0)
	for rows.Next() {
		project, scanErr := scanProject(rows)
		if scanErr == nil {
			projects = append(projects, project)
		}
	}
	return projects
}

func (s *PostgresStore) UpdateProject(id, actorID, name, description, imageData string) (Project, error) {
	ownerID, err := s.projectOwner(id)
	if err != nil {
		return Project{}, err
	}
	if ownerID != actorID {
		return Project{}, ErrOwnerRequired
	}
	_, err = s.pool.Exec(context.Background(), `
UPDATE projects
SET name = $2, description = $3, image_data = $4, updated_at = $5
WHERE id = $1`, id, name, description, imageData, time.Now().UTC())
	if err != nil {
		return Project{}, translatePostgresError(err)
	}
	return s.ProjectByID(id)
}

func (s *PostgresStore) DeleteProject(id, actorID string) error {
	ownerID, err := s.projectOwner(id)
	if err != nil {
		return err
	}
	if ownerID != actorID {
		return ErrOwnerRequired
	}
	_, err = s.pool.Exec(context.Background(), `DELETE FROM projects WHERE id = $1`, id)
	return translatePostgresError(err)
}

func (s *PostgresStore) projectOwner(projectID string) (string, error) {
	var ownerID string
	err := s.pool.QueryRow(context.Background(), `SELECT owner_id FROM projects WHERE id = $1`, projectID).Scan(&ownerID)
	if err != nil {
		return "", translatePostgresError(err)
	}
	return ownerID, nil
}

func (s *PostgresStore) userExists(userID string) bool {
	var exists bool
	return s.pool.QueryRow(context.Background(), `SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)`, userID).Scan(&exists) == nil && exists
}

func (s *PostgresStore) projectMemberExists(projectID, userID string) bool {
	var exists bool
	return s.pool.QueryRow(context.Background(), `SELECT EXISTS (SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2)`, projectID, userID).Scan(&exists) == nil && exists
}

func (s *PostgresStore) projectMemberRole(projectID, userID string) (string, error) {
	var role string
	err := s.pool.QueryRow(context.Background(), `
SELECT CASE WHEN p.owner_id = $2 THEN 'owner' ELSE COALESCE(pm.role, '') END
FROM projects p
LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
WHERE p.id = $1`, projectID, userID).Scan(&role)
	if err != nil {
		return "", translatePostgresError(err)
	}
	if role == "" {
		return "", ErrNotMember
	}
	return role, nil
}

func (s *PostgresStore) AddMember(projectID, actorID, userID string) (Project, error) {
	ownerID, err := s.projectOwner(projectID)
	if err != nil {
		return Project{}, err
	}
	if ownerID != actorID {
		return Project{}, ErrOwnerRequired
	}
	if !s.userExists(userID) {
		return Project{}, ErrNotFound
	}
	result, err := s.pool.Exec(context.Background(), `
INSERT INTO project_members (project_id, user_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING`, projectID, userID)
	if err != nil {
		return Project{}, translatePostgresError(err)
	}
	if result.RowsAffected() > 0 {
		if _, err := s.pool.Exec(context.Background(), `UPDATE projects SET updated_at = $2 WHERE id = $1`, projectID, time.Now().UTC()); err != nil {
			return Project{}, translatePostgresError(err)
		}
	}
	return s.ProjectByID(projectID)
}

func (s *PostgresStore) ListProjectMembers(projectID string) ([]ProjectMember, error) {
	rows, err := s.pool.Query(context.Background(), `
SELECT u.id, u.alias, u.email, u.avatar_data, u.password_hash, u.created_at, pm.role
FROM project_members pm
JOIN users u ON u.id = pm.user_id
WHERE pm.project_id = $1
ORDER BY LOWER(u.email)`, projectID)
	if err != nil {
		return nil, translatePostgresError(err)
	}
	defer rows.Close()
	members := make([]ProjectMember, 0)
	for rows.Next() {
		var member ProjectMember
		if err := rows.Scan(&member.User.ID, &member.User.Alias, &member.User.Email, &member.User.AvatarData, &member.User.PasswordHash, &member.User.CreatedAt, &member.Role); err != nil {
			return nil, translatePostgresError(err)
		}
		if member.User.Alias == "" {
			member.User.Alias = strings.Split(member.User.Email, "@")[0]
		}
		members = append(members, member)
	}
	if err := rows.Err(); err != nil {
		return nil, translatePostgresError(err)
	}
	if len(members) == 0 {
		if _, err := s.projectOwner(projectID); err != nil {
			return nil, err
		}
	}
	return members, nil
}

func (s *PostgresStore) UpdateMemberRole(projectID, actorID, userID, role string) ([]ProjectMember, error) {
	ownerID, err := s.projectOwner(projectID)
	if err != nil {
		return nil, err
	}
	if ownerID != actorID {
		return nil, ErrOwnerRequired
	}
	if userID == ownerID || (role != MemberRoleEditor && role != MemberRoleViewer) {
		return nil, ErrInvalid
	}
	result, err := s.pool.Exec(context.Background(), `UPDATE project_members SET role = $3 WHERE project_id = $1 AND user_id = $2`, projectID, userID, role)
	if err != nil {
		return nil, translatePostgresError(err)
	}
	if result.RowsAffected() == 0 {
		return nil, ErrInvalid
	}
	return s.ListProjectMembers(projectID)
}

func (s *PostgresStore) RemoveMember(projectID, actorID, userID string) error {
	ownerID, err := s.projectOwner(projectID)
	if err != nil {
		return err
	}
	if ownerID != actorID {
		return ErrOwnerRequired
	}
	if userID == ownerID {
		return ErrInvalid
	}

	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar remoção de integrante: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, projectID, userID); err != nil {
		return translatePostgresError(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE tasks SET assignee_id = NULL, updated_at = $3 WHERE project_id = $1 AND assignee_id = $2`, projectID, userID, time.Now().UTC()); err != nil {
		return translatePostgresError(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE projects SET updated_at = $2 WHERE id = $1`, projectID, time.Now().UTC()); err != nil {
		return translatePostgresError(err)
	}
	return tx.Commit(ctx)
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func nullableFloat(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}

func leadSelectQuery() string {
	return `
SELECT id, project_id, source_key, name, contact_name, phone, email, preferred_channel,
       city, state, category, address, neighborhood, COALESCE(rating, 0), rating_source,
       website, website_label, map_url, notes, COALESCE(latitude, 0), COALESCE(longitude, 0),
       location_precision, status, COALESCE(assignee_id, ''), next_contact_at, last_contact_at,
       created_by, created_at, updated_at
FROM restaurant_leads`
}

func leadInsertQuery() string {
	return `
INSERT INTO restaurant_leads (
    id, project_id, source_key, name, contact_name, phone, email, preferred_channel,
    city, state, category, address, neighborhood, rating, rating_source, website,
    website_label, map_url, notes, latitude, longitude, location_precision, status,
    assignee_id, next_contact_at, last_contact_at, created_by, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
RETURNING id, project_id, source_key, name, contact_name, phone, email, preferred_channel,
          city, state, category, address, neighborhood, COALESCE(rating, 0), rating_source,
          website, website_label, map_url, notes, COALESCE(latitude, 0), COALESCE(longitude, 0),
          location_precision, status, COALESCE(assignee_id, ''), next_contact_at, last_contact_at,
		  created_by, created_at, updated_at`
}

func leadInsertQueryWithConflictHandling() string {
	return strings.Replace(leadInsertQuery(), "RETURNING", "ON CONFLICT DO NOTHING RETURNING", 1)
}

func leadInsertArgs(lead Lead, id, projectID, creatorID string, now time.Time) []any {
	status := lead.Status
	if status == "" {
		status = LeadStatusNew
	}
	return []any{
		id, projectID, lead.SourceKey, lead.Name, lead.ContactName, lead.Phone, lead.Email,
		lead.PreferredChannel, lead.City, lead.State, lead.Category, lead.Address, lead.Neighborhood,
		nullableFloat(lead.Rating), lead.RatingSource, lead.Website, lead.WebsiteLabel, lead.MapURL,
		lead.Notes, nullableFloat(lead.Latitude), nullableFloat(lead.Longitude), lead.LocationPrecision,
		status, nullableString(lead.AssigneeID), lead.NextContactAt, lead.LastContactAt,
		creatorID, now, now,
	}
}

func (s *PostgresStore) ListLeads(projectID string, filters LeadFilters) []Lead {
	rows, err := s.pool.Query(context.Background(), leadSelectQuery()+`
WHERE project_id = $1
  AND ($2 = '' OR CONCAT_WS(' ', name, contact_name, phone, email, city, state, category, address, neighborhood, notes) ILIKE '%' || $2 || '%')
  AND ($3 = '' OR city = $3)
  AND ($4 = '' OR category = $4)
  AND ($5 = '' OR status = $5)
  AND ($6 = '' OR COALESCE(assignee_id, '') = $6)
ORDER BY city, name`, projectID, strings.TrimSpace(filters.Search), strings.TrimSpace(filters.City), strings.TrimSpace(filters.Category), strings.TrimSpace(filters.Status), strings.TrimSpace(filters.AssigneeID))
	if err != nil {
		return []Lead{}
	}
	defer rows.Close()
	leads := make([]Lead, 0)
	for rows.Next() {
		lead, scanErr := scanLead(rows)
		if scanErr == nil {
			leads = append(leads, lead)
		}
	}
	return leads
}

func (s *PostgresStore) CreateLead(projectID, creatorID string, lead Lead) (Lead, error) {
	if _, err := s.projectOwner(projectID); err != nil {
		return Lead{}, err
	}
	if !s.projectMemberExists(projectID, creatorID) {
		return Lead{}, ErrNotMember
	}
	role, err := s.projectMemberRole(projectID, creatorID)
	if err != nil {
		return Lead{}, err
	}
	if role == MemberRoleViewer {
		return Lead{}, ErrReadOnly
	}
	if lead.AssigneeID != "" && !s.projectMemberExists(projectID, lead.AssigneeID) {
		return Lead{}, ErrNotMember
	}
	now := time.Now().UTC()
	return scanLead(s.pool.QueryRow(context.Background(), leadInsertQuery(), leadInsertArgs(lead, newID(), projectID, creatorID, now)...))
}

func (s *PostgresStore) ImportLeads(projectID, creatorID string, imports []LeadImport) (created []Lead, skipped int, err error) {
	if _, err := s.projectOwner(projectID); err != nil {
		return nil, 0, err
	}
	if !s.projectMemberExists(projectID, creatorID) {
		return nil, 0, ErrNotMember
	}
	role, err := s.projectMemberRole(projectID, creatorID)
	if err != nil {
		return nil, 0, err
	}
	if role == MemberRoleViewer {
		return nil, 0, ErrReadOnly
	}
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("iniciar importação de leads: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	created = make([]Lead, 0, len(imports))
	for _, item := range imports {
		if strings.TrimSpace(item.Name) == "" || strings.TrimSpace(item.City) == "" {
			return nil, 0, ErrInvalid
		}
		lead := Lead{
			SourceKey: item.SourceKey, Name: item.Name, ContactName: item.ContactName, Phone: item.Phone,
			Email: item.Email, PreferredChannel: item.PreferredChannel, City: item.City, State: item.State,
			Category: item.Category, Address: item.Address, Neighborhood: item.Neighborhood, Rating: item.Rating,
			RatingSource: item.RatingSource, Website: item.Website, WebsiteLabel: item.WebsiteLabel,
			MapURL: item.MapURL, Notes: item.Notes, Latitude: item.Latitude, Longitude: item.Longitude,
			LocationPrecision: item.LocationPrecision,
		}
		if lead.SourceKey == "" {
			lead.SourceKey = leadDedupeKey(lead.Name, lead.City, lead.Address)
		}
		now := time.Now().UTC()
		row := tx.QueryRow(ctx, leadInsertQueryWithConflictHandling(), leadInsertArgs(lead, newID(), projectID, creatorID, now)...)
		inserted, scanErr := scanLead(row)
		if errors.Is(scanErr, pgx.ErrNoRows) {
			skipped++
			continue
		}
		if scanErr != nil {
			return nil, 0, scanErr
		}
		created = append(created, inserted)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, 0, fmt.Errorf("confirmar importação de leads: %w", err)
	}
	return created, skipped, nil
}

func (s *PostgresStore) LeadByID(id string) (Lead, error) {
	return scanLead(s.pool.QueryRow(context.Background(), leadSelectQuery()+` WHERE id = $1`, id))
}

func (s *PostgresStore) UpdateLead(id, actorID string, lead Lead) (Lead, error) {
	var projectID, sourceKey string
	if err := s.pool.QueryRow(context.Background(), `SELECT project_id, source_key FROM restaurant_leads WHERE id = $1`, id).Scan(&projectID, &sourceKey); err != nil {
		return Lead{}, translatePostgresError(err)
	}
	if !s.projectMemberExists(projectID, actorID) {
		return Lead{}, ErrNotMember
	}
	role, err := s.projectMemberRole(projectID, actorID)
	if err != nil {
		return Lead{}, err
	}
	if role == MemberRoleViewer {
		return Lead{}, ErrReadOnly
	}
	if lead.AssigneeID != "" && !s.projectMemberExists(projectID, lead.AssigneeID) {
		return Lead{}, ErrNotMember
	}
	lead.SourceKey = sourceKey
	query := `
UPDATE restaurant_leads
SET name = $2, contact_name = $3, phone = $4, email = $5, preferred_channel = $6,
    city = $7, state = $8, category = $9, address = $10, neighborhood = $11, rating = $12,
    rating_source = $13, website = $14, website_label = $15, map_url = $16, notes = $17,
    latitude = $18, longitude = $19, location_precision = $20, status = $21, assignee_id = $22,
    next_contact_at = $23, last_contact_at = $24, updated_at = $25
WHERE id = $1
RETURNING id, project_id, source_key, name, contact_name, phone, email, preferred_channel,
          city, state, category, address, neighborhood, COALESCE(rating, 0), rating_source,
          website, website_label, map_url, notes, COALESCE(latitude, 0), COALESCE(longitude, 0),
          location_precision, status, COALESCE(assignee_id, ''), next_contact_at, last_contact_at,
          created_by, created_at, updated_at`
	return scanLead(s.pool.QueryRow(context.Background(), query, id, lead.Name, lead.ContactName, lead.Phone, lead.Email, lead.PreferredChannel, lead.City, lead.State, lead.Category, lead.Address, lead.Neighborhood, nullableFloat(lead.Rating), lead.RatingSource, lead.Website, lead.WebsiteLabel, lead.MapURL, lead.Notes, nullableFloat(lead.Latitude), nullableFloat(lead.Longitude), lead.LocationPrecision, lead.Status, nullableString(lead.AssigneeID), lead.NextContactAt, lead.LastContactAt, time.Now().UTC()))
}

func (s *PostgresStore) DeleteLead(id, actorID string) error {
	var projectID string
	if err := s.pool.QueryRow(context.Background(), `SELECT project_id FROM restaurant_leads WHERE id = $1`, id).Scan(&projectID); err != nil {
		return translatePostgresError(err)
	}
	if !s.projectMemberExists(projectID, actorID) {
		return ErrNotMember
	}
	role, err := s.projectMemberRole(projectID, actorID)
	if err != nil {
		return err
	}
	if role == MemberRoleViewer {
		return ErrReadOnly
	}
	_, err = s.pool.Exec(context.Background(), `DELETE FROM restaurant_leads WHERE id = $1`, id)
	return translatePostgresError(err)
}

func (s *PostgresStore) ListLeadActivities(leadID string) ([]LeadActivity, error) {
	if _, err := s.LeadByID(leadID); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(context.Background(), `
SELECT id, lead_id, author_id, type, body, status_after, created_at
FROM lead_activities WHERE lead_id = $1 ORDER BY created_at DESC`, leadID)
	if err != nil {
		return nil, translatePostgresError(err)
	}
	defer rows.Close()
	activities := make([]LeadActivity, 0)
	for rows.Next() {
		activity, scanErr := scanLeadActivity(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		activities = append(activities, activity)
	}
	return activities, translatePostgresError(rows.Err())
}

func (s *PostgresStore) CreateLeadActivity(leadID, authorID string, activity LeadActivity) (LeadActivity, error) {
	lead, err := s.LeadByID(leadID)
	if err != nil {
		return LeadActivity{}, err
	}
	if !s.projectMemberExists(lead.ProjectID, authorID) {
		return LeadActivity{}, ErrNotMember
	}
	role, err := s.projectMemberRole(lead.ProjectID, authorID)
	if err != nil {
		return LeadActivity{}, err
	}
	if role == MemberRoleViewer {
		return LeadActivity{}, ErrReadOnly
	}
	now := time.Now().UTC()
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LeadActivity{}, fmt.Errorf("iniciar registro de atividade: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	created, createdErr := scanLeadActivity(tx.QueryRow(ctx, `
INSERT INTO lead_activities (id, lead_id, author_id, type, body, status_after, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, lead_id, author_id, type, body, status_after, created_at`, newID(), leadID, authorID, activity.Type, activity.Body, activity.StatusAfter, now))
	if createdErr != nil {
		return LeadActivity{}, createdErr
	}
	if activity.StatusAfter != "" {
		if _, err := tx.Exec(ctx, `UPDATE restaurant_leads SET status = $2, updated_at = $3 WHERE id = $1`, leadID, activity.StatusAfter, now); err != nil {
			return LeadActivity{}, translatePostgresError(err)
		}
	}
	if activity.Type != LeadActivityNote {
		if _, err := tx.Exec(ctx, `UPDATE restaurant_leads SET last_contact_at = $2, updated_at = $2 WHERE id = $1`, leadID, now.Format(time.RFC3339)); err != nil {
			return LeadActivity{}, translatePostgresError(err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return LeadActivity{}, fmt.Errorf("confirmar registro de atividade: %w", err)
	}
	return created, nil
}

func taskSelectQuery() string {
	return `
SELECT id, project_id, title, description, status, priority,
       COALESCE(assignee_id, ''), COALESCE(due_date, ''), created_by, created_at, updated_at
FROM tasks`
}

func (s *PostgresStore) CreateTask(projectID, creatorID, title, description, status, priority, assigneeID, dueDate string) (Task, error) {
	if _, err := s.projectOwner(projectID); err != nil {
		return Task{}, err
	}
	if !s.projectMemberExists(projectID, creatorID) {
		return Task{}, ErrNotMember
	}
	role, err := s.projectMemberRole(projectID, creatorID)
	if err != nil {
		return Task{}, err
	}
	if role == MemberRoleViewer {
		return Task{}, ErrReadOnly
	}
	if assigneeID != "" && !s.projectMemberExists(projectID, assigneeID) {
		return Task{}, ErrNotMember
	}
	now := time.Now().UTC()
	query := `
INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, due_date, created_by, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id, project_id, title, description, status, priority, COALESCE(assignee_id, ''), COALESCE(due_date, ''), created_by, created_at, updated_at`
	return scanTask(s.pool.QueryRow(context.Background(), query, newID(), projectID, title, description, status, priority, nullableString(assigneeID), dueDate, creatorID, now, now))
}

func (s *PostgresStore) TasksByProject(projectID string) []Task {
	rows, err := s.pool.Query(context.Background(), taskSelectQuery()+` WHERE project_id = $1 ORDER BY created_at`, projectID)
	if err != nil {
		return []Task{}
	}
	defer rows.Close()
	tasks := make([]Task, 0)
	for rows.Next() {
		task, scanErr := scanTask(rows)
		if scanErr == nil {
			tasks = append(tasks, task)
		}
	}
	return tasks
}

func (s *PostgresStore) TaskCountByProject(projectID string) int {
	var count int
	if err := s.pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM tasks WHERE project_id = $1`, projectID).Scan(&count); err != nil {
		return 0
	}
	return count
}

func (s *PostgresStore) TaskByID(id string) (Task, error) {
	return scanTask(s.pool.QueryRow(context.Background(), taskSelectQuery()+` WHERE id = $1`, id))
}

func (s *PostgresStore) UpdateTask(id, actorID, title, description, status, priority, assigneeID, dueDate string) (Task, error) {
	var projectID string
	if err := s.pool.QueryRow(context.Background(), `SELECT project_id FROM tasks WHERE id = $1`, id).Scan(&projectID); err != nil {
		return Task{}, translatePostgresError(err)
	}
	if !s.projectMemberExists(projectID, actorID) {
		return Task{}, ErrNotMember
	}
	role, err := s.projectMemberRole(projectID, actorID)
	if err != nil {
		return Task{}, err
	}
	if role == MemberRoleViewer {
		return Task{}, ErrReadOnly
	}
	if assigneeID != "" && !s.projectMemberExists(projectID, assigneeID) {
		return Task{}, ErrNotMember
	}
	query := `
UPDATE tasks
SET title = CASE WHEN $2 <> '' THEN $2 ELSE title END,
    description = $3, status = $4, priority = $5, assignee_id = $6, due_date = $7, updated_at = $8
WHERE id = $1
RETURNING id, project_id, title, description, status, priority, COALESCE(assignee_id, ''), COALESCE(due_date, ''), created_by, created_at, updated_at`
	return scanTask(s.pool.QueryRow(context.Background(), query, id, title, description, status, priority, nullableString(assigneeID), dueDate, time.Now().UTC()))
}

func (s *PostgresStore) DeleteTask(id, actorID string) error {
	var projectID string
	if err := s.pool.QueryRow(context.Background(), `SELECT project_id FROM tasks WHERE id = $1`, id).Scan(&projectID); err != nil {
		return translatePostgresError(err)
	}
	if !s.projectMemberExists(projectID, actorID) {
		return ErrNotMember
	}
	role, err := s.projectMemberRole(projectID, actorID)
	if err != nil {
		return err
	}
	if role == MemberRoleViewer {
		return ErrReadOnly
	}
	_, err = s.pool.Exec(context.Background(), `DELETE FROM tasks WHERE id = $1`, id)
	return translatePostgresError(err)
}
