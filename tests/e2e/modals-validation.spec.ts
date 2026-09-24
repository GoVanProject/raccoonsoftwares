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
    title: "Revisar o fluxo de onboarding",
    description: "Descrição da tarefa em detalhes.",
    status: "todo",
    priority: "high",
    assignee_id: "user-1",
    label_ids: ["label-1"],
  },
];
const leads = [
  {
    id: "lead-1",
    project_id: "project-1",
    name: "Restaurante Sabor & Arte",
    status: "new",
    city: "São Paulo",
    state: "SP",
    category: "Restaurante",
    phone: "(11) 99999-9999",
    address: "Rua Augusta, 100",
    rating: 4.8,
    lat: -23.5505,
    lng: -46.6333,
    created_at: "2026-09-24T12:00:00Z",
    updated_at: "2026-09-24T12:00:00Z",
  },
];

async function mockWorkspaceWithLeads(page: Page) {
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
    if (path.endsWith("/comments"))
      return route.fulfill({ json: { comments: [] } });
    if (path.endsWith("/subtasks"))
      return route.fulfill({ json: { subtasks: [] } });
    if (path.endsWith("/attachments"))
      return route.fulfill({ json: { attachments: [] } });
    if (path === `/api/projects/${project.id}/leads`)
      return route.fulfill({ json: { leads } });
    if (path.includes("/activities"))
      return route.fulfill({ json: { activities: [] } });
    if (path.endsWith("/tasks")) return route.fulfill({ json: { tasks } });
    if (path.endsWith("/members")) return route.fulfill({ json: { members } });
    if (path.endsWith("/labels")) return route.fulfill({ json: { labels } });
    if (path.endsWith("/prospects"))
      return route.fulfill({ json: { leads, activities: [] } });
    return route.fulfill({ json: {} });
  });
}

async function verifyModalPositionAndOverlay(page: Page, dialogLocator: ReturnType<Page["getByRole"]>) {
  await expect(dialogLocator).toBeVisible();

  // Overlay check: overlay exists and has fixed positioning
  const overlay = page.locator("[data-state=open].fixed.inset-0");
  await expect(overlay).toBeVisible();

  // Dialog positioning: should be roughly centered
  const box = await dialogLocator.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    const viewportSize = page.viewportSize()!;
    const expectedCenterX = viewportSize.width / 2;
    const actualCenterX = box.x + box.width / 2;
    expect(Math.abs(expectedCenterX - actualCenterX)).toBeLessThanOrEqual(4);

    // Bounded within screen with margin
    expect(box.width).toBeLessThanOrEqual(viewportSize.width);
    expect(box.height).toBeLessThanOrEqual(viewportSize.height);
  }

  // Scrollability check: element or form should handle overflow without clipping
  const isScrollableOrBounded = await dialogLocator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return (
      style.overflowY === "auto" ||
      style.overflowY === "scroll" ||
      parseFloat(style.maxHeight) <= window.innerHeight
    );
  });
  expect(isScrollableOrBounded).toBe(true);
}

test.describe("Validação de modais e cascata CSS", () => {
  test("Modal de projeto: abre centralizado com overlay e fecha corretamente", async ({ page }) => {
    await mockWorkspaceWithLeads(page);
    await page.goto("/workspace/project-1");

    const editBtn = page.getByRole("button", { name: "Editar projeto" });
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const dialog = page.getByRole("dialog");
    await verifyModalPositionAndOverlay(page, dialog);
    await expect(dialog.getByText("Editar projeto")).toBeVisible();

    // Close via cancel button
    const cancelBtn = dialog.getByRole("button", { name: "Cancelar" });
    await cancelBtn.click();
    await expect(dialog).toBeHidden();
  });

  test("Modal de nova tarefa: abre centralizado com overlay e fecha com Escape", async ({ page }) => {
    await mockWorkspaceWithLeads(page);
    await page.goto("/workspace/project-1");

    const createBtn = page.getByRole("button", { name: /nova tarefa/i });
    await createBtn.click();

    const dialog = page.getByRole("dialog");
    await verifyModalPositionAndOverlay(page, dialog);
    await expect(dialog.getByLabel("Título da tarefa")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("Modal de editar tarefa: abre centralizado e fecha", async ({ page }) => {
    await mockWorkspaceWithLeads(page);
    await page.goto("/workspace/project-1");

    const editTaskBtn = page.getByRole("button", { name: "Editar", exact: true });
    await editTaskBtn.click();

    const dialog = page.getByRole("dialog");
    await verifyModalPositionAndOverlay(page, dialog);
    await expect(dialog.getByLabel("Título da tarefa")).toHaveValue(tasks[0].title);

    const cancelBtn = dialog.getByRole("button", { name: "Cancelar" });
    await cancelBtn.click();
    await expect(dialog).toBeHidden();
  });

  test("Modal de visualização de tarefa: abre em formato expandido e fecha", async ({ page }) => {
    await mockWorkspaceWithLeads(page);
    await page.goto("/workspace/project-1");

    const viewTaskBtn = page.getByRole("button", { name: tasks[0].title });
    await viewTaskBtn.click();

    const dialog = page.getByRole("dialog");
    await verifyModalPositionAndOverlay(page, dialog);

    const closeBtn = dialog.getByRole("button", { name: "Fechar janela" });
    await closeBtn.click();
    await expect(dialog).toBeHidden();
  });

  test("Modal de criação de lead: abre centralizado com largura correta e fecha", async ({ page }) => {
    await mockWorkspaceWithLeads(page);
    await page.goto("/workspace/project-1/prospects");

    const newLeadBtn = page.getByRole("button", { name: "Novo lead" });
    await expect(newLeadBtn).toBeVisible();
    await newLeadBtn.click();

    const dialog = page.getByRole("dialog");
    await verifyModalPositionAndOverlay(page, dialog);
    await expect(dialog.getByText("Novo lead")).toBeVisible();

    // Verify it uses the prospect-form-modal rules and has width up to min(780px, calc(100vw - 32px))
    const box = (await dialog.boundingBox())!;
    const viewportWidth = page.viewportSize()!.width;
    const expectedMaxWidth = Math.min(780, viewportWidth - 32);
    expect(box.width).toBeLessThanOrEqual(expectedMaxWidth);
    // Should not be constrained to 512px if screen is wide enough
    if (viewportWidth >= 850) {
      expect(box.width).toBeGreaterThan(520);
    }

    const cancelBtn = dialog.getByRole("button", { name: "Cancelar" });
    await cancelBtn.click();
    await expect(dialog).toBeHidden();
  });

  test("Modal de detalhes de lead: abre centralizado com overlay e fecha", async ({ page }) => {
    await mockWorkspaceWithLeads(page);
    await page.goto("/workspace/project-1/prospects");

    const leadRow = page.getByRole("button", { name: /Restaurante Sabor & Arte/i });
    await expect(leadRow).toBeVisible();
    await leadRow.click();

    const dialog = page.getByRole("dialog");
    await verifyModalPositionAndOverlay(page, dialog);
    await expect(dialog.getByText("Restaurante Sabor & Arte")).toBeVisible();

    // Close
    const closeBtn = dialog.getByRole("button", { name: "Fechar detalhes" });
    await closeBtn.click();
    await expect(dialog).toBeHidden();
  });
});
