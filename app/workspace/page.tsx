"use client";

import Link from "next/link";
import Image from "next/image";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MagicCard } from "../../components/ui/magic-card";
import { ShimmerButton } from "../../components/ui/shimmer-button";
import { BlurFade } from "@/components/ui/blur-fade";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { taskboardFetch } from "../lib/taskboard";
import { useTaskboardToken } from "../lib/use-taskboard-token";
import { WorkspaceAvatarStack, WorkspaceIcon } from "./components/workspace-ui";

type Status = "backlog" | "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";
type LabelColor = "blue" | "purple" | "green" | "orange" | "red" | "cyan" | "gray";
type Project = {
  id: string;
  name: string;
  description: string;
  image_data?: string;
  owner_id: string;
  task_count: number;
};
type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignee_id?: string;
  label_ids?: string[];
  due_date?: string;
};
type TaskLabel = {
  id: string;
  project_id: string;
  name: string;
  color: LabelColor;
};
type MemberRole = "owner" | "editor" | "viewer";
type Member = {
  id: string;
  alias?: string;
  email: string;
  avatar_data?: string;
  role: MemberRole;
  created_at?: string;
};

const MAX_PROJECT_IMAGE_BYTES = 512 * 1024;
const imageTypes = ["image/png", "image/jpeg", "image/webp"];
const labelColors: { value: LabelColor; label: string }[] = [
  { value: "blue", label: "Azul" },
  { value: "purple", label: "Roxo" },
  { value: "green", label: "Verde" },
  { value: "orange", label: "Laranja" },
  { value: "red", label: "Vermelho" },
  { value: "cyan", label: "Ciano" },
  { value: "gray", label: "Cinza" },
];

const columns: { status: Status; label: string; tone: string }[] = [
  { status: "backlog", label: "Backlog", tone: "backlog" },
  { status: "todo", label: "A fazer", tone: "todo" },
  { status: "in_progress", label: "Em andamento", tone: "progress" },
  { status: "done", label: "Concluído", tone: "done" },
];

function MarkdownPreview({
  value,
  emptyText = "Sem descrição",
}: {
  value: string;
  emptyText?: string;
}) {
  if (!value.trim()) return <span className="markdown-empty">{emptyText}</span>;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {value}
    </ReactMarkdown>
  );
}

function LabelPills({
  labels,
  labelIDs,
  limit,
}: {
  labels: TaskLabel[];
  labelIDs?: string[];
  limit?: number;
}) {
  const selectedLabels = (labelIDs || [])
    .map((id) => labels.find((label) => label.id === id))
    .filter((label): label is TaskLabel => Boolean(label));
  if (!selectedLabels.length) return null;
  const visibleLabels = limit ? selectedLabels.slice(0, limit) : selectedLabels;
  const remaining = selectedLabels.length - visibleLabels.length;

  return (
    <div className="task-label-list" aria-label="Etiquetas da tarefa">
      {visibleLabels.map((label) => (
        <span className={`task-label-pill is-${label.color}`} key={label.id}>
          {label.name}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="task-label-overflow" title={selectedLabels.slice(visibleLabels.length).map((label) => label.name).join(", ")}>
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}

function LabelSelector({
  labels,
  selectedIDs,
  onChange,
  onCreateLabel,
  disabled = false,
}: {
  labels: TaskLabel[];
  selectedIDs: string[];
  onChange: (ids: string[]) => void;
  onCreateLabel: (name: string, color: LabelColor) => Promise<TaskLabel | null>;
  disabled?: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("blue");
  const [creating, setCreating] = useState(false);

  async function createLabel() {
    const trimmedName = name.trim();
    if (!trimmedName || creating) return;
    setCreating(true);
    const label = await onCreateLabel(trimmedName, color);
    setCreating(false);
    if (label) {
      onChange([...selectedIDs, label.id]);
      setName("");
    }
  }

  if (disabled) {
    return <LabelPills labels={labels} labelIDs={selectedIDs} />;
  }

  return (
    <details className="task-label-selector">
      <summary>
        <span>Etiquetas</span>
        <small>{selectedIDs.length ? `${selectedIDs.length} selecionada${selectedIDs.length === 1 ? "" : "s"}` : "Adicionar"}</small>
      </summary>
      <div className="task-label-menu">
        <div className="task-label-options">
          {labels.map((label) => (
            <label className="task-label-option" key={label.id}>
              <input
                type="checkbox"
                checked={selectedIDs.includes(label.id)}
                onChange={(event) => {
                  onChange(event.target.checked
                    ? [...selectedIDs, label.id]
                    : selectedIDs.filter((id) => id !== label.id));
                }}
              />
              <span className={`task-label-pill is-${label.color}`}>{label.name}</span>
            </label>
          ))}
          {!labels.length ? <span className="task-label-empty">Nenhuma etiqueta criada.</span> : null}
        </div>
        <div className="task-label-create">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void createLabel();
              }
            }}
            maxLength={40}
            placeholder="Nome da etiqueta"
            aria-label="Nome da nova etiqueta"
          />
          <select
            value={color}
            onChange={(event) => setColor(event.target.value as LabelColor)}
            aria-label="Cor da nova etiqueta"
          >
            {labelColors.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => void createLabel()} disabled={!name.trim() || creating}>
            {creating ? "Criando" : "Criar etiqueta"}
          </button>
        </div>
      </div>
    </details>
  );
}

export default function WorkspacePage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId?: string }>();
  const { token, ready, clearToken } = useTaskboardToken();
  const [currentUserID, setCurrentUserID] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [selectedLabelIDs, setSelectedLabelIDs] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectImage, setProjectImage] = useState("");
  const [projectImageName, setProjectImageName] = useState("");
  const projectImageInput = useRef<HTMLInputElement>(null);
  const projectDialogTriggerRef = useRef<HTMLButtonElement>(null);
  const taskDialogTriggerRef = useRef<HTMLButtonElement>(null);
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
  const [taskLabelIDs, setTaskLabelIDs] = useState<string[]>([]);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskStatus, setEditTaskStatus] = useState<Status>("backlog");
  const [editTaskPriority, setEditTaskPriority] = useState<Priority>("medium");
  const [editTaskAssignee, setEditTaskAssignee] = useState("");
  const [editTaskLabelIDs, setEditTaskLabelIDs] = useState<string[]>([]);
  const [taskModal, setTaskModal] = useState<"create" | "view" | "edit" | null>(
    null,
  );
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);

  const selectedProjectID = selectedProject?.id;

  const handleError = useCallback((reason: unknown) => {
    if (reason instanceof Error && reason.message.includes("token")) {
      clearToken();
      router.replace("/login");
      return;
    }
    setError(
      reason instanceof Error
        ? reason.message
        : "Não foi possível carregar os dados.",
    );
  }, [clearToken, router]);

  useEffect(() => {
    if (!ready) return;
    if (!token) router.replace("/login");
  }, [ready, router, token]);

  useEffect(() => {
    if (projectId) return;
    if (
      new URLSearchParams(window.location.search).get("error") ===
      "project-not-found"
    ) {
      setError("Esse projeto não existe ou você não tem mais acesso a ele.");
    }
  }, [projectId]);

  useEffect(() => {
    if (!token) return;
    setSelectedProject(null);
    setTasks([]);
    setMembers([]);
    taskboardFetch<{ user: { id: string } }>("/api/auth/me", token)
      .then((response) => setCurrentUserID(response.user.id))
      .catch(() => undefined);
    setLoading(true);
    taskboardFetch<{ projects: Project[] }>("/api/projects", token)
      .then((response) => {
        setProjects(response.projects);
        if (!projectId) {
          setSelectedProject(null);
          return;
        }
        const project = response.projects.find((item) => item.id === projectId);
        if (!project) {
          router.replace("/workspace?error=project-not-found");
          return;
        }
        setSelectedProject(project);
      })
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [handleError, projectId, router, token]);

  useEffect(() => {
    setSelectedLabelIDs([]);
  }, [selectedProjectID]);

  useEffect(() => {
    if (!token || !selectedProjectID) {
      setTasks([]);
      setLabels([]);
      setMembers([]);
      return;
    }
    Promise.all([
      taskboardFetch<{ tasks: Task[] }>(
        `/api/projects/${selectedProjectID}/tasks`,
        token,
      ),
      taskboardFetch<{ members: Member[] }>(
        `/api/projects/${selectedProjectID}/members`,
        token,
      ),
      taskboardFetch<{ labels?: TaskLabel[] }>(
        `/api/projects/${selectedProjectID}/labels`,
        token,
      ),
    ])
      .then(([taskResponse, memberResponse, labelResponse]) => {
        setTasks(taskResponse.tasks);
        setMembers(memberResponse.members);
        setLabels(labelResponse.labels || []);
      })
      .catch(handleError);
  }, [handleError, selectedProjectID, token]);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => !selectedLabelIDs.length || selectedLabelIDs.some((id) => (task.label_ids || []).includes(id))),
    [selectedLabelIDs, tasks],
  );
  const groupedTasks = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.status,
          filteredTasks.filter((task) => task.status === column.status),
        ]),
      ) as Record<Status, Task[]>,
    [filteredTasks],
  );
  const isReadOnly =
    members.find((member) => member.id === currentUserID)?.role === "viewer";

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
      const response = await taskboardFetch<{ project: Project }>(
        "/api/projects",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            name: projectName,
            description: projectDescription,
            image_data: projectImage || undefined,
          }),
        },
      );
      setProjects((current) => [response.project, ...current]);
      setProjectName("");
      setProjectDescription("");
      setProjectImage("");
      setProjectImageName("");
      event.currentTarget.reset();
      router.push(`/workspace/${response.project.id}`);
    } catch (reason) {
      handleError(reason);
    }
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
      const response = await taskboardFetch<{ project: Project }>(
        `/api/projects/${selectedProject.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: editProjectName,
            description: editProjectDescription,
            image_data: editProjectImage,
          }),
        },
      );
      setProjects((current) =>
        current.map((project) =>
          project.id === response.project.id ? response.project : project,
        ),
      );
      setSelectedProject(response.project);
      cancelProjectEdit();
    } catch (reason) {
      handleError(reason);
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProject || !taskTitle.trim()) return;
    try {
      const response = await taskboardFetch<{ task: Task }>(
        `/api/projects/${selectedProject.id}/tasks`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            title: taskTitle,
            description: taskDescription,
            status: taskStatus,
            priority: taskPriority,
            assignee_id: taskAssignee || undefined,
            label_ids: taskLabelIDs,
          }),
        },
      );
      setTasks((current) => [...current, response.task]);
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? { ...project, task_count: project.task_count + 1 }
            : project,
        ),
      );
      setSelectedProject((current) =>
        current && current.id === selectedProject.id
          ? { ...current, task_count: current.task_count + 1 }
          : current,
      );
      setTaskTitle("");
      setTaskDescription("");
      setTaskStatus("backlog");
      setTaskAssignee("");
      setTaskLabelIDs([]);
      setTaskModal(null);
      setViewingTask(null);
    } catch (reason) {
      handleError(reason);
    }
  }

  async function createLabel(name: string, color: LabelColor): Promise<TaskLabel | null> {
    if (!token || !selectedProject) return null;
    try {
      const response = await taskboardFetch<{ label: TaskLabel }>(
        `/api/projects/${selectedProject.id}/labels`,
        token,
        { method: "POST", body: JSON.stringify({ name, color }) },
      );
      setLabels((current) => [...current, response.label].sort((a, b) => a.name.localeCompare(b.name)));
      return response.label;
    } catch (reason) {
      handleError(reason);
      return null;
    }
  }

  async function updateTask(task: Task, changes: Partial<Task>) {
    if (!token) return;
    try {
      const response = await taskboardFetch<{ task: Task }>(
        `/api/tasks/${task.id}`,
        token,
        { method: "PATCH", body: JSON.stringify(changes) },
      );
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? response.task : item)),
      );
    } catch (reason) {
      handleError(reason);
    }
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

  function handleColumnDragLeave(
    event: DragEvent<HTMLElement>,
    status: Status,
  ) {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
    setDragOverStatus((current) => (current === status ? null : current));
  }

  async function moveTaskToStatus(task: Task, status: Status) {
    if (!token || isReadOnly || task.status === status) return;
    const previousStatus = task.status;
    setMovingTaskId(task.id);
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status } : item)),
    );
    try {
      const response = await taskboardFetch<{ task: Task }>(
        `/api/tasks/${task.id}`,
        token,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? response.task : item)),
      );
    } catch (reason) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: previousStatus } : item,
        ),
      );
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
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description);
    setEditTaskStatus(task.status);
    setEditTaskPriority(task.priority);
    setEditTaskAssignee(task.assignee_id || "");
    setEditTaskLabelIDs(task.label_ids || []);
    setViewingTask(task);
    setTaskModal("edit");
  }

  function cancelTaskEdit() {
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
    setTaskLabelIDs([]);
    setTaskModal("create");
  }

  function openTaskView(task: Task) {
    setViewingTask(task);
    setTaskModal("view");
  }

  function closeTaskModal() {
    setTaskModal(null);
    setViewingTask(null);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault();
    if (!token || !editTaskTitle.trim()) return;
    try {
      const response = await taskboardFetch<{ task: Task }>(
        `/api/tasks/${task.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: editTaskTitle,
            description: editTaskDescription,
            status: editTaskStatus,
            priority: editTaskPriority,
            assignee_id: editTaskAssignee,
            label_ids: editTaskLabelIDs,
          }),
        },
      );
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? response.task : item)),
      );
      cancelTaskEdit();
    } catch (reason) {
      handleError(reason);
    }
  }

  function openTeamView() {
    if (projectId) router.push(`/workspace/${projectId}/team`);
  }

  return (
    <main className="workspace-page">
      <div className="workspace-layout">
        <section
          className={`workspace-main ${!projectId ? "workspace-selection-main" : ""}`}
        >
          {error ? (
            <div className="workspace-error" role="alert">
              {error}
              <button type="button" onClick={() => setError("")}>
                <WorkspaceIcon name="close" />
              </button>
            </div>
          ) : null}
          {!projectId ? (
            <div className="workspace-selection">
              <header className="workspace-selection-heading">
                <span className="workspace-kicker">Seu workspace</span>
                <h1>Escolha um projeto para continuar.</h1>
                <p>
                  Quadro, prospecção, equipe e sala ao vivo ficam organizados
                  dentro do projeto certo.
                </p>
              </header>
              <section
                className="workspace-selection-projects"
                aria-labelledby="workspace-selection-projects-title"
              >
                <div className="workspace-selection-section-heading">
                  <div>
                    <span className="workspace-kicker">
                      Projetos disponíveis
                    </span>
                    <h2 id="workspace-selection-projects-title">
                      Onde você quer trabalhar?
                    </h2>
                  </div>
                  <span>{loading ? "Carregando" : projects.length}</span>
                </div>
                {loading ? (
                  <div className="workspace-selection-grid">
                    {[1, 2, 3].map((item) => (
                      <div
                        className="workspace-skeleton workspace-selection-card-skeleton"
                        key={item}
                      />
                    ))}
                  </div>
                ) : null}
                {!loading && projects.length ? (
                  <div className="workspace-selection-grid">
                    {projects.map((project) => (
                      <MagicCard
                        className="workspace-selection-card-shell"
                        key={project.id}
                        gradientColor="hsl(var(--primary))"
                        gradientFrom="hsl(var(--primary))"
                        gradientTo="hsl(var(--ring))"
                        gradientOpacity={0.18}
                      >
                        <button
                          ref={projectDialogTriggerRef}
                          className="workspace-selection-card"
                          type="button"
                          onClick={() =>
                            router.push(`/workspace/${project.id}`)
                          }
                        >
                          <span className="workspace-selection-card-icon">
                            {project.image_data ? (
                              <Image src={project.image_data} alt="" width={54} height={54} unoptimized />
                            ) : (
                              <WorkspaceIcon name="folder" />
                            )}
                          </span>
                          <span>
                            <strong>{project.name}</strong>
                            <small>
                              {project.task_count}{" "}
                              {project.task_count === 1 ? "tarefa" : "tarefas"}
                            </small>
                          </span>
                          <WorkspaceIcon name="chevron" />
                        </button>
                      </MagicCard>
                    ))}
                  </div>
                ) : null}
                {!loading && !projects.length ? (
                  <div className="workspace-selection-empty">
                    <WorkspaceIcon name="folder" />
                    <strong>Nenhum projeto criado ainda.</strong>
                    <p>
                      Crie o primeiro projeto para começar a organizar o
                      trabalho da equipe.
                    </p>
                  </div>
                ) : null}
              </section>
              <form
                className="workspace-selection-form"
                onSubmit={createProject}
              >
                <div>
                  <span className="workspace-kicker">Novo projeto</span>
                  <h2>Comece um novo espaço de trabalho</h2>
                  <p>O nome é obrigatório. Descrição e imagem são opcionais.</p>
                </div>
                <div className="workspace-selection-form-fields">
                  <label>
                    Nome do projeto
                    <input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder="Ex.: Lançamento do site"
                      aria-label="Nome do novo projeto"
                      required
                    />
                  </label>
                  <label>
                    Descrição
                    <textarea
                      value={projectDescription}
                      onChange={(event) =>
                        setProjectDescription(event.target.value)
                      }
                      placeholder="Qual é o objetivo deste projeto?"
                      aria-label="Descrição do novo projeto"
                      rows={3}
                    />
                  </label>
                  <label className="image-picker">
                    <span>
                      <WorkspaceIcon name="screen" />{" "}
                      {projectImageName || "Anexar imagem"}
                    </span>
                    <small>PNG, JPEG ou WebP · até 512 KB</small>
                    <input
                      ref={projectImageInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleProjectImage}
                      aria-label="Imagem do projeto"
                    />
                  </label>
                </div>
                {projectImage ? (
                  <div className="image-preview">
                    <Image src={projectImage} alt="Prévia da capa do projeto" width={640} height={280} unoptimized />
                    <button
                      type="button"
                      onClick={() => {
                        setProjectImage("");
                        setProjectImageName("");
                        if (projectImageInput.current)
                          projectImageInput.current.value = "";
                      }}
                    >
                      Remover
                    </button>
                  </div>
                ) : null}
                <ShimmerButton
                  className="workspace-primary-action new-project-submit"
                  type="submit"
                  shimmerColor="#ffffff"
                  background="hsl(var(--primary))"
                  borderRadius="10px"
                >
                  <WorkspaceIcon name="plus" />
                  Criar projeto
                </ShimmerButton>
              </form>
            </div>
          ) : loading ? (
            <div
              className="workspace-loading"
              aria-busy="true"
              aria-label="Carregando workspace"
            >
              <div className="workspace-loading-heading">
                <div className="workspace-skeleton workspace-skeleton-icon" />
                <div>
                  <div className="workspace-skeleton workspace-skeleton-kicker" />
                  <div className="workspace-skeleton workspace-skeleton-title" />
                  <div className="workspace-skeleton workspace-skeleton-copy" />
                </div>
              </div>
              <div className="workspace-loading-toolbar">
                <div className="workspace-skeleton" />
                <div className="workspace-skeleton" />
              </div>
              <div className="workspace-loading-board">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    className="workspace-skeleton workspace-skeleton-column"
                    key={item}
                  />
                ))}
              </div>
            </div>
          ) : selectedProject ? (
            <>
              <BlurFade>
                <MagicCard
                  className="workspace-title-card"
                  gradientColor="hsl(var(--primary))"
                  gradientFrom="hsl(var(--primary))"
                  gradientTo="hsl(var(--ring))"
                  gradientOpacity={0.15}
                >
                  <div className="workspace-title">
                    <div className="project-heading">
                      {selectedProject.image_data ? (
                        <Image
                          className="project-heading-image"
                          src={selectedProject.image_data}
                          alt=""
                          width={54}
                          height={54}
                          unoptimized
                        />
                      ) : (
                        <span className="project-heading-placeholder">
                          <WorkspaceIcon name="folder" />
                        </span>
                      )}
                      <div>
                        <span className="workspace-kicker">Projeto ativo</span>
                        <h1>{selectedProject.name}</h1>
                        <div className="project-description">
                          <MarkdownPreview
                            value={selectedProject.description}
                            emptyText="Organize as próximas entregas da equipe."
                          />
                        </div>
                      </div>
                      <div className="project-heading-actions">
                        <Link
                          className="room-link"
                          href={`/workspace/${selectedProject.id}/room`}
                        >
                          Sala ao vivo
                        </Link>
                        <button
                          className="edit-trigger"
                          type="button"
                          onClick={startProjectEdit}
                        >
                          Editar projeto
                        </button>
                      </div>
                    </div>
                    <div className="member-stack">
                      <WorkspaceAvatarStack
                        members={members}
                        label={`${members.length} integrante${members.length === 1 ? "" : "s"} no projeto`}
                      />
                      <b>
                        {members.length}{" "}
                        {members.length === 1 ? "integrante" : "integrantes"}
                      </b>
                    </div>
                  </div>
                </MagicCard>
              </BlurFade>
              <div className="workspace-toolbar">
                <div className="workspace-toolbar-copy">
                  <span className="workspace-kicker">Quadro de tarefas</span>
                  <strong>
                    {selectedLabelIDs.length
                      ? `${filteredTasks.length} de ${tasks.length} tarefas`
                      : `${tasks.length} ${tasks.length === 1 ? "tarefa" : "tarefas"}`}{" "}
                    no projeto
                  </strong>
                  <span>
                    Organize o trabalho da equipe por etapa. Arraste as tarefas
                    para mover.
                  </span>
                </div>
                <div className="workspace-toolbar-actions">
                  <ShimmerButton
                    ref={taskDialogTriggerRef}
                    className="workspace-primary-action"
                    type="button"
                    onClick={openTaskCreate}
                    disabled={isReadOnly}
                    title={
                      isReadOnly
                        ? "Seu acesso permite apenas visualização"
                        : "Adicionar nova tarefa"
                    }
                    shimmerColor="#ffffff"
                    background="var(--button)"
                    borderRadius="10px"
                  >
                    <WorkspaceIcon name="plus" />
                    Nova tarefa
                  </ShimmerButton>
                  <button
                    className="workspace-secondary-action"
                    type="button"
                    onClick={openTeamView}
                  >
                    <WorkspaceIcon name="users" />
                    Equipe
                  </button>
                </div>
              </div>
              <div className="kanban-filters">
                <details className="kanban-label-filter">
                  <summary>
                    <span>Filtrar por etiquetas</span>
                    {selectedLabelIDs.length ? <b>{selectedLabelIDs.length}</b> : null}
                  </summary>
                  <div className="kanban-label-filter-menu">
                    {labels.map((label) => (
                      <label className="task-label-option" key={label.id}>
                        <input
                          type="checkbox"
                          checked={selectedLabelIDs.includes(label.id)}
                          onChange={(event) => setSelectedLabelIDs((current) => event.target.checked
                            ? [...current, label.id]
                            : current.filter((id) => id !== label.id))}
                        />
                        <span className={`task-label-pill is-${label.color}`}>{label.name}</span>
                      </label>
                    ))}
                    {!labels.length ? <span className="task-label-empty">Crie etiquetas ao editar uma tarefa.</span> : null}
                  </div>
                </details>
                {selectedLabelIDs.length ? (
                  <button className="kanban-filter-clear" type="button" onClick={() => setSelectedLabelIDs([])}>
                    Limpar filtros
                  </button>
                ) : null}
              </div>
              <div className="kanban-grid">
                {columns.map((column) => (
                  <section
                    className={`kanban-column ${dragOverStatus === column.status ? "is-drag-over" : ""}`}
                    key={column.status}
                    onDragOver={(event) =>
                      handleColumnDragOver(event, column.status)
                    }
                    onDragLeave={(event) =>
                      handleColumnDragLeave(event, column.status)
                    }
                    onDrop={(event) => handleColumnDrop(event, column.status)}
                  >
                    <div className="column-heading">
                      <span className={`column-dot ${column.tone}`} />
                      <h2>{column.label}</h2>
                      <b>{groupedTasks[column.status].length}</b>
                    </div>
                    <div className="task-stack">
                      {groupedTasks[column.status].map((task) => (
                        <article
                          className={`kanban-card ${draggedTaskId === task.id ? "is-dragging" : ""} ${movingTaskId === task.id ? "is-moving" : ""}`}
                          key={task.id}
                          draggable={!isReadOnly}
                          onDragStart={(event) =>
                            handleTaskDragStart(event, task)
                          }
                          onDragEnd={handleTaskDragEnd}
                        >
                          <div className="task-card-top">
                            <span className={`priority ${task.priority}`}>
                              {task.priority === "high"
                                ? "Alta"
                                : task.priority === "low"
                                  ? "Baixa"
                                  : "Média"}
                            </span>
                            <div
                              className="task-card-actions"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <select
                                value={task.status}
                                onChange={(event) =>
                                  void updateTask(task, {
                                    status: event.target.value as Status,
                                  })
                                }
                                aria-label={`Status de ${task.title}`}
                                disabled={isReadOnly}
                              >
                                <option value="backlog">Backlog</option>
                                <option value="todo">A fazer</option>
                                <option value="in_progress">
                                  Em andamento
                                </option>
                                <option value="done">Concluído</option>
                              </select>
                              <button
                                className="task-edit-trigger"
                                type="button"
                                onClick={() => startTaskEdit(task)}
                                disabled={isReadOnly}
                              >
                                Editar
                              </button>
                            </div>
                          </div>
                          <button
                            className="task-card-open"
                            type="button"
                            onClick={() => openTaskView(task)}
                          >
                            <h3>{task.title}</h3>
                          </button>
                          <LabelPills labels={labels} labelIDs={task.label_ids} limit={3} />
                          {task.description ? (
                            <MarkdownPreview value={task.description} />
                          ) : (
                            <p className="task-card-placeholder">
                              Sem descrição adicionada.
                            </p>
                          )}
                          <div
                            className="task-card-footer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <select
                              value={task.assignee_id || ""}
                              onChange={(event) =>
                                void updateTask(task, {
                                  assignee_id: event.target.value,
                                })
                              }
                              aria-label={`Responsável por ${task.title}`}
                              disabled={isReadOnly}
                            >
                              <option value="">Sem responsável</option>
                              {members.map((member) => (
                                <option value={member.id} key={member.id}>
                                  {member.alias || member.email}
                                </option>
                              ))}
                            </select>
                            <span>
                              {task.assignee_id
                                ? (
                                    members.find(
                                      (member) =>
                                        member.id === task.assignee_id,
                                    )?.alias ||
                                    members.find(
                                      (member) =>
                                        member.id === task.assignee_id,
                                    )?.email
                                  )
                                    ?.slice(0, 1)
                                    .toUpperCase() || "?"
                                : "·"}
                            </span>
                          </div>
                        </article>
                      ))}
                      {!groupedTasks[column.status].length ? (
                        <div className="column-empty">
                          {selectedLabelIDs.length
                            ? "Nenhuma tarefa corresponde aos filtros"
                            : "Nenhuma tarefa aqui"}
                        </div>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="workspace-empty">
              <WorkspaceIcon name="folder" />
              <h1>Projeto indisponível.</h1>
              <p>Escolha outro projeto para continuar.</p>
              <Link className="workspace-secondary-action" href="/workspace">
                Voltar para projetos
              </Link>
            </div>
          )}
        </section>
      </div>
      <Dialog
        open={editingProject}
        onOpenChange={(open) => {
          if (!open) cancelProjectEdit();
        }}
      >
        {selectedProject ? (
          <DialogContent
            className="workspace-modal project-modal"
            showCloseButton={false}
            aria-labelledby="workspace-project-modal-title"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              projectDialogTriggerRef.current?.focus();
            }}
          >
            <div className="workspace-modal-header">
              <div>
                <span className="workspace-kicker">Projeto ativo</span>
                <h2 id="workspace-project-modal-title">Editar projeto</h2>
              </div>
              <button
                className="workspace-panel-close"
                type="button"
                onClick={cancelProjectEdit}
                aria-label="Fechar janela"
                title="Fechar"
              >
                <WorkspaceIcon name="close" />
              </button>
            </div>
            <form className="task-modal-form" onSubmit={saveProject}>
              <label>
                Nome do projeto
                <input
                  value={editProjectName}
                  onChange={(event) => setEditProjectName(event.target.value)}
                  aria-label="Nome do projeto"
                  autoFocus
                  required
                />
              </label>
              <label>
                Descrição
                <textarea
                  value={editProjectDescription}
                  onChange={(event) =>
                    setEditProjectDescription(event.target.value)
                  }
                  placeholder="Descreva o objetivo do projeto em Markdown"
                  aria-label="Descrição do projeto"
                  rows={5}
                />
              </label>
              <label className="image-picker project-modal-image-picker">
                <span>
                  <WorkspaceIcon name="screen" />{" "}
                  {editProjectImageName || "Alterar imagem"}
                </span>
                <small>PNG, JPEG ou WebP · até 512 KB</small>
                <input
                  ref={editProjectImageInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleEditProjectImage}
                  aria-label="Alterar imagem do projeto"
                />
              </label>
              {editProjectImage ? (
                <div className="image-preview">
                  <Image
                    src={editProjectImage}
                    alt="Prévia da nova capa do projeto"
                    width={640}
                    height={280}
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditProjectImage("");
                      setEditProjectImageName("");
                      if (editProjectImageInput.current)
                        editProjectImageInput.current.value = "";
                    }}
                  >
                    Remover imagem
                  </button>
                </div>
              ) : null}
              <div className="workspace-modal-actions">
                <button
                  className="edit-cancel-button"
                  type="button"
                  onClick={cancelProjectEdit}
                >
                  Cancelar
                </button>
                <button className="edit-save-button" type="submit">
                  Salvar projeto
                </button>
              </div>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
      <Dialog
        open={Boolean(taskModal)}
        onOpenChange={(open) => {
          if (!open) closeTaskModal();
        }}
      >
        {taskModal ? (
          <DialogContent
            className="workspace-modal"
            showCloseButton={false}
            aria-labelledby="workspace-task-modal-title"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              taskDialogTriggerRef.current?.focus();
            }}
          >
            <div className="workspace-modal-header">
              <div>
                <span className="workspace-kicker">
                  {taskModal === "create"
                    ? "Nova tarefa"
                    : taskModal === "edit"
                      ? "Editar tarefa"
                      : "Detalhes da tarefa"}
                </span>
                <h2 id="workspace-task-modal-title">
                  {taskModal === "create"
                    ? "Adicionar tarefa"
                    : taskModal === "edit"
                      ? "Atualizar tarefa"
                      : viewingTask?.title}
                </h2>
              </div>
              <button
                className="workspace-panel-close"
                type="button"
                onClick={closeTaskModal}
                aria-label="Fechar janela"
                title="Fechar"
              >
                <WorkspaceIcon name="close" />
              </button>
            </div>
            {taskModal === "view" && viewingTask ? (
              <div className="task-modal-detail">
                <div className="task-modal-badges">
                  <span className={`priority ${viewingTask.priority}`}>
                    {viewingTask.priority === "high"
                      ? "Alta prioridade"
                      : viewingTask.priority === "low"
                        ? "Baixa prioridade"
                        : "Prioridade média"}
                  </span>
                  <span className="task-modal-status">
                    {
                      columns.find(
                        (column) => column.status === viewingTask.status,
                      )?.label
                    }
                  </span>
                </div>
                <LabelPills labels={labels} labelIDs={viewingTask.label_ids} />
                <div className="task-modal-description">
                  <MarkdownPreview
                    value={viewingTask.description}
                    emptyText="Esta tarefa ainda não tem descrição."
                  />
                </div>
                <div className="task-modal-meta">
                  <span>Responsável</span>
                  <strong>
                    {viewingTask.assignee_id
                      ? members.find(
                          (member) => member.id === viewingTask.assignee_id,
                        )?.email || "Membro removido"
                      : "Sem responsável"}
                  </strong>
                </div>
                <div className="workspace-modal-actions">
                  <button
                    className="edit-cancel-button"
                    type="button"
                    onClick={closeTaskModal}
                  >
                    Fechar
                  </button>
                  {!isReadOnly ? (
                    <button
                      className="edit-save-button"
                      type="button"
                      onClick={() => startTaskEdit(viewingTask)}
                    >
                      Editar tarefa
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {taskModal === "create" ? (
              <form className="task-modal-form" onSubmit={createTask}>
                <label>
                  Título
                  <input
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="Ex.: Revisar fluxo de onboarding"
                    aria-label="Título da tarefa"
                    autoFocus
                    required
                  />
                </label>
                <label>
                  Descrição
                  <textarea
                    value={taskDescription}
                    onChange={(event) => setTaskDescription(event.target.value)}
                    placeholder="Descreva o que precisa ser feito em Markdown"
                    aria-label="Descrição da tarefa"
                    rows={5}
                  />
                </label>
                <LabelSelector
                  labels={labels}
                  selectedIDs={taskLabelIDs}
                  onChange={setTaskLabelIDs}
                  onCreateLabel={createLabel}
                />
                <div className="task-modal-fields">
                  <label>
                    Status
                    <select
                      value={taskStatus}
                      onChange={(event) =>
                        setTaskStatus(event.target.value as Status)
                      }
                    >
                      <option value="backlog">Backlog</option>
                      <option value="todo">A fazer</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="done">Concluído</option>
                    </select>
                  </label>
                  <label>
                    Prioridade
                    <select
                      value={taskPriority}
                      onChange={(event) =>
                        setTaskPriority(event.target.value as Priority)
                      }
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </label>
                  <label>
                    Responsável
                    <select
                      value={taskAssignee}
                      onChange={(event) => setTaskAssignee(event.target.value)}
                    >
                      <option value="">Sem responsável</option>
                      {members.map((member) => (
                        <option value={member.id} key={member.id}>
                          {member.alias || member.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="workspace-modal-actions">
                  <button
                    className="edit-cancel-button"
                    type="button"
                    onClick={closeTaskModal}
                  >
                    Cancelar
                  </button>
                  <button className="edit-save-button" type="submit">
                    Criar tarefa
                  </button>
                </div>
              </form>
            ) : null}
            {taskModal === "edit" && viewingTask ? (
              <form
                className="task-modal-form"
                onSubmit={(event) => void saveTask(event, viewingTask)}
              >
                <label>
                  Título
                  <input
                    value={editTaskTitle}
                    onChange={(event) => setEditTaskTitle(event.target.value)}
                    aria-label="Título da tarefa"
                    autoFocus
                    required
                  />
                </label>
                <label>
                  Descrição
                  <textarea
                    value={editTaskDescription}
                    onChange={(event) =>
                      setEditTaskDescription(event.target.value)
                    }
                    placeholder="Descrição em Markdown"
                    aria-label="Descrição da tarefa"
                    rows={5}
                  />
                </label>
                <LabelSelector
                  labels={labels}
                  selectedIDs={editTaskLabelIDs}
                  onChange={setEditTaskLabelIDs}
                  onCreateLabel={createLabel}
                />
                <div className="task-modal-fields">
                  <label>
                    Status
                    <select
                      value={editTaskStatus}
                      onChange={(event) =>
                        setEditTaskStatus(event.target.value as Status)
                      }
                    >
                      <option value="backlog">Backlog</option>
                      <option value="todo">A fazer</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="done">Concluído</option>
                    </select>
                  </label>
                  <label>
                    Prioridade
                    <select
                      value={editTaskPriority}
                      onChange={(event) =>
                        setEditTaskPriority(event.target.value as Priority)
                      }
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </label>
                  <label>
                    Responsável
                    <select
                      value={editTaskAssignee}
                      onChange={(event) =>
                        setEditTaskAssignee(event.target.value)
                      }
                    >
                      <option value="">Sem responsável</option>
                      {members.map((member) => (
                        <option value={member.id} key={member.id}>
                          {member.alias || member.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="workspace-modal-actions">
                  <button
                    className="edit-cancel-button"
                    type="button"
                    onClick={closeTaskModal}
                  >
                    Cancelar
                  </button>
                  <button className="edit-save-button" type="submit">
                    Salvar alterações
                  </button>
                </div>
              </form>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </main>
  );
}
