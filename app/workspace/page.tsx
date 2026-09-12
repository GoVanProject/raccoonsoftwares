"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { taskboardFetch } from "../lib/taskboard";

type Status = "todo" | "in_progress" | "done";
type Project = { id: string; name: string; description: string; owner_id: string; task_count: number };
type Task = { id: string; title: string; description: string; status: Status; priority: "low" | "medium" | "high"; assignee_id?: string; due_date?: string };
type Member = { id: string; email: string };

const columns: { status: Status; label: string; tone: string }[] = [
  { status: "todo", label: "A fazer", tone: "todo" },
  { status: "in_progress", label: "Em andamento", tone: "progress" },
  { status: "done", label: "Concluído", tone: "done" },
];

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
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("medium");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

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

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !projectName.trim()) return;
    try {
      const response = await taskboardFetch<{ project: Project }>("/api/projects", token, { method: "POST", body: JSON.stringify({ name: projectName }) });
      setProjects((current) => [response.project, ...current]);
      setSelectedProject(response.project);
      setProjectName("");
    } catch (reason) { handleError(reason); }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProject || !taskTitle.trim()) return;
    try {
      const response = await taskboardFetch<{ task: Task }>(`/api/projects/${selectedProject.id}/tasks`, token, { method: "POST", body: JSON.stringify({ title: taskTitle, priority: taskPriority, assignee_id: taskAssignee || undefined }) });
      setTasks((current) => [...current, response.task]);
      setTaskTitle("");
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
            {projects.map((project) => <button className={`project-select ${selectedProject?.id === project.id ? "active" : ""}`} key={project.id} type="button" onClick={() => setSelectedProject(project)}><span>{project.name}</span><small>{project.task_count} tarefas</small></button>)}
            {!projects.length && !loading ? <p className="empty-note">Crie seu primeiro projeto.</p> : null}
          </div>
          <form className="new-project-form" onSubmit={createProject}><input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Nome do projeto" aria-label="Nome do novo projeto" /><button type="submit">+</button></form>
        </aside>
        <section className="workspace-main">
          {error ? <div className="workspace-error" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div> : null}
          {selectedProject ? <>
            <div className="workspace-title"><div><span className="workspace-kicker">Projeto ativo</span><h1>{selectedProject.name}</h1><p>{selectedProject.description || "Organize as próximas entregas da equipe."}</p></div><div className="member-stack">{members.slice(0, 4).map((member) => <span key={member.id} title={member.email}>{member.email.slice(0, 1).toUpperCase()}</span>)}<b>{members.length} {members.length === 1 ? "integrante" : "integrantes"}</b></div></div>
            <div className="workspace-toolbar"><form className="new-task-form" onSubmit={createTask}><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Adicionar uma tarefa..." aria-label="Título da tarefa" /><select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Task["priority"])} aria-label="Prioridade"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select><select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)} aria-label="Responsável"><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{member.email}</option>)}</select><button type="submit">Adicionar tarefa</button></form><form className="member-form" onSubmit={addMember}><input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="Email do integrante" aria-label="Email do integrante" /><button type="submit">+ equipe</button></form></div>
            <div className="kanban-grid">{columns.map((column) => <section className="kanban-column" key={column.status}><div className="column-heading"><span className={`column-dot ${column.tone}`} /><h2>{column.label}</h2><b>{groupedTasks[column.status].length}</b></div><div className="task-stack">{groupedTasks[column.status].map((task) => <article className="kanban-card" key={task.id}><div className="task-card-top"><span className={`priority ${task.priority}`}>{task.priority === "high" ? "Alta" : task.priority === "low" ? "Baixa" : "Média"}</span><select value={task.status} onChange={(event) => updateTask(task, { status: event.target.value as Status })} aria-label={`Status de ${task.title}`}><option value="todo">A fazer</option><option value="in_progress">Em andamento</option><option value="done">Concluído</option></select></div><h3>{task.title}</h3>{task.description ? <p>{task.description}</p> : null}<div className="task-card-footer"><select value={task.assignee_id || ""} onChange={(event) => updateTask(task, { assignee_id: event.target.value })} aria-label={`Responsável por ${task.title}`}><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{member.email}</option>)}</select><span>{task.assignee_id ? members.find((member) => member.id === task.assignee_id)?.email.slice(0, 1).toUpperCase() || "?" : "·"}</span></div></article>)}{!groupedTasks[column.status].length ? <div className="column-empty">Nenhuma tarefa aqui</div> : null}</div></section>)}</div>
          </> : <div className="workspace-empty"><span>✦</span><h1>Seu quadro começa aqui.</h1><p>Crie um projeto na lateral para organizar tarefas e convidar a equipe.</p></div>}
        </section>
      </div>
    </main>
  );
}
