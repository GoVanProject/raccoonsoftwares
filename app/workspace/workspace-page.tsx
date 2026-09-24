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
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { API_URL, taskboardFetch } from "../lib/taskboard";
import { useTaskboardToken } from "../lib/use-taskboard-token";
import { cn } from "@/lib/utils";
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
type TaskComment = { id: string; task_id: string; author_id: string; body: string; created_at: string };
type TaskSubtask = { id: string; task_id: string; title: string; done: boolean; position: number; created_at: string };
type TaskAttachment = { id: string; task_id: string; name: string; content_type: string; size: number; created_by: string; created_at: string };
type BoardView = "summary" | "backlog" | "board";
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

const labelPillClasses: Record<LabelColor, string> = {
  blue: "bg-[hsl(var(--label-blue-background))] text-[hsl(var(--label-blue-foreground))]",
  purple: "bg-[hsl(var(--label-purple-background))] text-[hsl(var(--label-purple-foreground))]",
  green: "bg-[hsl(var(--label-green-background))] text-[hsl(var(--label-green-foreground))]",
  orange: "bg-[hsl(var(--label-orange-background))] text-[hsl(var(--label-orange-foreground))]",
  red: "bg-[hsl(var(--label-red-background))] text-[hsl(var(--label-red-foreground))]",
  cyan: "bg-[hsl(var(--label-cyan-background))] text-[hsl(var(--label-cyan-foreground))]",
  gray: "bg-[hsl(var(--label-gray-background))] text-[hsl(var(--label-gray-foreground))]",
};

const labelPillBase = "inline-flex min-h-6 max-w-full items-center overflow-hidden whitespace-nowrap rounded-md px-2 py-[3px] text-xs font-bold leading-[1.3] text-ellipsis";
const labelOptionClass = "m-0 flex min-h-11 min-w-0 cursor-pointer items-center justify-start gap-2 text-xs font-medium text-foreground";
const labelCheckboxClass = "m-0 size-5 shrink-0 accent-primary";
const labelMenuClass = "absolute left-0 top-[calc(100%+6px)] z-20 grid w-[min(340px,calc(100vw-48px))] gap-3 rounded-[11px] border border-border bg-card p-3 shadow-[0_24px_80px_hsl(var(--foreground)/0.15)] sm:w-[min(420px,calc(100vw-64px))]";
const labelSummaryClass = "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground marker:content-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";
const statusDotClasses: Record<string, string> = {
  backlog: "bg-muted-foreground",
  todo: "bg-muted-foreground",
  progress: "bg-primary",
  done: "bg-emerald-500",
};

function StatusDot({ tone }: { tone: string }) {
  return <span className={cn("size-2 shrink-0 rounded-full", statusDotClasses[tone])} />;
}

function PriorityPill({ priority }: { priority: Priority }) {
  const labels: Record<Priority, string> = { high: "Alta", medium: "Média", low: "Baixa" };
  const tones: Record<Priority, string> = {
    high: "bg-destructive/10 text-destructive",
    medium: "bg-orange-500/15 text-amber-700 dark:text-amber-300",
    low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };
  return <span className={cn("inline-flex rounded-md px-2 py-1 text-xs font-bold", tones[priority])}>{labels[priority]}</span>;
}

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
  inline = false,
}: {
  labels: TaskLabel[];
  labelIDs?: string[];
  limit?: number;
  inline?: boolean;
}) {
  const selectedLabels = (labelIDs || [])
    .map((id) => labels.find((label) => label.id === id))
    .filter((label): label is TaskLabel => Boolean(label));
  if (!selectedLabels.length) return null;
  const visibleLabels = limit ? selectedLabels.slice(0, limit) : selectedLabels;
  const remaining = selectedLabels.length - visibleLabels.length;
  const Container = inline ? "span" : "div";

  return (
    <Container className="my-2 mb-2 flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Etiquetas da tarefa">
      {visibleLabels.map((label) => (
        <span className={cn(labelPillBase, labelPillClasses[label.color])} key={label.id}>
          {label.name}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="inline-flex min-h-6 max-w-full items-center overflow-hidden whitespace-nowrap rounded-md bg-secondary px-2 py-[3px] text-xs font-bold leading-[1.3] text-muted-foreground text-ellipsis" title={selectedLabels.slice(visibleLabels.length).map((label) => label.name).join(", ")}>
          +{remaining}
        </span>
      ) : null}
    </Container>
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
    <details className="relative w-full">
      <summary className={cn(labelSummaryClass, "w-full justify-between [&::-webkit-details-marker]:hidden after:content-['⌄'] after:text-sm after:text-muted-foreground")}>
        <span>Etiquetas</span>
        <small>{selectedIDs.length ? `${selectedIDs.length} selecionada${selectedIDs.length === 1 ? "" : "s"}` : "Adicionar"}</small>
      </summary>
      <div className={cn(labelMenuClass, "w-[min(360px,calc(100vw-48px))]") }>
        <div className="grid max-h-[190px] gap-1.5 overflow-y-auto">
          {labels.map((label) => (
            <label className={labelOptionClass} key={label.id}>
              <input
                className={labelCheckboxClass}
                type="checkbox"
                checked={selectedIDs.includes(label.id)}
                onChange={(event) => {
                  onChange(event.target.checked
                    ? [...selectedIDs, label.id]
                    : selectedIDs.filter((id) => id !== label.id));
                }}
              />
              <span className={cn(labelPillBase, labelPillClasses[label.color])}>{label.name}</span>
            </label>
          ))}
          {!labels.length ? <span className="text-xs text-muted-foreground">Nenhuma etiqueta criada.</span> : null}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2 border-t border-border pt-3">
          <input
            className="min-h-11 min-w-0 rounded-lg border border-border bg-secondary px-2.5 text-xs text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
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
            className="min-h-11 min-w-0 rounded-lg border border-border bg-secondary px-2.5 text-xs text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            value={color}
            onChange={(event) => setColor(event.target.value as LabelColor)}
            aria-label="Cor da nova etiqueta"
          >
            {labelColors.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
          <button className="col-span-full min-h-11 rounded-lg border border-border bg-secondary px-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-55" type="button" onClick={() => void createLabel()} disabled={!name.trim() || creating}>
            {creating ? "Criando" : "Criar etiqueta"}
          </button>
        </div>
      </div>
    </details>
  );
}

function LabelFilter({
  labels,
  selectedIDs,
  onChange,
  emptyText,
}: {
  labels: TaskLabel[];
  selectedIDs: string[];
  onChange: (ids: string[]) => void;
  emptyText: string;
}) {
  return (
    <details className="relative">
      <summary className={cn(labelSummaryClass, "[&::-webkit-details-marker]:hidden after:content-['⌄'] after:text-sm after:text-muted-foreground")}>
        <span>Filtrar por etiquetas</span>
        {selectedIDs.length ? <b className="grid size-[22px] place-items-center rounded-md bg-secondary text-xs text-foreground">{selectedIDs.length}</b> : null}
      </summary>
      <div className={cn(labelMenuClass, "max-h-[300px] overflow-y-auto") }>
        {labels.map((label) => (
          <label className={labelOptionClass} key={label.id}>
            <input
              className={labelCheckboxClass}
              type="checkbox"
              checked={selectedIDs.includes(label.id)}
              onChange={(event) => onChange(event.target.checked
                ? [...selectedIDs, label.id]
                : selectedIDs.filter((id) => id !== label.id))}
            />
            <span className={cn(labelPillBase, labelPillClasses[label.color])}>{label.name}</span>
          </label>
        ))}
        {!labels.length ? <span className="text-xs text-muted-foreground">{emptyText}</span> : null}
      </div>
    </details>
  );
}

export default function WorkspacePage({ view = "board" }: { view?: BoardView }) {
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
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskStatus, setTaskStatus] = useState<Status>("backlog");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskLabelIDs, setTaskLabelIDs] = useState<string[]>([]);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
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
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskSubtasks, setTaskSubtasks] = useState<TaskSubtask[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [taskCommentDraft, setTaskCommentDraft] = useState("");
  const [taskSubtaskDraft, setTaskSubtaskDraft] = useState("");
  const [taskDetailLoading, setTaskDetailLoading] = useState(false);
  const [taskDetailSaving, setTaskDetailSaving] = useState(false);
  const [backlogStatusFilter, setBacklogStatusFilter] = useState<"all" | Status>("all");
  const taskDetailRequest = useRef(0);

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
  const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const localNextWeek = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000 + 7 * 86_400_000).toISOString().slice(0, 10);
  const overdueTasks = filteredTasks.filter((task) => task.due_date && task.due_date < localToday && task.status !== "done");
  const upcomingTasks = filteredTasks.filter((task) => task.due_date && task.due_date >= localToday && task.due_date <= localNextWeek && task.status !== "done");
  const backlogTasks = filteredTasks.filter((task) => backlogStatusFilter === "all" || task.status === backlogStatusFilter);
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
            due_date: taskDueDate || undefined,
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
      setTaskDueDate("");
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
      setViewingTask((current) => current?.id === task.id ? response.task : current);
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
    setEditTaskDueDate(task.due_date || "");
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
    setTaskDueDate("");
    setTaskStatus("backlog");
    setTaskPriority("medium");
    setTaskAssignee("");
    setTaskLabelIDs([]);
    setTaskModal("create");
  }

  function openTaskView(task: Task) {
    setViewingTask(task);
    setTaskModal("view");
    setTaskComments([]);
    setTaskSubtasks([]);
    setTaskAttachments([]);
    const requestID = ++taskDetailRequest.current;
    if (!token) return;
    setTaskDetailLoading(true);
    Promise.all([
      taskboardFetch<{ comments: TaskComment[] }>(`/api/tasks/${task.id}/comments`, token),
      taskboardFetch<{ subtasks: TaskSubtask[] }>(`/api/tasks/${task.id}/subtasks`, token),
      taskboardFetch<{ attachments: TaskAttachment[] }>(`/api/tasks/${task.id}/attachments`, token),
    ]).then(([comments, subtasks, attachments]) => {
      if (taskDetailRequest.current !== requestID) return;
      setTaskComments(comments.comments);
      setTaskSubtasks(subtasks.subtasks);
      setTaskAttachments(attachments.attachments);
    }).catch(handleError).finally(() => {
      if (taskDetailRequest.current === requestID) setTaskDetailLoading(false);
    });
  }

  function closeTaskModal() {
    taskDetailRequest.current += 1;
    setTaskModal(null);
    setViewingTask(null);
    setTaskDetailLoading(false);
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
            due_date: editTaskDueDate,
          }),
        },
      );
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? response.task : item)),
      );
      setViewingTask(response.task);
      cancelTaskEdit();
    } catch (reason) {
      handleError(reason);
    }
  }

  async function addTaskComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !viewingTask || !taskCommentDraft.trim()) return;
    setTaskDetailSaving(true);
    try {
      const response = await taskboardFetch<{ comment: TaskComment }>(`/api/tasks/${viewingTask.id}/comments`, token, {
        method: "POST", body: JSON.stringify({ body: taskCommentDraft }),
      });
      setTaskComments((current) => [...current, response.comment]);
      setTaskCommentDraft("");
    } catch (reason) { handleError(reason); }
    finally { setTaskDetailSaving(false); }
  }

  async function addTaskSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !viewingTask || !taskSubtaskDraft.trim()) return;
    setTaskDetailSaving(true);
    try {
      const response = await taskboardFetch<{ subtask: TaskSubtask }>(`/api/tasks/${viewingTask.id}/subtasks`, token, {
        method: "POST", body: JSON.stringify({ title: taskSubtaskDraft }),
      });
      setTaskSubtasks((current) => [...current, response.subtask]);
      setTaskSubtaskDraft("");
    } catch (reason) { handleError(reason); }
    finally { setTaskDetailSaving(false); }
  }

  async function toggleTaskSubtask(subtask: TaskSubtask) {
    if (!token || isReadOnly) return;
    try {
      const response = await taskboardFetch<{ subtask: TaskSubtask }>(`/api/task-subtasks/${subtask.id}`, token, {
        method: "PATCH", body: JSON.stringify({ done: !subtask.done }),
      });
      setTaskSubtasks((current) => current.map((item) => item.id === subtask.id ? response.subtask : item));
    } catch (reason) { handleError(reason); }
  }

  async function removeTaskResource(path: string, resourceID: string, kind: "comment" | "subtask" | "attachment") {
    if (!token) return;
    try {
      await taskboardFetch(path, token, { method: "DELETE" });
      if (kind === "comment") setTaskComments((current) => current.filter((item) => item.id !== resourceID));
      if (kind === "subtask") setTaskSubtasks((current) => current.filter((item) => item.id !== resourceID));
      if (kind === "attachment") setTaskAttachments((current) => current.filter((item) => item.id !== resourceID));
    } catch (reason) { handleError(reason); }
  }

  async function uploadTaskAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!token || !viewingTask || !file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("O anexo deve ter até 10 MB.");
      event.target.value = "";
      return;
    }
    setTaskDetailSaving(true);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const response = await taskboardFetch<{ attachment: TaskAttachment }>(`/api/tasks/${viewingTask.id}/attachments`, token, { method: "POST", body: formData });
      setTaskAttachments((current) => [...current, response.attachment]);
      setError("");
    } catch (reason) { handleError(reason); }
    finally { setTaskDetailSaving(false); event.target.value = ""; }
  }

  async function downloadTaskAttachment(attachment: TaskAttachment) {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/task-attachments/${attachment.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Não foi possível baixar o anexo.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) { handleError(reason); }
  }

  function openTeamView() {
    if (projectId) router.push(`/workspace/${projectId}/team`);
  }

  return (
    <main className="workspace-page min-h-dvh overflow-x-clip bg-background text-foreground">
      <div className="relative min-h-dvh">
        <section
          className={cn("min-w-0 min-h-dvh w-full overflow-x-hidden px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pt-12", !projectId && "grid items-start")}
        >
          {error ? (
            <div className="workspace-error" role="alert">
              {error}
              <Button variant="ghost" size="icon" className="size-8" type="button" onClick={() => setError("")}>
                <WorkspaceIcon name="close" />
              </Button>
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
                        <Button
                          variant="ghost"
                          ref={projectDialogTriggerRef}
                          className="workspace-selection-card h-auto w-full justify-between rounded-[inherit] text-left"
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
                        </Button>
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="edit-trigger"
                          type="button"
                          onClick={startProjectEdit}
                        >
                          Editar projeto
                        </Button>
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
              <nav className="my-1 mb-5 flex gap-1 overflow-x-auto border-b border-border" aria-label="Visões do projeto">
                {([
                  ["summary", "Resumo", "summary"],
                  ["backlog", "Backlog", "backlog"],
                  ["board", "Quadro", ""],
                ] as const).map(([tab, label, suffix]) => (
                  <Link
                    className={cn("inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 border-transparent px-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring", view === tab && "border-primary text-primary")}
                    href={`/workspace/${selectedProject.id}${suffix ? `/${suffix}` : ""}`}
                    aria-current={view === tab ? "page" : undefined}
                    key={tab}
                  >
                    {tab === "summary" ? <WorkspaceIcon name="summary" /> : tab === "backlog" ? <WorkspaceIcon name="backlog" /> : <WorkspaceIcon name="board" />}
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="workspace-toolbar">
                <div className="workspace-toolbar-copy">
                  <span className="workspace-kicker">{view === "summary" ? "Resumo do projeto" : view === "backlog" ? "Backlog do projeto" : "Quadro de tarefas"}</span>
                  <strong>
                    {selectedLabelIDs.length
                      ? `${filteredTasks.length} de ${tasks.length} tarefas`
                      : `${tasks.length} ${tasks.length === 1 ? "tarefa" : "tarefas"}`}{" "}
                    no projeto
                  </strong>
                  <span>{view === "board" ? "Organize o trabalho da equipe por etapa. Arraste as tarefas para mover." : view === "backlog" ? "Consulte e filtre as tarefas agrupadas por etapa." : "Acompanhe o progresso, os prazos e a distribuição do trabalho."}</span>
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
                  <Button
                    variant="outline"
                    className="workspace-secondary-action"
                    type="button"
                    onClick={openTeamView}
                  >
                    <WorkspaceIcon name="users" />
                    Equipe
                  </Button>
                </div>
              </div>
              {view === "summary" ? (
                <section className="grid gap-5" aria-label="Resumo do projeto">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <article className="grid min-w-0 gap-2 rounded-xl border border-border bg-card p-[18px]"><span className="text-xs text-muted-foreground">Total de tarefas</span><strong className="text-3xl leading-none">{filteredTasks.length}</strong><small className="text-xs text-muted-foreground">{tasks.length - filteredTasks.length ? `${tasks.length - filteredTasks.length} ocultas pelos filtros` : "No projeto"}</small></article>
                    <article className="grid min-w-0 gap-2 rounded-xl border border-border bg-card p-[18px]"><span className="text-xs text-muted-foreground">Concluídas</span><strong className="text-3xl leading-none">{groupedTasks.done.length}</strong><small className="text-xs text-muted-foreground">{filteredTasks.length ? `${Math.round(groupedTasks.done.length / filteredTasks.length * 100)}% do total` : "Sem tarefas"}</small></article>
                    <article className="grid min-w-0 gap-2 rounded-xl border border-border bg-card p-[18px]"><span className="text-xs text-muted-foreground">Atrasadas</span><strong className="text-3xl leading-none">{overdueTasks.length}</strong><small className="text-xs text-muted-foreground">Prazo já vencido</small></article>
                    <article className="grid min-w-0 gap-2 rounded-xl border border-border bg-card p-[18px]"><span className="text-xs text-muted-foreground">Próximos 7 dias</span><strong className="text-3xl leading-none">{upcomingTasks.length}</strong><small className="text-xs text-muted-foreground">Tarefas em aberto</small></article>
                  </div>
                  <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
                    <section className="rounded-xl border border-border bg-card p-5">
                      <header className="flex items-center justify-between gap-3"><div><span className="workspace-kicker">Fluxo de trabalho</span><h2 className="mt-0.5 text-[17px]">Tarefas por etapa</h2></div><span className="text-xs text-muted-foreground">{filteredTasks.length} no total</span></header>
                      <div className="mt-6 grid gap-4">
                        {columns.map((column) => {
                          const count = groupedTasks[column.status].length;
                          const percent = filteredTasks.length ? Math.round(count / filteredTasks.length * 100) : 0;
                          return <div key={column.status}><div className="flex items-center gap-2"><StatusDot tone={column.tone} /><strong>{column.label}</strong><b className="ml-auto">{count}</b></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div></div>;
                        })}
                      </div>
                      <header className="mt-[30px]"><div><span className="workspace-kicker">Equipe</span><h2 className="mt-0.5 text-[17px]">Tarefas por responsável</h2></div></header>
                      <div className="mt-3 grid">
                        {[...members.map((member) => ({ id: member.id, name: member.alias || member.email, count: filteredTasks.filter((task) => task.assignee_id === member.id).length })), { id: "unassigned", name: "Sem responsável", count: filteredTasks.filter((task) => !task.assignee_id).length }].filter((item) => item.count > 0).map((item) => <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[13px]" key={item.id}><span>{item.name}</span><b>{item.count}</b></div>)}
                        {!filteredTasks.length ? <p className="mt-5 p-[18px] text-center text-[13px] text-muted-foreground">As tarefas aparecerão aqui conforme forem criadas.</p> : null}
                      </div>
                    </section>
                    <section className="rounded-xl border border-border bg-card p-5">
                      <header className="flex items-center justify-between gap-3"><div><span className="workspace-kicker">Prazos</span><h2 className="mt-0.5 text-[17px]">Atenção nesta semana</h2></div><span className="text-xs text-muted-foreground">{overdueTasks.length + upcomingTasks.length} tarefas</span></header>
                      {[...overdueTasks, ...upcomingTasks].slice(0, 8).map((task) => <button className="mt-2 grid w-full gap-1 rounded-lg border border-border bg-transparent p-3 text-left text-foreground transition-colors hover:border-ring/50 hover:bg-muted" type="button" key={task.id} onClick={() => openTaskView(task)}><span className={cn("text-xs text-muted-foreground", task.due_date! < localToday && "text-destructive")}>{task.due_date! < localToday ? "Atrasada" : new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(new Date(`${task.due_date}T12:00:00`))}</span><strong className="overflow-hidden text-ellipsis whitespace-nowrap">{task.title}</strong><small className="text-xs text-muted-foreground">{members.find((member) => member.id === task.assignee_id)?.alias || "Sem responsável"}</small></button>)}
                      {!overdueTasks.length && !upcomingTasks.length ? <p className="mt-5 p-[18px] text-center text-[13px] text-muted-foreground">Nenhum prazo atrasado ou próximo nos próximos sete dias.</p> : null}
                    </section>
                  </div>
                </section>
              ) : null}
              {view === "backlog" ? (
                <section className="grid gap-5" aria-label="Backlog de tarefas">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="grid gap-1.5 text-xs text-muted-foreground">Etapa<select className="min-h-10 rounded-lg border border-border bg-card px-2.5 text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" value={backlogStatusFilter} onChange={(event) => setBacklogStatusFilter(event.target.value as "all" | Status)}><option value="all">Todas as etapas</option>{columns.map((column) => <option value={column.status} key={column.status}>{column.label}</option>)}</select></label>
                    <LabelFilter labels={labels} selectedIDs={selectedLabelIDs} onChange={setSelectedLabelIDs} emptyText="Nenhuma etiqueta criada." />
                    {selectedLabelIDs.length ? <button className="min-h-11 rounded-lg border border-border bg-secondary px-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted" type="button" onClick={() => setSelectedLabelIDs([])}>Limpar etiquetas</button> : null}
                  </div>
                  {columns.filter((column) => backlogStatusFilter === "all" || column.status === backlogStatusFilter).map((column) => {
                    const statusTasks = backlogTasks.filter((task) => task.status === column.status);
                    return <section className="overflow-hidden rounded-xl border border-border bg-card" key={column.status}><header className="flex min-h-[54px] items-center gap-2 border-b border-border px-4"><StatusDot tone={column.tone} /><h2 className="m-0 text-sm">{column.label}</h2><b className="grid size-6 place-items-center rounded-full bg-muted text-xs">{statusTasks.length}</b></header>{statusTasks.map((task) => <button className="grid w-full grid-cols-[minmax(180px,1.6fr)_minmax(100px,.8fr)_70px_minmax(100px,.8fr)_110px] items-center gap-3.5 border-0 border-b border-border bg-transparent px-4 py-3 text-left text-foreground transition-colors last:border-b-0 hover:bg-muted focus-visible:bg-muted max-md:grid-cols-[minmax(140px,1.4fr)_minmax(80px,.8fr)_60px] max-md:[&>span:nth-last-child(-n+2)]:hidden max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-2 max-sm:px-3 max-sm:[&>span:nth-last-child(-n+2)]:hidden" type="button" key={task.id} onClick={() => openTaskView(task)}><span className="grid min-w-0 gap-1"><strong className="overflow-hidden text-ellipsis whitespace-nowrap">{task.title}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{task.description || "Sem descrição"}</small></span><LabelPills labels={labels} labelIDs={task.label_ids} limit={2} inline /><PriorityPill priority={task.priority} /><span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{members.find((member) => member.id === task.assignee_id)?.alias || "Sem responsável"}</span><span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{task.due_date ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${task.due_date}T12:00:00`)) : "Sem prazo"}</span></button>)}{!statusTasks.length ? <p className="m-0 p-4 text-[13px] text-muted-foreground">Nenhuma tarefa nesta etapa.</p> : null}</section>;
                  })}
                  {!backlogTasks.length ? <div className="mt-5 p-[18px] text-center text-[13px] text-muted-foreground">Nenhuma tarefa corresponde aos filtros aplicados.</div> : null}
                </section>
              ) : null}
              {view === "board" ? <>
              <div className="relative z-[5] -mt-2.5 mb-4 flex items-center justify-center gap-2.5 sm:-mt-1.5">
                <LabelFilter labels={labels} selectedIDs={selectedLabelIDs} onChange={setSelectedLabelIDs} emptyText="Crie etiquetas ao editar uma tarefa." />
                {selectedLabelIDs.length ? (
                  <button className="min-h-11 rounded-lg border border-border bg-secondary px-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted" type="button" onClick={() => setSelectedLabelIDs([])}>
                    Limpar filtros
                  </button>
                ) : null}
              </div>
              <div className="grid min-w-0 grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-4 xl:auto-cols-auto">
                {columns.map((column) => (
                  <section
                    className={cn(
                      "min-h-[420px] min-w-0 w-full max-w-full overflow-hidden rounded-2xl border border-border bg-secondary/70 p-3 transition-[background,border-color,box-shadow] duration-300",
                      dragOverStatus === column.status && "border-primary bg-primary/5 shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
                    )}
                    key={column.status}
                    onDragOver={(event) =>
                      handleColumnDragOver(event, column.status)
                    }
                    onDragLeave={(event) =>
                      handleColumnDragLeave(event, column.status)
                    }
                    onDrop={(event) => handleColumnDrop(event, column.status)}
                  >
                    <div className="mb-3 flex items-center gap-2 px-1 py-1">
                      <StatusDot tone={column.tone} />
                      <h2 className="m-0 text-sm font-bold">{column.label}</h2>
                      <b className="ml-auto grid size-6 place-items-center rounded-md bg-muted text-xs text-muted-foreground">{groupedTasks[column.status].length}</b>
                    </div>
                    <div className="grid gap-3">
                      {groupedTasks[column.status].map((task) => (
                        <article
                          className={cn(
                            "min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-[transform,border-color,box-shadow,opacity] duration-300 hover:-translate-y-0.5 hover:border-input hover:shadow-md focus-within:-translate-y-0.5 focus-within:border-input focus-within:shadow-md",
                            !isReadOnly && "cursor-grab active:cursor-grabbing",
                            draggedTaskId === task.id && "rotate-1 scale-[0.98] opacity-55",
                            movingTaskId === task.id && "pointer-events-none opacity-65",
                          )}
                          key={task.id}
                          draggable={!isReadOnly}
                          onDragStart={(event) =>
                            handleTaskDragStart(event, task)
                          }
                          onDragEnd={handleTaskDragEnd}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <PriorityPill priority={task.priority} />
                            <div
                              className="flex min-w-0 items-center gap-2"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <select
                                className="h-10 min-w-0 max-w-[132px] rounded-lg border border-border bg-card px-2 text-xs text-muted-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 shrink-0 rounded-lg px-3 text-xs"
                                type="button"
                                onClick={() => startTaskEdit(task)}
                                disabled={isReadOnly}
                              >
                                Editar
                              </Button>
                            </div>
                          </div>
                          <button
                            className="mt-3 grid min-h-11 w-full items-center rounded-md border-0 bg-transparent p-0 text-left text-inherit outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            type="button"
                            onClick={() => openTaskView(task)}
                          >
                            <h3 className="m-0 text-base leading-snug font-bold">{task.title}</h3>
                          </button>
                          <LabelPills labels={labels} labelIDs={task.label_ids} limit={3} />
                          {task.description ? (
                            <MarkdownPreview value={task.description} />
                          ) : (
                            <p className="mb-3 text-sm text-muted-foreground">
                              Sem descrição adicionada.
                            </p>
                          )}
                          <div
                            className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <select
                              className="h-10 min-w-0 max-w-[calc(100%-40px)] flex-1 rounded-lg border border-border bg-card px-2 text-xs text-muted-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
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
                        <div className="rounded-lg border border-dashed border-input px-3 py-7 text-center text-xs text-muted-foreground">
                          {selectedLabelIDs.length
                            ? "Nenhuma tarefa corresponde aos filtros"
                            : "Nenhuma tarefa aqui"}
                        </div>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
              </> : null}
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
            className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-2xl gap-0 overflow-y-auto rounded-2xl p-5 sm:p-6"
            showCloseButton={false}
            aria-labelledby="workspace-project-modal-title"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              projectDialogTriggerRef.current?.focus();
            }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="workspace-kicker">Projeto ativo</span>
                <h2 className="m-0 text-2xl leading-tight font-bold tracking-tight text-foreground" id="workspace-project-modal-title">Editar projeto</h2>
              </div>
              <button
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className={cn(
              "!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[calc(100vw-32px)] max-h-[calc(100dvh-20px)] gap-0 overflow-x-hidden overflow-y-auto rounded-2xl p-4 sm:max-h-[calc(100dvh-40px)] sm:p-6",
              taskModal === "view" ? "!max-w-[1180px]" : "!max-w-2xl",
            )}
            showCloseButton={false}
            aria-labelledby="workspace-task-modal-title"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              taskDialogTriggerRef.current?.focus();
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
              <div>
                <span className="workspace-kicker">
                  {taskModal === "create"
                    ? "Nova tarefa"
                    : taskModal === "edit"
                      ? "Editar tarefa"
                      : "Detalhes da tarefa"}
                </span>
                <h2 className="m-0 max-w-[min(800px,calc(100vw-120px))] text-2xl leading-tight font-bold tracking-tight text-foreground sm:text-[28px]" id="workspace-task-modal-title">
                  {taskModal === "create"
                    ? "Adicionar tarefa"
                    : taskModal === "edit"
                      ? "Atualizar tarefa"
                      : viewingTask?.title}
                </h2>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                type="button"
                onClick={closeTaskModal}
                aria-label="Fechar janela"
                title="Fechar"
              >
                <WorkspaceIcon name="close" />
              </Button>
            </div>
            {taskModal === "view" && viewingTask ? (
              <div className="grid items-start gap-[18px] sm:grid-cols-[minmax(0,1fr)_250px] lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-7">
                <div className="grid min-w-0 gap-6">
                  <div>
                    <header className="mb-1.5 flex items-center justify-between gap-3"><h3 className="m-0 text-[15px]">Descrição</h3>{!isReadOnly ? <Button variant="link" size="sm" className="h-8" type="button" onClick={() => startTaskEdit(viewingTask)}>Editar</Button> : null}</header>
                    <div className="m-0 min-h-12 border-0 bg-transparent px-0 py-2"><MarkdownPreview value={viewingTask.description} emptyText="Adicionar descrição" /></div>
                  </div>
                  <section className="grid gap-3 border-t border-border pt-[18px]">
                    <header className="flex items-center justify-between gap-3"><div className="grid gap-1"><h3 className="m-0 text-[15px]">Anexos</h3><small className="text-xs text-muted-foreground">{taskAttachments.length} {taskAttachments.length === 1 ? "arquivo" : "arquivos"}</small></div>{!isReadOnly ? <label className={cn("relative inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border bg-card px-3 text-xs font-semibold", taskDetailSaving && "pointer-events-none opacity-55")}>+ Adicionar anexo<input className="absolute inset-0 size-full cursor-pointer opacity-0" type="file" onChange={uploadTaskAttachment} disabled={taskDetailSaving} aria-label="Adicionar anexo à tarefa" /></label> : null}</header>
                    {taskDetailLoading ? <p className="m-0 text-xs text-muted-foreground">Carregando anexos…</p> : taskAttachments.length ? <div className="grid gap-2">{taskAttachments.map((attachment) => <article className="grid grid-cols-[36px_minmax(0,1fr)_36px_36px] items-center gap-2.5 rounded-lg border border-border p-2.5" key={attachment.id}><span className="grid size-[34px] place-items-center rounded-full bg-muted"><WorkspaceIcon name="screen" /></span><div className="grid min-w-0 gap-1"><strong className="overflow-hidden text-[13px] text-ellipsis whitespace-nowrap">{attachment.name}</strong><small className="text-[11px] text-muted-foreground">{(attachment.size / 1024).toFixed(attachment.size < 1024 * 1024 ? 0 : 1)} KB · {new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(attachment.created_at))}</small></div><button className="grid size-[34px] place-items-center rounded-md border-0 bg-transparent text-xl text-muted-foreground hover:bg-muted hover:text-foreground" type="button" onClick={() => void downloadTaskAttachment(attachment)} aria-label={`Baixar ${attachment.name}`}><WorkspaceIcon name="download" /></button>{!isReadOnly ? <button className="grid size-[34px] place-items-center rounded-md border-0 bg-transparent text-xl text-muted-foreground hover:bg-muted hover:text-foreground" type="button" onClick={() => void removeTaskResource(`/api/task-attachments/${attachment.id}`, attachment.id, "attachment")} aria-label={`Remover ${attachment.name}`}>×</button> : null}</article>)}</div> : <p className="m-0 text-xs text-muted-foreground">Nenhum anexo foi adicionado.</p>}
                  </section>
                  <section className="grid gap-3 border-t border-border pt-[18px]">
                    <header><div className="grid gap-1"><h3 className="m-0 text-[15px]">Subtarefas</h3><small className="text-xs text-muted-foreground">{taskSubtasks.filter((item) => item.done).length} de {taskSubtasks.length} concluídas</small></div></header>
                    {taskDetailLoading ? <p className="m-0 text-xs text-muted-foreground">Carregando subtarefas…</p> : <div className="grid gap-2">{taskSubtasks.map((subtask) => <div className="grid min-h-[38px] grid-cols-[22px_minmax(0,1fr)_34px] items-center gap-2" key={subtask.id}><input className="size-[18px] accent-primary" type="checkbox" checked={subtask.done} disabled={isReadOnly} onChange={() => void toggleTaskSubtask(subtask)} aria-label={`Marcar ${subtask.title} como ${subtask.done ? "pendente" : "concluída"}`} /><span className={cn("text-[13px]", subtask.done && "text-muted-foreground line-through")}>{subtask.title}</span>{!isReadOnly ? <button className="grid size-[34px] place-items-center rounded-md border-0 bg-transparent text-xl text-muted-foreground hover:bg-muted hover:text-foreground" type="button" onClick={() => void removeTaskResource(`/api/task-subtasks/${subtask.id}`, subtask.id, "subtask")} aria-label={`Remover subtarefa ${subtask.title}`}>×</button> : null}</div>)}</div>}
                    {!isReadOnly ? <form className="flex gap-2" onSubmit={addTaskSubtask}><input className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" value={taskSubtaskDraft} onChange={(event) => setTaskSubtaskDraft(event.target.value)} placeholder="Adicionar subtarefa" aria-label="Nova subtarefa" maxLength={200} /><Button variant="secondary" size="sm" type="submit" disabled={taskDetailSaving || !taskSubtaskDraft.trim()}>Adicionar</Button></form> : null}
                  </section>
                  <section className="grid gap-3 border-t border-border pt-[18px]">
                    <header><div className="grid gap-1"><h3 className="m-0 text-[15px]">Comentários</h3><small className="text-xs text-muted-foreground">{taskComments.length} {taskComments.length === 1 ? "comentário" : "comentários"}</small></div></header>
                    {taskDetailLoading ? <p className="m-0 text-xs text-muted-foreground">Carregando comentários…</p> : taskComments.length ? <div className="grid gap-2">{taskComments.map((comment) => { const author = members.find((member) => member.id === comment.author_id); return <article className="grid grid-cols-[36px_minmax(0,1fr)_34px] items-start gap-2.5" key={comment.id}><span className="grid size-[34px] place-items-center rounded-full bg-muted text-xs font-bold text-primary">{(author?.alias || author?.email || "?").slice(0, 1).toUpperCase()}</span><div className="min-w-0 rounded-lg border border-border px-3 py-2.5"><header className="flex flex-wrap items-baseline gap-2"><strong className="text-xs">{author?.alias || author?.email || "Integrante"}</strong><time className="text-[11px] text-muted-foreground" dateTime={comment.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.created_at))}</time></header><p className="mt-2 break-words text-[13px] leading-6 whitespace-pre-wrap">{comment.body}</p></div>{comment.author_id === currentUserID ? <button className="grid size-[34px] place-items-center rounded-md border-0 bg-transparent text-xl text-muted-foreground hover:bg-muted hover:text-foreground" type="button" onClick={() => void removeTaskResource(`/api/task-comments/${comment.id}`, comment.id, "comment")} aria-label="Remover comentário">×</button> : null}</article>; })}</div> : <p className="m-0 text-xs text-muted-foreground">Ainda não há comentários.</p>}
                    {!isReadOnly ? <form className="grid gap-2 rounded-[10px] border border-border p-3" onSubmit={addTaskComment}><textarea className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" value={taskCommentDraft} onChange={(event) => setTaskCommentDraft(event.target.value)} placeholder="Escreva um comentário…" aria-label="Novo comentário" maxLength={5000} rows={3} /><div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start"><small className="text-xs text-muted-foreground">Comente para compartilhar uma atualização com a equipe.</small><Button type="submit" disabled={taskDetailSaving || !taskCommentDraft.trim()}>Comentar</Button></div></form> : null}
                  </section>
                </div>
                <aside className="order-first grid gap-4 rounded-[10px] border border-border bg-muted/20 p-4 sm:order-none" aria-label="Informações da tarefa">
                  <header className="flex items-center justify-between border-b border-border pb-3"><h3 className="m-0 text-[15px]">Informações</h3>{!isReadOnly ? <Button variant="link" size="sm" className="h-8" type="button" onClick={() => startTaskEdit(viewingTask)} aria-label="Editar todos os campos">Editar</Button> : null}</header>
                  <label className="grid gap-1.5 text-xs text-muted-foreground">Status<select className="min-h-[38px] w-full rounded-md border border-border bg-card px-2 text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-75" value={viewingTask.status} disabled={isReadOnly} onChange={(event) => void updateTask(viewingTask, { status: event.target.value as Status })}>{columns.map((column) => <option value={column.status} key={column.status}>{column.label}</option>)}</select></label>
                  <label className="grid gap-1.5 text-xs text-muted-foreground">Responsável<select className="min-h-[38px] w-full rounded-md border border-border bg-card px-2 text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-75" value={viewingTask.assignee_id || ""} disabled={isReadOnly} onChange={(event) => void updateTask(viewingTask, { assignee_id: event.target.value })}><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{member.alias || member.email}</option>)}</select></label>
                  <label className="grid gap-1.5 text-xs text-muted-foreground">Prioridade<select className="min-h-[38px] w-full rounded-md border border-border bg-card px-2 text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-75" value={viewingTask.priority} disabled={isReadOnly} onChange={(event) => void updateTask(viewingTask, { priority: event.target.value as Priority })}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label>
                  <label className="grid gap-1.5 text-xs text-muted-foreground">Prazo<input className="min-h-[38px] w-full rounded-md border border-border bg-card px-2 text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-75" type="date" value={viewingTask.due_date || ""} disabled={isReadOnly} onChange={(event) => void updateTask(viewingTask, { due_date: event.target.value })} /></label>
                  <div className="grid gap-2 text-xs text-muted-foreground"><span>Etiquetas</span><LabelSelector labels={labels} selectedIDs={viewingTask.label_ids || []} onChange={(ids) => void updateTask(viewingTask, { label_ids: ids })} onCreateLabel={createLabel} disabled={isReadOnly} /></div>
                </aside>
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
                    Prazo
                    <input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} />
                  </label>
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
                    Prazo
                    <input type="date" value={editTaskDueDate} onChange={(event) => setEditTaskDueDate(event.target.value)} />
                  </label>
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
