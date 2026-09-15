"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { taskboardFetch } from "../lib/taskboard";

type Status = "backlog" | "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";
type Project = { id: string; name: string; description: string; image_data?: string; owner_id: string; task_count: number };
type Task = { id: string; title: string; description: string; status: Status; priority: Priority; assignee_id?: string; due_date?: string };
type Member = { id: string; email: string };

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
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
    } catch (reason) { handleError(reason); }
  }

  async function updateTask(task: Task, changes: Partial<Task>) {
    if (!token) return;
    try {
      const response = await taskboardFetch<{ task: Task }>(`/api/tasks/${task.id}`, token, { method: "PATCH", body: JSON.stringify(changes) });
      setTasks((current) => current.map((item) => item.id === task.id ? response.task : item));
    } catch (reason) { handleError(reason); }
  }

  function startTaskEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description);
    setEditTaskStatus(task.status);
    setEditTaskPriority(task.priority);
    setEditTaskAssignee(task.assignee_id || "");
  }

  function cancelTaskEdit() {
    setEditingTaskId(null);
    setEditTaskTitle("");
    setEditTaskDescription("");
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

  function logout() {
    window.localStorage.removeItem("taskboard_token");
    router.push("/login");
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <Link className="auth-brand" href="/">🦝 <span>RaccoonTech</span></Link>
        <div className="workspace-header-actions"><span>Kanban workspace</span><button type="button" onClick={logout}>Sair</button></div>
      </header>
      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <div className="workspace-section-label">Projetos <span>{projects.length}</span></div>
          <div className="project-list">
            {projects.map((project) => <button className={`project-select ${selectedProject?.id === project.id ? "active" : ""}`} key={project.id} type="button" onClick={() => selectProject(project)}><span>{project.name}</span><small>{project.task_count} tarefas</small></button>)}
            {!projects.length && !loading ? <p className="empty-note">Crie seu primeiro projeto.</p> : null}
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
            <button className="new-project-submit" type="submit">Criar projeto</button>
          </form>
        </aside>
        <section className="workspace-main">
          {error ? <div className="workspace-error" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div> : null}
          {selectedProject ? <>
            <div className="workspace-title">
              {editingProject ? <form className="project-edit-form" onSubmit={saveProject}>
                <div className="project-edit-fields"><input value={editProjectName} onChange={(event) => setEditProjectName(event.target.value)} aria-label="Nome do projeto" /><textarea value={editProjectDescription} onChange={(event) => setEditProjectDescription(event.target.value)} placeholder="Descrição do projeto em Markdown" aria-label="Descrição do projeto" rows={4} /></div>
                <label className="image-picker"><span>🖼️ {editProjectImageName || "Alterar imagem"}</span><small>PNG, JPEG ou WebP · até 512 KB</small><input ref={editProjectImageInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleEditProjectImage} aria-label="Alterar imagem do projeto" /></label>
                {editProjectImage ? <div className="image-preview"><img src={editProjectImage} alt="Prévia da nova capa do projeto" /><button type="button" onClick={() => { setEditProjectImage(""); setEditProjectImageName(""); if (editProjectImageInput.current) editProjectImageInput.current.value = ""; }}>Remover imagem</button></div> : null}
                <div className="edit-actions"><button className="edit-save-button" type="submit">Salvar projeto</button><button className="edit-cancel-button" type="button" onClick={cancelProjectEdit}>Cancelar</button></div>
              </form> : <div className="project-heading">
                {selectedProject.image_data ? <img className="project-heading-image" src={selectedProject.image_data} alt="" /> : <span className="project-heading-placeholder">✦</span>}
                <div><span className="workspace-kicker">Projeto ativo</span><h1>{selectedProject.name}</h1><div className="project-description"><MarkdownPreview value={selectedProject.description} emptyText="Organize as próximas entregas da equipe." /></div></div>
                <button className="edit-trigger" type="button" onClick={startProjectEdit}>Editar projeto</button>
              </div>}
              <div className="member-stack">{members.slice(0, 4).map((member) => <span key={member.id} title={member.email}>{member.email.slice(0, 1).toUpperCase()}</span>)}<b>{members.length} {members.length === 1 ? "integrante" : "integrantes"}</b></div>
            </div>
            <div className="workspace-toolbar">
              <form className="new-task-form" onSubmit={createTask}>
                <div className="new-task-fields"><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Adicionar uma tarefa..." aria-label="Título da tarefa" /><select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value as Status)} aria-label="Status inicial"><option value="backlog">Backlog</option><option value="todo">A fazer</option><option value="in_progress">Em andamento</option><option value="done">Concluído</option></select><select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Priority)} aria-label="Prioridade"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select><select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)} aria-label="Responsável"><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{member.email}</option>)}</select></div>
                <textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Descrição da tarefa em Markdown (opcional)" aria-label="Descrição da tarefa" rows={3} />
                <button type="submit">Adicionar tarefa</button>
              </form>
              <form className="member-form" onSubmit={addMember}><input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="Email do integrante" aria-label="Email do integrante" /><button type="submit">+ equipe</button></form>
            </div>
            <div className="kanban-grid">
              {columns.map((column) => <section className="kanban-column" key={column.status}>
                <div className="column-heading"><span className={`column-dot ${column.tone}`} /><h2>{column.label}</h2><b>{groupedTasks[column.status].length}</b></div>
                <div className="task-stack">
                  {groupedTasks[column.status].map((task) => <article className="kanban-card" key={task.id}>
                    {editingTaskId === task.id ? <form className="task-edit-form" onSubmit={(event) => saveTask(event, task)}>
                      <input value={editTaskTitle} onChange={(event) => setEditTaskTitle(event.target.value)} aria-label="Título da tarefa" />
                      <textarea value={editTaskDescription} onChange={(event) => setEditTaskDescription(event.target.value)} placeholder="Descrição em Markdown" aria-label="Descrição da tarefa" rows={5} />
                      <div className="task-edit-selects"><select value={editTaskStatus} onChange={(event) => setEditTaskStatus(event.target.value as Status)} aria-label="Status da tarefa"><option value="backlog">Backlog</option><option value="todo">A fazer</option><option value="in_progress">Em andamento</option><option value="done">Concluído</option></select><select value={editTaskPriority} onChange={(event) => setEditTaskPriority(event.target.value as Priority)} aria-label="Prioridade da tarefa"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></div>
                      <select value={editTaskAssignee} onChange={(event) => setEditTaskAssignee(event.target.value)} aria-label="Responsável pela tarefa"><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{member.email}</option>)}</select>
                      <div className="edit-actions"><button className="edit-save-button" type="submit">Salvar</button><button className="edit-cancel-button" type="button" onClick={cancelTaskEdit}>Cancelar</button></div>
                    </form> : <>
                      <div className="task-card-top"><span className={`priority ${task.priority}`}>{task.priority === "high" ? "Alta" : task.priority === "low" ? "Baixa" : "Média"}</span><div className="task-card-actions"><select value={task.status} onChange={(event) => updateTask(task, { status: event.target.value as Status })} aria-label={`Status de ${task.title}`}><option value="backlog">Backlog</option><option value="todo">A fazer</option><option value="in_progress">Em andamento</option><option value="done">Concluído</option></select><button className="task-edit-trigger" type="button" onClick={() => startTaskEdit(task)}>Editar</button></div></div>
                      <h3>{task.title}</h3>{task.description ? <MarkdownPreview value={task.description} /> : null}
                      <div className="task-card-footer"><select value={task.assignee_id || ""} onChange={(event) => updateTask(task, { assignee_id: event.target.value })} aria-label={`Responsável por ${task.title}`}><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{member.email}</option>)}</select><span>{task.assignee_id ? members.find((member) => member.id === task.assignee_id)?.email.slice(0, 1).toUpperCase() || "?" : "·"}</span></div>
                    </>}
                  </article>)}
                  {!groupedTasks[column.status].length ? <div className="column-empty">Nenhuma tarefa aqui</div> : null}
                </div>
              </section>)}
            </div>
          </> : <div className="workspace-empty"><span>✦</span><h1>Seu quadro começa aqui.</h1><p>Crie um projeto na lateral para organizar tarefas e convidar a equipe.</p></div>}
        </section>
      </div>
    </main>
  );
}
