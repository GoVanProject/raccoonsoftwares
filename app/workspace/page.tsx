"use client";

import Link from "next/link";
import { type ChangeEvent, type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { taskboardFetch } from "../lib/taskboard";
import { WorkspaceAvatarStack, WorkspaceIcon, WorkspaceRail } from "./components/workspace-ui";

type Status = "backlog" | "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";
type Project = { id: string; name: string; description: string; image_data?: string; owner_id: string; task_count: number };
type Task = { id: string; title: string; description: string; status: Status; priority: Priority; assignee_id?: string; due_date?: string };
type MemberRole = "owner" | "editor" | "viewer";
type Member = { id: string; alias?: string; email: string; avatar_data?: string; role: MemberRole; created_at?: string };

const memberRoleLabels: Record<MemberRole, string> = {
  owner: "Proprietário",
  editor: "Editor",
  viewer: "Visualizador",
};

const MAX_PROJECT_IMAGE_BYTES = 512 * 1024;
const imageTypes = ["image/png", "image/jpeg", "image/webp"];

const columns: { status: Status; label: string; tone: string }[] = [
  { status: "backlog", label: "Backlog", tone: "backlog" },
  { status: "todo", label: "A fazer", tone: "todo" },
  { status: "in_progress", label: "Em andamento", tone: "progress" },
  { status: "done", label: "Concluído", tone: "done" },
];

function MarkdownPreview({ value, emptyText = "Sem descrição" }: { value: string; emptyText?: string }) {
  if (!value.trim()) return <span className="markdown-empty">{emptyText}</span>;
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{value}</ReactMarkdown>;
}

export default function WorkspacePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [currentUserID, setCurrentUserID] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectPanelOpen, setProjectPanelOpen] = useState(false);
  const [activeView, setActiveView] = useState<"board" | "team">("board");
  const [railExpanded, setRailExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectImage, setProjectImage] = useState("");
  const [projectImageName, setProjectImageName] = useState("");
  const projectImageInput = useRef<HTMLInputElement>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDescription, setEditProjectDescription] = useState("");
  const [editProjectImage, setEditProjectImage] = useState("");
  const [editProjectImageName, setEditProjectImageName] = useState("");
  const editProjectImageInput = useRef<HTMLInputElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<Status>("backlog");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskStatus, setEditTaskStatus] = useState<Status>("backlog");
  const [editTaskPriority, setEditTaskPriority] = useState<Priority>("medium");
  const [editTaskAssignee, setEditTaskAssignee] = useState("");
  const [taskModal, setTaskModal] = useState<"create" | "view" | "edit" | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("taskboard_token");
    if (!storedToken) {
      router.replace("/login");
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    taskboardFetch<{ user: { id: string } }>("/api/auth/me", token)
      .then((response) => setCurrentUserID(response.user.id))
      .catch(() => undefined);
    setLoading(true);
    taskboardFetch<{ projects: Project[] }>("/api/projects", token)
      .then((response) => {
        setProjects(response.projects);
        setSelectedProject((current) => response.projects.find((project) => project.id === current?.id) || response.projects[0] || null);
      })
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!projectPanelOpen) return;

    function closePanelOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProjectPanelOpen(false);
      }
    }

    function closePanelOnOutsideClick(event: MouseEvent) {
      if (navigationRef.current && !navigationRef.current.contains(event.target as Node)) {
        setProjectPanelOpen(false);
      }
    }

    document.addEventListener("keydown", closePanelOnEscape);
    document.addEventListener("mousedown", closePanelOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closePanelOnEscape);
      document.removeEventListener("mousedown", closePanelOnOutsideClick);
    };
  }, [projectPanelOpen]);

  useEffect(() => {
    if (!taskModal && !editingProject) return;
    function closeModalOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (taskModal) closeTaskModal();
      if (editingProject) cancelProjectEdit();
    }
    document.addEventListener("keydown", closeModalOnEscape);
    return () => document.removeEventListener("keydown", closeModalOnEscape);
  }, [taskModal, editingProject]);

  useEffect(() => {
    if (!token || !selectedProject) {
      setTasks([]);
      setMembers([]);
      return;
    }
    Promise.all([
      taskboardFetch<{ tasks: Task[] }>(`/api/projects/${selectedProject.id}/tasks`, token),
      taskboardFetch<{ members: Member[] }>(`/api/projects/${selectedProject.id}/members`, token),
    ])
      .then(([taskResponse, memberResponse]) => {
        setTasks(taskResponse.tasks);
        setMembers(memberResponse.members);
      })
      .catch(handleError);
  }, [token, selectedProject?.id]);

  const groupedTasks = useMemo(() => Object.fromEntries(columns.map((column) => [column.status, tasks.filter((task) => task.status === column.status)])) as Record<Status, Task[]>, [tasks]);
  const isReadOnly = members.find((member) => member.id === currentUserID)?.role === "viewer";

  function handleError(reason: unknown) {
    if (reason instanceof Error && reason.message.includes("token")) {
      window.localStorage.removeItem("taskboard_token");
      router.replace("/login");
      return;
    }
    setError(reason instanceof Error ? reason.message : "Não foi possível carregar os dados.");
  }

  function handleProjectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!imageTypes.includes(file.type)) {
      setError("Escolha uma imagem PNG, JPEG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PROJECT_IMAGE_BYTES) {
      setError("A imagem deve ter até 512 KB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProjectImage(reader.result);
        setProjectImageName(file.name);
        setError("");
      }
    };
    reader.onerror = () => setError("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  }

  function handleEditProjectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!imageTypes.includes(file.type)) {
      setError("Escolha uma imagem PNG, JPEG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PROJECT_IMAGE_BYTES) {
      setError("A imagem deve ter até 512 KB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEditProjectImage(reader.result);
        setEditProjectImageName(file.name);
        setError("");
      }
    };
    reader.onerror = () => setError("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !projectName.trim()) return;
    try {
      const response = await taskboardFetch<{ project: Project }>("/api/projects", token, {
        method: "POST",
        body: JSON.stringify({ name: projectName, description: projectDescription, image_data: projectImage || undefined }),
      });
      setProjects((current) => [response.project, ...current]);
      setSelectedProject(response.project);
      setProjectName("");
      setProjectDescription("");
      setProjectImage("");
      setProjectImageName("");
      setEditingProject(false);
      setProjectPanelOpen(false);
      setActiveView("board");
      event.currentTarget.reset();
    } catch (reason) { handleError(reason); }
  }

  function startProjectEdit() {
    if (!selectedProject) return;
    setEditProjectName(selectedProject.name);
    setEditProjectDescription(selectedProject.description);
    setEditProjectImage(selectedProject.image_data || "");
    setEditProjectImageName(selectedProject.image_data ? "Imagem atual" : "");
    setEditingProject(true);
  }

  function cancelProjectEdit() {
    setEditingProject(false);
    setEditProjectImage("");
    setEditProjectImageName("");
    if (editProjectImageInput.current) editProjectImageInput.current.value = "";
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProject || !editProjectName.trim()) return;
    try {
      const response = await taskboardFetch<{ project: Project }>(`/api/projects/${selectedProject.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ name: editProjectName, description: editProjectDescription, image_data: editProjectImage }),
      });
      setProjects((current) => current.map((project) => project.id === response.project.id ? response.project : project));
      setSelectedProject(response.project);
      cancelProjectEdit();
    } catch (reason) { handleError(reason); }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProject || !taskTitle.trim()) return;
    try {
      const response = await taskboardFetch<{ task: Task }>(`/api/projects/${selectedProject.id}/tasks`, token, {
        method: "POST",
        body: JSON.stringify({ title: taskTitle, description: taskDescription, status: taskStatus, priority: taskPriority, assignee_id: taskAssignee || undefined }),
      });
      setTasks((current) => [...current, response.task]);
      setProjects((current) => current.map((project) => project.id === selectedProject.id ? { ...project, task_count: project.task_count + 1 } : project));
      setSelectedProject((current) => current && current.id === selectedProject.id ? { ...current, task_count: current.task_count + 1 } : current);
      setTaskTitle("");
      setTaskDescription("");
      setTaskStatus("backlog");
      setTaskAssignee("");
      setTaskModal(null);
      setViewingTask(null);
    } catch (reason) { handleError(reason); }
  }

  async function updateTask(task: Task, changes: Partial<Task>) {
    if (!token) return;
    try {
      const response = await taskboardFetch<{ task: Task }>(`/api/tasks/${task.id}`, token, { method: "PATCH", body: JSON.stringify(changes) });
      setTasks((current) => current.map((item) => item.id === task.id ? response.task : item));
    } catch (reason) { handleError(reason); }
  }

  function handleTaskDragStart(event: DragEvent<HTMLElement>, task: Task) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    setDraggedTaskId(task.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  }

  function handleTaskDragEnd() {
    setDraggedTaskId(null);
    setDragOverStatus(null);
  }

  function handleColumnDragOver(event: DragEvent<HTMLElement>, status: Status) {
    if (isReadOnly || !draggedTaskId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  }

  function handleColumnDragLeave(event: DragEvent<HTMLElement>, status: Status) {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
    setDragOverStatus((current) => current === status ? null : current);
  }

  async function moveTaskToStatus(task: Task, status: Status) {
    if (!token || isReadOnly || task.status === status) return;
    const previousStatus = task.status;
    setMovingTaskId(task.id);
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    try {
      const response = await taskboardFetch<{ task: Task }>(`/api/tasks/${task.id}`, token, { method: "PATCH", body: JSON.stringify({ status }) });
      setTasks((current) => current.map((item) => item.id === task.id ? response.task : item));
    } catch (reason) {
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: previousStatus } : item));
      handleError(reason);
    } finally {
      setMovingTaskId(null);
    }
  }

  function handleColumnDrop(event: DragEvent<HTMLElement>, status: Status) {
    event.preventDefault();
    if (isReadOnly) return;
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const task = tasks.find((item) => item.id === taskId);
    setDraggedTaskId(null);
    setDragOverStatus(null);
    if (task) void moveTaskToStatus(task, status);
  }

  function startTaskEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description);
    setEditTaskStatus(task.status);
    setEditTaskPriority(task.priority);
    setEditTaskAssignee(task.assignee_id || "");
    setViewingTask(task);
    setTaskModal("edit");
  }

  function cancelTaskEdit() {
    setEditingTaskId(null);
    setEditTaskTitle("");
    setEditTaskDescription("");
    setTaskModal(null);
    setViewingTask(null);
  }

  function openTaskCreate() {
    setTaskTitle("");
    setTaskDescription("");
    setTaskStatus("backlog");
    setTaskPriority("medium");
    setTaskAssignee("");
    setTaskModal("create");
  }

  function openTaskView(task: Task) {
    setViewingTask(task);
    setTaskModal("view");
  }

  function closeTaskModal() {
    setTaskModal(null);
    setViewingTask(null);
    setEditingTaskId(null);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault();
    if (!token || !editTaskTitle.trim()) return;
    try {
      const response = await taskboardFetch<{ task: Task }>(`/api/tasks/${task.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ title: editTaskTitle, description: editTaskDescription, status: editTaskStatus, priority: editTaskPriority, assignee_id: editTaskAssignee }),
      });
      setTasks((current) => current.map((item) => item.id === task.id ? response.task : item));
      cancelTaskEdit();
    } catch (reason) { handleError(reason); }
  }

  function selectProject(project: Project) {
    setSelectedProject(project);
    setEditingProject(false);
    setEditingTaskId(null);
    setProjectPanelOpen(false);
    setActiveView("board");
    closeTaskModal();
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProject || !memberEmail.trim()) return;
    try {
      await taskboardFetch(`/api/projects/${selectedProject.id}/members`, token, { method: "POST", body: JSON.stringify({ email: memberEmail }) });
      const response = await taskboardFetch<{ members: Member[] }>(`/api/projects/${selectedProject.id}/members`, token);
      setMembers(response.members);
      setMemberEmail("");
    } catch (reason) { handleError(reason); }
  }

  async function updateMemberRole(member: Member, role: MemberRole) {
    if (!token || !selectedProject || member.role === role) return;
    try {
      const response = await taskboardFetch<{ members: Member[] }>(`/api/projects/${selectedProject.id}/members/${member.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMembers(response.members);
    } catch (reason) { handleError(reason); }
  }

  async function removeMember(member: Member) {
    if (!token || !selectedProject || member.role === "owner") return;
    try {
      await taskboardFetch(`/api/projects/${selectedProject.id}/members/${member.id}`, token, { method: "DELETE" });
      setMembers((current) => current.filter((item) => item.id !== member.id));
    } catch (reason) { handleError(reason); }
  }

  function logout() {
    window.localStorage.removeItem("taskboard_token");
    router.push("/login");
  }

  function openTeamView() {
    setProjectPanelOpen(false);
    setActiveView("team");
    window.setTimeout(() => document.getElementById("workspace-member-email")?.focus(), 0);
  }

  return (
    <main className="workspace-page">
      <div className="workspace-layout">
        <div className={`workspace-navigation-shell ${railExpanded ? "is-rail-expanded" : ""}`} ref={navigationRef}>
          <WorkspaceRail
            mode="workspace"
            projectId={selectedProject?.id}
            expanded={railExpanded}
            onToggleExpanded={() => setRailExpanded((current) => !current)}
            projectPanelOpen={projectPanelOpen}
            onToggleProjects={() => { setActiveView("board"); setProjectPanelOpen((current) => !current); }}
            onTeamClick={openTeamView}
            onLogout={logout}
          />
          {projectPanelOpen ? <aside className="workspace-project-panel" aria-label="Projetos">
            <div className="workspace-panel-header">
              <div><span className="workspace-kicker">Workspace</span><h2>Projetos</h2></div>
              <button className="workspace-panel-close" type="button" onClick={() => setProjectPanelOpen(false)} aria-label="Fechar painel de projetos" title="Fechar painel"><WorkspaceIcon name="close" /></button>
            </div>
            <div className="workspace-section-label">Projetos <span>{projects.length}</span></div>
            <div className="project-list">
              {loading ? <>{[1, 2, 3].map((item) => <div className="workspace-skeleton project-skeleton" key={item} />)}</> : null}
              {projects.map((project) => <button className={`project-select ${selectedProject?.id === project.id ? "active" : ""}`} key={project.id} type="button" onClick={() => selectProject(project)}><span>{project.name}</span><small>{project.task_count} tarefas</small><WorkspaceIcon name="chevron" /></button>)}
              {!projects.length && !loading ? <p className="empty-note">Crie seu primeiro projeto para começar a organizar tarefas e equipe.</p> : null}
            </div>
            <form className="new-project-form" onSubmit={createProject}>
              <div className="form-section-heading"><strong>Novo projeto</strong><span>Descrição e capa opcionais</span></div>
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Nome do projeto" aria-label="Nome do novo projeto" />
              <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="Descrição em Markdown (opcional)" aria-label="Descrição do novo projeto" rows={4} />
              <label className="image-picker">
                <span>🖼️ {projectImageName || "Anexar imagem"}</span>
                <small>PNG, JPEG ou WebP · até 512 KB</small>
                <input ref={projectImageInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProjectImage} aria-label="Imagem do projeto" />
              </label>
              {projectImage ? <div className="image-preview"><img src={projectImage} alt="Prévia da capa do projeto" /><button type="button" onClick={() => { setProjectImage(""); setProjectImageName(""); if (projectImageInput.current) projectImageInput.current.value = ""; }}>Remover</button></div> : null}
              <button className="new-project-submit" type="submit"><WorkspaceIcon name="plus" />Criar projeto</button>
            </form>
          </aside> : null}
        </div>
        <section className="workspace-main">
          {error ? <div className="workspace-error" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div> : null}
          {loading ? <div className="workspace-loading" aria-busy="true" aria-label="Carregando workspace">
            <div className="workspace-loading-heading"><div className="workspace-skeleton workspace-skeleton-icon" /><div><div className="workspace-skeleton workspace-skeleton-kicker" /><div className="workspace-skeleton workspace-skeleton-title" /><div className="workspace-skeleton workspace-skeleton-copy" /></div></div>
            <div className="workspace-loading-toolbar"><div className="workspace-skeleton" /><div className="workspace-skeleton" /></div>
            <div className="workspace-loading-board">{[1, 2, 3, 4].map((item) => <div className="workspace-skeleton workspace-skeleton-column" key={item} />)}</div>
          </div> : selectedProject ? <>
            {activeView === "team" ? <div className="workspace-team-view">
              <header className="workspace-view-header">
                <div className="workspace-view-heading">
                  <span className="workspace-kicker">Projeto ativo</span>
                  <h1>Equipe</h1>
                  <p>Gerencie as pessoas que colaboram em <strong>{selectedProject.name}</strong>.</p>
                </div>
                <div className="workspace-view-actions">
                  <button className="workspace-secondary-action" type="button" onClick={() => setActiveView("board")}><WorkspaceIcon name="board" />Voltar ao quadro</button>
                </div>
              </header>
              <div className="workspace-team-summary"><WorkspaceIcon name="users" /><div><strong>{members.length} {members.length === 1 ? "pessoa" : "pessoas"}</strong><span>Convide integrantes e defina o nível de acesso de cada um.</span></div></div>
              <section className="workspace-team-card" aria-labelledby="workspace-team-members-title">
                <div className="workspace-team-card-header"><div><span className="workspace-kicker">Acesso do projeto</span><h2 id="workspace-team-members-title">Membros</h2></div><span className="workspace-team-count">{members.length}</span></div>
                <div className="workspace-member-list">
                  {members.map((member) => {
                    const canManage = currentUserID === selectedProject.owner_id;
                    return <article className="workspace-member-row" key={member.id}>
                      <span className="workspace-member-avatar">{member.avatar_data ? <img src={member.avatar_data} alt="" /> : (member.alias || member.email).slice(0, 2).toUpperCase()}</span>
                      <div className="workspace-member-identity"><strong>{member.alias || member.email}</strong><small>{member.alias ? member.email : member.id === selectedProject.owner_id ? "Proprietário do projeto" : "Membro do projeto"}</small></div>
                      <select value={member.role || (member.id === selectedProject.owner_id ? "owner" : "editor")} disabled={member.id === selectedProject.owner_id || !canManage} onChange={(event) => void updateMemberRole(member, event.target.value as MemberRole)} aria-label={`Permissão de ${member.email}`}>
                        <option value="owner">{memberRoleLabels.owner}</option>
                        <option value="editor">{memberRoleLabels.editor}</option>
                        <option value="viewer">{memberRoleLabels.viewer}</option>
                      </select>
                      {member.id !== selectedProject.owner_id ? <button className="workspace-member-remove" type="button" onClick={() => void removeMember(member)} disabled={!canManage} aria-label={`Remover ${member.email}`} title="Remover membro">×</button> : null}
                    </article>;
                  })}
                </div>
              </section>
              <form className="workspace-member-form workspace-member-form-card" onSubmit={addMember}>
                <div><span className="workspace-kicker">Adicionar integrante</span><h2>Convide alguém para o projeto</h2><p>A pessoa precisa ter uma conta cadastrada para receber acesso.</p></div>
                <div className="member-form"><input id="workspace-member-email" type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="email@equipe.com" aria-label="Email do integrante" disabled={currentUserID !== selectedProject.owner_id} /><button type="submit" disabled={currentUserID !== selectedProject.owner_id}><WorkspaceIcon name="plus" /><span>Adicionar</span></button></div>
              </form>
            </div> : <>
            <div className="workspace-title">
              <div className="project-heading">
                {selectedProject.image_data ? <img className="project-heading-image" src={selectedProject.image_data} alt="" /> : <span className="project-heading-placeholder">✦</span>}
                <div><span className="workspace-kicker">Projeto ativo</span><h1>{selectedProject.name}</h1><div className="project-description"><MarkdownPreview value={selectedProject.description} emptyText="Organize as próximas entregas da equipe." /></div></div>
                <div className="project-heading-actions"><Link className="room-link" href={`/workspace/${selectedProject.id}/room`}>Sala ao vivo</Link><button className="edit-trigger" type="button" onClick={startProjectEdit}>Editar projeto</button></div>
              </div>
              <div className="member-stack"><WorkspaceAvatarStack members={members} label={`${members.length} integrante${members.length === 1 ? "" : "s"} no projeto`} /><b>{members.length} {members.length === 1 ? "integrante" : "integrantes"}</b></div>
            </div>
            <div className="workspace-toolbar">
              <div className="workspace-toolbar-copy"><span className="workspace-kicker">Quadro de tarefas</span><strong>{tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"} no projeto</strong><span>Organize o trabalho da equipe por etapa. Arraste as tarefas para mover.</span></div>
              <div className="workspace-toolbar-actions"><button className="workspace-primary-action" type="button" onClick={openTaskCreate} disabled={isReadOnly} title={isReadOnly ? "Seu acesso permite apenas visualização" : "Adicionar nova tarefa"}><WorkspaceIcon name="plus" />Nova tarefa</button><button className="workspace-secondary-action" type="button" onClick={openTeamView}><WorkspaceIcon name="users" />Equipe</button></div>
            </div>
            <div className="kanban-grid">
              {columns.map((column) => <section className={`kanban-column ${dragOverStatus === column.status ? "is-drag-over" : ""}`} key={column.status} onDragOver={(event) => handleColumnDragOver(event, column.status)} onDragLeave={(event) => handleColumnDragLeave(event, column.status)} onDrop={(event) => handleColumnDrop(event, column.status)}>
                <div className="column-heading"><span className={`column-dot ${column.tone}`} /><h2>{column.label}</h2><b>{groupedTasks[column.status].length}</b></div>
                <div className="task-stack">
                  {groupedTasks[column.status].map((task) => <article className={`kanban-card ${draggedTaskId === task.id ? "is-dragging" : ""} ${movingTaskId === task.id ? "is-moving" : ""}`} key={task.id} tabIndex={0} role="button" draggable={!isReadOnly} aria-grabbed={draggedTaskId === task.id} aria-label={`Visualizar tarefa ${task.title}${isReadOnly ? "" : ". Arraste para mover de etapa"}`} onDragStart={(event) => handleTaskDragStart(event, task)} onDragEnd={handleTaskDragEnd} onClick={() => openTaskView(task)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openTaskView(task); } }}>
                    <div className="task-card-top"><span className={`priority ${task.priority}`}>{task.priority === "high" ? "Alta" : task.priority === "low" ? "Baixa" : "Média"}</span><div className="task-card-actions" onClick={(event) => event.stopPropagation()}><select value={task.status} onChange={(event) => void updateTask(task, { status: event.target.value as Status })} aria-label={`Status de ${task.title}`} disabled={isReadOnly}><option value="backlog">Backlog</option><option value="todo">A fazer</option><option value="in_progress">Em andamento</option><option value="done">Concluído</option></select><button className="task-edit-trigger" type="button" onClick={() => startTaskEdit(task)} disabled={isReadOnly}>Editar</button></div></div>
                    <h3>{task.title}</h3>{task.description ? <MarkdownPreview value={task.description} /> : <p className="task-card-placeholder">Sem descrição adicionada.</p>}
                    <div className="task-card-footer" onClick={(event) => event.stopPropagation()}><select value={task.assignee_id || ""} onChange={(event) => void updateTask(task, { assignee_id: event.target.value })} aria-label={`Responsável por ${task.title}`} disabled={isReadOnly}><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{member.alias || member.email}</option>)}</select><span>{task.assignee_id ? (members.find((member) => member.id === task.assignee_id)?.alias || members.find((member) => member.id === task.assignee_id)?.email)?.slice(0, 1).toUpperCase() || "?" : "·"}</span></div>
                  </article>)}
                  {!groupedTasks[column.status].length ? <div className="column-empty">Nenhuma tarefa aqui</div> : null}
                </div>
              </section>)}
            </div>
            </>}
          </> : <div className="workspace-empty"><span>✦</span><h1>Seu quadro começa aqui.</h1><p>Crie um projeto na lateral para organizar tarefas e convidar a equipe.</p></div>}
        </section>
      </div>
      {editingProject && selectedProject ? <div className="workspace-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) cancelProjectEdit(); }}>
        <section className="workspace-modal project-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-project-modal-title">
          <div className="workspace-modal-header"><div><span className="workspace-kicker">Projeto ativo</span><h2 id="workspace-project-modal-title">Editar projeto</h2></div><button className="workspace-panel-close" type="button" onClick={cancelProjectEdit} aria-label="Fechar janela" title="Fechar"><WorkspaceIcon name="close" /></button></div>
          <form className="task-modal-form" onSubmit={saveProject}>
            <label>Nome do projeto<input value={editProjectName} onChange={(event) => setEditProjectName(event.target.value)} aria-label="Nome do projeto" autoFocus required /></label>
            <label>Descrição<textarea value={editProjectDescription} onChange={(event) => setEditProjectDescription(event.target.value)} placeholder="Descreva o objetivo do projeto em Markdown" aria-label="Descrição do projeto" rows={5} /></label>
            <label className="image-picker project-modal-image-picker"><span>🖼️ {editProjectImageName || "Alterar imagem"}</span><small>PNG, JPEG ou WebP · até 512 KB</small><input ref={editProjectImageInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleEditProjectImage} aria-label="Alterar imagem do projeto" /></label>
            {editProjectImage ? <div className="image-preview"><img src={editProjectImage} alt="Prévia da nova capa do projeto" /><button type="button" onClick={() => { setEditProjectImage(""); setEditProjectImageName(""); if (editProjectImageInput.current) editProjectImageInput.current.value = ""; }}>Remover imagem</button></div> : null}
            <div className="workspace-modal-actions"><button className="edit-cancel-button" type="button" onClick={cancelProjectEdit}>Cancelar</button><button className="edit-save-button" type="submit">Salvar projeto</button></div>
          </form>
        </section>
      </div> : null}
      {taskModal ? <div className="workspace-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeTaskModal(); }}>
        <section className="workspace-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-task-modal-title">
          <div className="workspace-modal-header"><div><span className="workspace-kicker">{taskModal === "create" ? "Nova tarefa" : taskModal === "edit" ? "Editar tarefa" : "Detalhes da tarefa"}</span><h2 id="workspace-task-modal-title">{taskModal === "create" ? "Adicionar tarefa" : taskModal === "edit" ? "Atualizar tarefa" : viewingTask?.title}</h2></div><button className="workspace-panel-close" type="button" onClick={closeTaskModal} aria-label="Fechar janela" title="Fechar"><WorkspaceIcon name="close" /></button></div>
          {taskModal === "view" && viewingTask ? <div className="task-modal-detail">
            <div className="task-modal-badges"><span className={`priority ${viewingTask.priority}`}>{viewingTask.priority === "high" ? "Alta prioridade" : viewingTask.priority === "low" ? "Baixa prioridade" : "Prioridade média"}</span><span className="task-modal-status">{columns.find((column) => column.status === viewingTask.status)?.label}</span></div>
            <div className="task-modal-description"><MarkdownPreview value={viewingTask.description} emptyText="Esta tarefa ainda não tem descrição." /></div>
            <div className="task-modal-meta"><span>Responsável</span><strong>{viewingTask.assignee_id ? members.find((member) => member.id === viewingTask.assignee_id)?.email || "Membro removido" : "Sem responsável"}</strong></div>
            <div className="workspace-modal-actions"><button className="edit-cancel-button" type="button" onClick={closeTaskModal}>Fechar</button>{!isReadOnly ? <button className="edit-save-button" type="button" onClick={() => startTaskEdit(viewingTask)}>Editar tarefa</button> : null}</div>
          </div> : null}
          {taskModal === "create" ? <form className="task-modal-form" onSubmit={createTask}>
            <label>Título<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Ex.: Revisar fluxo de onboarding" aria-label="Título da tarefa" autoFocus required /></label>
            <label>Descrição<textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Descreva o que precisa ser feito em Markdown" aria-label="Descrição da tarefa" rows={5} /></label>
            <div className="task-modal-fields"><label>Status<select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value as Status)}><option value="backlog">Backlog</option><option value="todo">A fazer</option><option value="in_progress">Em andamento</option><option value="done">Concluído</option></select></label><label>Prioridade<select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Priority)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label><label>Responsável<select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)}><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{member.alias || member.email}</option>)}</select></label></div>
            <div className="workspace-modal-actions"><button className="edit-cancel-button" type="button" onClick={closeTaskModal}>Cancelar</button><button className="edit-save-button" type="submit">Criar tarefa</button></div>
          </form> : null}
          {taskModal === "edit" && viewingTask ? <form className="task-modal-form" onSubmit={(event) => void saveTask(event, viewingTask)}>
            <label>Título<input value={editTaskTitle} onChange={(event) => setEditTaskTitle(event.target.value)} aria-label="Título da tarefa" autoFocus required /></label>
            <label>Descrição<textarea value={editTaskDescription} onChange={(event) => setEditTaskDescription(event.target.value)} placeholder="Descrição em Markdown" aria-label="Descrição da tarefa" rows={5} /></label>
            <div className="task-modal-fields"><label>Status<select value={editTaskStatus} onChange={(event) => setEditTaskStatus(event.target.value as Status)}><option value="backlog">Backlog</option><option value="todo">A fazer</option><option value="in_progress">Em andamento</option><option value="done">Concluído</option></select></label><label>Prioridade<select value={editTaskPriority} onChange={(event) => setEditTaskPriority(event.target.value as Priority)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label><label>Responsável<select value={editTaskAssignee} onChange={(event) => setEditTaskAssignee(event.target.value)}><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{member.alias || member.email}</option>)}</select></label></div>
            <div className="workspace-modal-actions"><button className="edit-cancel-button" type="button" onClick={closeTaskModal}>Cancelar</button><button className="edit-save-button" type="submit">Salvar alterações</button></div>
          </form> : null}
        </section>
      </div> : null}
    </main>
  );
}
