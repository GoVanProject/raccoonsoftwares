import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const project = {
  id: "project-1",
  name: "Projeto Aurora",
  description:
    "Projeto de demonstração com texto longo para validar quebra de linha.",
  owner_id: "user-1",
  task_count: 2,
};
const user = {
  id: "user-1",
  alias: "Luna",
  email: "luna@example.com",
  avatar_data: "",
};
const members = [{ ...user, role: "owner" }];
const labels = [
  { id: "label-1", project_id: "project-1", name: "Prioridade", color: "red" },
];
const tasks = [
  {
    id: "task-1",
    title: "Revisar o fluxo de onboarding com um título deliberadamente longo",
    description: "Descrição em **Markdown**.",
    status: "todo",
    priority: "high",
    assignee_id: "user-1",
    label_ids: ["label-1"],
  },
  {
    id: "task-2",
    title: "Validar responsividade",
    description: "",
    status: "in_progress",
    priority: "medium",
  },
];

async function mockWorkspace(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("taskboard_token", "e2e-token"),
  );
  await page.routeWebSocket("**/room/ws", (socket) => {
    socket.send(
      JSON.stringify({
        type: "room_state",
        self_id: user.id,
        peer: { ...user, publishing: false, mic_enabled: false },
        peers: [],
      }),
    );
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { user } });
    if (path === "/api/projects")
      return route.fulfill({ json: { projects: [project] } });
    if (path === `/api/projects/${project.id}`)
      return route.fulfill({ json: { project } });
    if (path.endsWith("/room/ticket"))
      return route.fulfill({
        json: { ticket: "e2e-ticket", expires_at: "2099-01-01T00:00:00Z", ice_servers: [] },
      });
    if (path === `/api/projects/${project.id}/leads`)
      return route.fulfill({ json: { leads: [] } });
    if (
      path === `/api/tasks/${tasks[0].id}` &&
      route.request().method() === "PATCH"
    ) {
      const changes = route.request().postDataJSON() as Partial<typeof tasks[number]>;
      return route.fulfill({
        json: { task: { ...tasks[0], ...changes } },
      });
    }
    if (path.endsWith("/comments")) {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { body: string };
        return route.fulfill({ json: { comment: { id: "comment-1", task_id: tasks[0].id, author_id: user.id, body: body.body, created_at: "2026-09-24T12:00:00Z" } } });
      }
      return route.fulfill({ json: { comments: [] } });
    }
    if (path.endsWith("/subtasks")) {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { title: string };
        return route.fulfill({ json: { subtask: { id: "subtask-1", task_id: tasks[0].id, title: body.title, done: false, position: 0, created_at: "2026-09-24T12:00:00Z" } } });
      }
      return route.fulfill({ json: { subtasks: [] } });
    }
    if (path.endsWith("/attachments")) {
      if (route.request().method() === "POST") {
        return route.fulfill({ json: { attachment: { id: "attachment-1", task_id: tasks[0].id, name: "brief.txt", content_type: "text/plain", size: 12, created_by: user.id, created_at: "2026-09-24T12:00:00Z" } } });
      }
      return route.fulfill({ json: { attachments: [] } });
    }
    if (path.endsWith("/tasks")) return route.fulfill({ json: { tasks } });
    if (path.endsWith("/members")) return route.fulfill({ json: { members } });
    if (path.endsWith("/labels")) return route.fulfill({ json: { labels } });
    if (path.endsWith("/prospects"))
      return route.fulfill({ json: { leads: [], activities: [] } });
    return route.fulfill({ json: {} });
  });
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

for (const route of ["/login", "/cadastro"]) {
  test(`${route} sem overflow e sem violações críticas`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expectNoDocumentOverflow(page);
    const results = await new AxeBuilder({ page })
      .exclude(".leaflet-container")
      .analyze();
    expect(
      results.violations.filter((item) => item.impact === "critical"),
    ).toEqual([]);
    await page.screenshot({
      path: `docs/ui-audit/after/${route.slice(1)}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
}

test("workspace vazio/populado, rail e dialog com foco", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/workspace/project-1");
  await expect(
    page.getByRole("heading", { name: "Projeto Aurora" }),
  ).toBeVisible();
  await expect(
    page.locator(".kanban-card .task-label-pill", { hasText: "Prioridade" }),
  ).toBeVisible();
  await expectNoDocumentOverflow(page);
  const create = page.getByRole("button", { name: /nova tarefa/i });
  await create.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(create).toBeFocused();
  const taskStatus = page.getByRole("combobox", {
    name: `Status de ${tasks[0].title}`,
  });
  await expect(taskStatus).toBeVisible();
  await taskStatus.selectOption("done");
  await expect(taskStatus).toHaveValue("done");
  await page.getByText("Filtrar por etiquetas").click();
  await page.getByRole("checkbox", { name: "Prioridade" }).check();
  await expect(
    page.getByRole("button", { name: "Abrir tarefa Validar responsividade" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `docs/ui-audit/after/board-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("visões de resumo, backlog e quadro ficam acessíveis pelo seletor do projeto", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/workspace/project-1/summary");
  await expect(page.getByRole("link", { name: "Resumo" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Tarefas por etapa" })).toBeVisible();
  await page.getByRole("link", { name: "Backlog" }).click();
  await expect(page.getByRole("link", { name: "Backlog" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".backlog-task-row")).toHaveCount(2);
  await page.locator(".project-view-tabs").getByRole("link", { name: "Quadro", exact: true }).click();
  await expect(page.locator(".project-view-tabs").getByRole("link", { name: "Quadro", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".kanban-grid")).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("detalhes da tarefa aceitam anexos, subtarefas e comentários", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/workspace/project-1/backlog");
  await page.locator(".backlog-task-row").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Anexos" })).toBeVisible();
  await dialog.getByLabel("Nova subtarefa").fill("Revisar checklist");
  await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(dialog.getByText("Revisar checklist")).toBeVisible();
  await dialog.getByLabel("Novo comentário").fill("Validação concluída.");
  await dialog.getByRole("button", { name: "Comentar" }).click();
  await expect(dialog.getByText("Validação concluída.")).toBeVisible();
  await dialog.locator('input[type="file"][aria-label="Adicionar anexo à tarefa"]').setInputFiles({ name: "brief.txt", mimeType: "text/plain", buffer: Buffer.from("referência") });
  await expect(dialog.getByText("brief.txt")).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("rotas de equipe, prospecção, sala e perfil carregam sem overflow", async ({ page }) => {
  await mockWorkspace(page);
  const routes = [
    ["/workspace/project-1/team", "Equipe", "team"],
    ["/workspace/project-1/prospects", "Mapa de restaurantes", "prospects"],
    ["/workspace/project-1/room", "Projeto Aurora", "room"],
    ["/workspace/profile", "Edite seu perfil.", "profile"],
  ] as const;

  for (const [path, heading, screenshotName] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({
      path: `docs/ui-audit/after/${screenshotName}-${test.info().project.name}.png`,
      fullPage: true,
    });
  }
});

test("tema escuro persiste", async ({ page }, testInfo) => {
  await mockWorkspace(page);
  await page.goto("/workspace");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir navegação" }).click();
  }
  await page.getByRole("button", { name: /ativar tema escuro/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
