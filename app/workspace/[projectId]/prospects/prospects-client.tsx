"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import seedLeads from "../../../../data/restaurantes.json";
import { taskboardFetch } from "../../../lib/taskboard";
import { WorkspaceIcon, WorkspaceRail } from "../../components/workspace-ui";
const LeadMap = dynamic(() => import("./lead-map"), {
  ssr: false,
  loading: () => <div className="prospects-map prospects-map-loading" aria-label="Carregando mapa" />,
});

type Status = "new" | "contacted" | "no_response" | "interested" | "proposal" | "customer" | "discarded";
type ActivityType = "whatsapp" | "phone" | "email" | "meeting" | "note";
type Member = { id: string; alias?: string; email: string; role: "owner" | "editor" | "viewer" };
type Project = { id: string; name: string; owner_id: string };
type Lead = {
  id: string;
  project_id: string;
  source_key?: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  preferred_channel?: string;
  city: string;
  state: string;
  category?: string;
  address?: string;
  neighborhood?: string;
  rating?: number | null;
  rating_source?: string;
  website?: string;
  website_label?: string;
  map_url?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  location_precision?: string;
  status: Status;
  assignee_id?: string;
  next_contact_at?: string;
  last_contact_at?: string;
  created_at: string;
  updated_at: string;
};
type Activity = { id: string; lead_id: string; author_id: string; type: ActivityType; body: string; status_after?: Status; created_at: string };
type Draft = {
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  preferred_channel: string;
  city: string;
  state: string;
  category: string;
  address: string;
  neighborhood: string;
  rating: string;
  rating_source: string;
  website: string;
  website_label: string;
  map_url: string;
  notes: string;
  status: Status;
  assignee_id: string;
  next_contact_at: string;
};

const statuses: { value: Status; label: string }[] = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contato iniciado" },
  { value: "no_response", label: "Sem retorno" },
  { value: "interested", label: "Interessado" },
  { value: "proposal", label: "Proposta enviada" },
  { value: "customer", label: "Cliente" },
  { value: "discarded", label: "Descartado" },
];

const activityTypes: { value: ActivityType; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Reunião" },
  { value: "note", label: "Nota" },
];

const PAGE_SIZE = 7;

const emptyDraft: Draft = {
  name: "", contact_name: "", phone: "", email: "", preferred_channel: "", city: "", state: "", category: "",
  address: "", neighborhood: "", rating: "", rating_source: "", website: "", website_label: "", map_url: "", notes: "",
  status: "new", assignee_id: "", next_contact_at: "",
};

function statusLabel(status: Status) {
  return statuses.find((item) => item.value === status)?.label || status;
}

function displayMember(member?: Member) {
  return member?.alias || member?.email || "Membro removido";
}

function draftFromLead(lead: Lead): Draft {
  return {
    name: lead.name, contact_name: lead.contact_name || "", phone: lead.phone || "", email: lead.email || "",
    preferred_channel: lead.preferred_channel || "", city: lead.city, state: lead.state, category: lead.category || "",
    address: lead.address || "", neighborhood: lead.neighborhood || "", rating: lead.rating == null ? "" : String(lead.rating),
    rating_source: lead.rating_source || "", website: lead.website || "", website_label: lead.website_label || "",
    map_url: lead.map_url || "", notes: lead.notes || "", status: lead.status, assignee_id: lead.assignee_id || "",
    next_contact_at: lead.next_contact_at || "",
  };
}

function formatDate(value?: string) {
  if (!value) return "Ainda não registrado";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function ProspectsClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [currentUserID, setCurrentUserID] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedLeadID, setSelectedLeadID] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "pipeline">("map");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [leadModal, setLeadModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [activityBody, setActivityBody] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("whatsapp");
  const [activityStatus, setActivityStatus] = useState<Status | "">("");
  const [page, setPage] = useState(1);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadID) || null;
  const readOnly = members.find((member) => member.id === currentUserID)?.role === "viewer";

  useEffect(() => {
    const storedToken = window.localStorage.getItem("taskboard_token");
    if (!storedToken) {
      router.replace("/login");
      return;
    }
    setToken(storedToken);
  }, [router]);

  const loadLeadData = useCallback(async (accessToken: string) => {
    setLoading(true);
    try {
      const [projectResponse, memberResponse, leadResponse, userResponse] = await Promise.all([
        taskboardFetch<{ project: Project }>(`/api/projects/${projectId}`, accessToken),
        taskboardFetch<{ members: Member[] }>(`/api/projects/${projectId}/members`, accessToken),
        taskboardFetch<{ leads: Lead[] }>(`/api/projects/${projectId}/leads`, accessToken),
        taskboardFetch<{ user: { id: string } }>("/api/auth/me", accessToken),
      ]);
      setProject(projectResponse.project);
      setMembers(memberResponse.members);
      setLeads(leadResponse.leads);
      setCurrentUserID(userResponse.user.id);
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes("token")) {
        window.localStorage.removeItem("taskboard_token");
        router.replace("/login");
      } else {
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar a prospecção.");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    if (token) void loadLeadData(token);
  }, [loadLeadData, token]);

  useEffect(() => {
    if (!token || !selectedLeadID) {
      setActivities([]);
      return;
    }
    taskboardFetch<{ activities: Activity[] }>(`/api/leads/${selectedLeadID}/activities`, token)
      .then((response) => setActivities(response.activities))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar o histórico."));
  }, [selectedLeadID, token]);

  const cityOptions = useMemo(() => [...new Set(leads.map((lead) => lead.city))].sort((a, b) => a.localeCompare(b, "pt-BR")), [leads]);
  const categoryOptions = useMemo(() => [...new Set(leads.map((lead) => lead.category || "").filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b, "pt-BR")), [leads]);
  const filteredLeads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return leads.filter((lead) => {
      const haystack = [lead.name, lead.contact_name, lead.phone, lead.email, lead.city, lead.category, lead.address, lead.neighborhood, lead.notes].join(" ").toLocaleLowerCase("pt-BR");
      return (!query || haystack.includes(query)) && (!city || lead.city === city) && (!status || lead.status === status) && (!category || lead.category === category);
    });
  }, [category, city, leads, search, status]);
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleLeads = filteredLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setSelectedLeadID(null);
  }, [search, city, status, category]);

  const updateDraft = (field: keyof Draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  function openCreate() {
    setDraft(emptyDraft);
    setLeadModal("create");
    setError("");
  }

  function openEdit() {
    if (!selectedLead) return;
    setDraft(draftFromLead(selectedLead));
    setLeadModal("edit");
    setError("");
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !draft.name.trim() || !draft.city.trim()) return;
    setSaving(true);
    setError("");
    const current = leadModal === "edit" ? selectedLead : null;
    const payload = {
      ...(current ? { id: current.id, latitude: current.latitude, longitude: current.longitude, location_precision: current.location_precision } : {}),
      ...draft,
      rating: draft.rating ? Number(draft.rating.replace(",", ".")) : null,
      status: draft.status || "new",
      location_precision: current?.location_precision || "unknown",
    };
    try {
      const response = current
        ? await taskboardFetch<{ lead: Lead }>(`/api/leads/${current.id}`, token, { method: "PATCH", body: JSON.stringify(payload) })
        : await taskboardFetch<{ lead: Lead }>(`/api/projects/${projectId}/leads`, token, { method: "POST", body: JSON.stringify(payload) });
      setLeads((currentLeads) => current ? currentLeads.map((lead) => lead.id === current.id ? response.lead : lead) : [...currentLeads, response.lead]);
      setSelectedLeadID(response.lead.id);
      setLeadModal(null);
      setNotice(current ? "Lead atualizado." : "Lead cadastrado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o lead.");
    } finally {
      setSaving(false);
    }
  }

  async function importSeed() {
    if (!token || readOnly) return;
    setImporting(true);
    setError("");
    try {
      const response = await taskboardFetch<{ leads: Lead[]; created: number; skipped: number }>(`/api/projects/${projectId}/leads/import`, token, {
        method: "POST",
        body: JSON.stringify({ leads: seedLeads }),
      });
      setLeads((current) => [...current, ...response.leads]);
      setNotice(`Base importada: ${response.created} novos e ${response.skipped} já existentes.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível importar a base.");
    } finally {
      setImporting(false);
    }
  }

  async function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedLead || !activityBody.trim() || readOnly) return;
    try {
      const response = await taskboardFetch<{ activity: Activity }>(`/api/leads/${selectedLead.id}/activities`, token, {
        method: "POST",
        body: JSON.stringify({ type: activityType, body: activityBody, status_after: activityStatus || undefined }),
      });
      setActivities((current) => [response.activity, ...current]);
      if (activityStatus) setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, status: activityStatus } : lead));
      setActivityBody("");
      setActivityStatus("");
      setNotice("Contato registrado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar o contato.");
    }
  }

  async function deleteSelected() {
    if (!token || !selectedLead || readOnly || !window.confirm(`Excluir o cadastro de ${selectedLead.name}?`)) return;
    try {
      await taskboardFetch(`/api/leads/${selectedLead.id}`, token, { method: "DELETE" });
      setLeads((current) => current.filter((lead) => lead.id !== selectedLead.id));
      setSelectedLeadID(null);
      setNotice("Cadastro excluído.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o cadastro.");
    }
  }

  function downloadCSV() {
    const headers = ["nome", "cidade", "estado", "categoria", "endereco", "bairro", "telefone", "email", "status", "responsavel", "proximo_contato", "observacoes", "google_maps"];
    const lines = [headers, ...filteredLeads.map((lead) => [lead.name, lead.city, lead.state, lead.category, lead.address, lead.neighborhood, lead.phone, lead.email, statusLabel(lead.status), displayMember(members.find((member) => member.id === lead.assignee_id)), lead.next_contact_at, lead.notes, lead.map_url])].map((row) => row.map(csvCell).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "prospeccao_restaurantes.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const metrics = {
    total: leads.length,
    new: leads.filter((lead) => lead.status === "new").length,
    noResponse: leads.filter((lead) => lead.status === "no_response").length,
    customers: leads.filter((lead) => lead.status === "customer").length,
  };

  if (loading) {
    return <main className="workspace-page"><div className="workspace-loading prospects-loading"><div className="workspace-skeleton workspace-skeleton-title" /><div className="workspace-skeleton prospects-loading-map" /></div></main>;
  }

  return (
    <main className="workspace-page prospects-page">
      <div className="workspace-layout">
        <WorkspaceRail mode="prospects" projectId={projectId} onLogout={() => { window.localStorage.removeItem("taskboard_token"); router.push("/login"); }} />
        <section className="prospects-main">
          {error ? <div className="workspace-error" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div> : null}
          {notice ? <div className="prospects-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div> : null}
          <header className="prospects-heading">
            <div>
              <Link className="prospects-back" href="/workspace"><WorkspaceIcon name="back" />Voltar ao workspace</Link>
              <span className="workspace-kicker">{project?.name || "Projeto"} · prospecção</span>
              <h1>Mapa de restaurantes</h1>
              <p>Veja onde estão os negócios e organize o próximo contato comercial em um só lugar.</p>
            </div>
            <div className="prospects-actions">
              <button className="workspace-secondary-action" type="button" onClick={downloadCSV} disabled={!filteredLeads.length}>Baixar CSV</button>
              <button className="workspace-secondary-action" type="button" onClick={() => void importSeed()} disabled={readOnly || importing}>{importing ? "Importando…" : "Importar base inicial"}</button>
              <button className="workspace-primary-action" type="button" onClick={openCreate} disabled={readOnly}><WorkspaceIcon name="plus" />Novo lead</button>
            </div>
          </header>

          <section className="prospects-metrics" aria-label="Resumo da prospecção">
            <div><strong>{metrics.total}</strong><span>leads na base</span></div>
            <div><strong>{metrics.new}</strong><span>novos</span></div>
            <div><strong>{metrics.noResponse}</strong><span>sem retorno</span></div>
            <div><strong>{metrics.customers}</strong><span>clientes</span></div>
          </section>

          <section className="prospects-filters" aria-label="Filtros da prospecção">
            <label className="prospects-search"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone, bairro…" /></label>
            <label><span>Cidade</span><select value={city} onChange={(event) => setCity(event.target.value)}><option value="">Todas</option>{cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          </section>

          <div className="prospects-view-bar"><div><strong>{filteredLeads.length}</strong> {filteredLeads.length === 1 ? "resultado" : "resultados"}</div><div className="prospects-view-toggle"><button className={view === "map" ? "active" : ""} type="button" onClick={() => setView("map")}><WorkspaceIcon name="mapPin" />Mapa</button><button className={view === "pipeline" ? "active" : ""} type="button" onClick={() => setView("pipeline")}><WorkspaceIcon name="board" />Pipeline</button></div></div>

          {view === "map" ? <div className="prospects-map-layout"><LeadMap leads={visibleLeads} selectedLeadId={selectedLeadID} onSelect={setSelectedLeadID} /><aside className="prospects-list" aria-label="Restaurantes filtrados"><div className="prospects-list-header"><span>Restaurantes</span><small>Selecione um ponto para ver detalhes</small></div>{visibleLeads.map((lead) => <button className={`prospect-row ${selectedLeadID === lead.id ? "active" : ""}`} type="button" key={lead.id} onClick={() => setSelectedLeadID(lead.id)}><span className={`prospect-status-dot ${lead.status}`} /><span className="prospect-row-copy"><strong>{lead.name}</strong><small>{lead.city} · {lead.category || "Sem categoria"}</small></span><span className="prospect-row-arrow">›</span></button>)}{!filteredLeads.length ? <div className="prospects-empty">Nenhum lead corresponde aos filtros.</div> : null}</aside></div> : <div className="prospects-pipeline">{statuses.map((column) => { const columnLeads = visibleLeads.filter((lead) => lead.status === column.value); return <section className="prospects-column" key={column.value}><div className="prospects-column-heading"><span className={`prospect-status-dot ${column.value}`} /><h2>{column.label}</h2><b>{columnLeads.length}</b></div><div className="prospects-column-stack">{columnLeads.map((lead) => <button type="button" className="prospect-pipeline-card" key={lead.id} onClick={() => setSelectedLeadID(lead.id)}><strong>{lead.name}</strong><span>{lead.city} · {lead.category || "Sem categoria"}</span>{lead.next_contact_at ? <small>Retorno em {formatDate(lead.next_contact_at)}</small> : null}</button>)}{!columnLeads.length ? <div className="prospects-column-empty">Nenhum lead</div> : null}</div></section>; })}</div>}
          {filteredLeads.length > PAGE_SIZE ? <nav className="prospects-pagination" aria-label="Paginação de restaurantes"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>Anterior</button><span>Página {currentPage} de {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Próxima</button></nav> : null}
        </section>
      </div>
      {selectedLead ? <div className="workspace-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedLeadID(null); }}><section className="workspace-modal prospects-detail-modal" role="dialog" aria-modal="true" aria-labelledby="prospect-detail-title"><div className="workspace-modal-header"><div><span className="workspace-kicker">{statusLabel(selectedLead.status)}</span><h2 id="prospect-detail-title">{selectedLead.name}</h2></div><button className="workspace-panel-close" type="button" onClick={() => setSelectedLeadID(null)} aria-label="Fechar detalhes"><WorkspaceIcon name="close" /></button></div><div className="prospect-detail-content"><div className="prospect-detail-meta"><span>{selectedLead.city} · {selectedLead.state}</span><span>{selectedLead.category || "Categoria não informada"}</span></div><div className="prospect-detail-links">{selectedLead.phone && !["Não localizado", "Não confirmado"].includes(selectedLead.phone) ? <a href={`tel:${selectedLead.phone.replace(/\D/g, "")}`}>{selectedLead.phone}</a> : null}{selectedLead.website ? <a href={selectedLead.website} target="_blank" rel="noreferrer">{selectedLead.website_label || "Website"}</a> : null}{selectedLead.map_url ? <a href={selectedLead.map_url} target="_blank" rel="noreferrer">Abrir no Maps</a> : null}</div><p className="prospect-address">{selectedLead.address || selectedLead.neighborhood || "Localização aproximada pela cidade"}</p><div className="prospect-detail-grid"><div><span>Responsável</span><strong>{selectedLead.assignee_id ? displayMember(members.find((member) => member.id === selectedLead.assignee_id) as Member) : "Sem responsável"}</strong></div><div><span>Próximo contato</span><strong>{formatDate(selectedLead.next_contact_at)}</strong></div><div><span>Último contato</span><strong>{formatDate(selectedLead.last_contact_at)}</strong></div><div><span>Nota pública</span><strong>{selectedLead.rating ? `★ ${selectedLead.rating.toFixed(1).replace(".", ",")}` : "Não informada"}</strong></div></div>{selectedLead.notes ? <div className="prospect-notes"><span>Observações</span><p>{selectedLead.notes}</p></div> : null}<div className="prospect-detail-actions"><button className="edit-cancel-button" type="button" onClick={openEdit} disabled={readOnly}>Editar cadastro</button><button className="edit-cancel-button danger-action" type="button" onClick={() => void deleteSelected()} disabled={readOnly}>Excluir</button></div><div className="prospect-history"><div className="prospect-history-heading"><div><span className="workspace-kicker">Histórico</span><h3>Contatos e notas</h3></div><span>{activities.length}</span></div>{!readOnly ? <form className="prospect-activity-form" onSubmit={addActivity}><div className="prospect-activity-fields"><select value={activityType} onChange={(event) => setActivityType(event.target.value as ActivityType)} aria-label="Tipo de contato">{activityTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={activityStatus} onChange={(event) => setActivityStatus(event.target.value as Status | "")} aria-label="Atualizar status"><option value="">Manter status</option>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><textarea value={activityBody} onChange={(event) => setActivityBody(event.target.value)} placeholder="O que aconteceu neste contato?" rows={3} required /><button className="workspace-primary-action" type="submit">Registrar contato</button></form> : null}<div className="prospect-activity-list">{activities.map((activity) => <article key={activity.id}><div><strong>{activityTypes.find((item) => item.value === activity.type)?.label || activity.type}</strong><small>{formatDate(activity.created_at)}{activity.status_after ? ` · ${statusLabel(activity.status_after)}` : ""}</small></div><p>{activity.body}</p></article>)}{!activities.length ? <p className="prospect-history-empty">Nenhum contato registrado ainda.</p> : null}</div></div></div></section></div> : null}

      {leadModal ? <div className="workspace-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setLeadModal(null); }}><section className="workspace-modal prospect-form-modal" role="dialog" aria-modal="true" aria-labelledby="prospect-form-title"><div className="workspace-modal-header"><div><span className="workspace-kicker">{leadModal === "create" ? "Novo lead" : "Cadastro comercial"}</span><h2 id="prospect-form-title">{leadModal === "create" ? "Cadastrar restaurante" : "Editar cadastro"}</h2></div><button className="workspace-panel-close" type="button" onClick={() => setLeadModal(null)} aria-label="Fechar formulário"><WorkspaceIcon name="close" /></button></div><form className="task-modal-form" onSubmit={saveLead}><div className="prospect-form-grid"><label>Restaurante<input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} autoFocus required /></label><label>Pessoa de contato<input value={draft.contact_name} onChange={(event) => updateDraft("contact_name", event.target.value)} placeholder="Opcional" /></label><label>Telefone ou WhatsApp<input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} /></label><label>Email<input type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></label><label>Cidade<input value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} required /></label><label>Estado<input maxLength={2} value={draft.state} onChange={(event) => updateDraft("state", event.target.value.toUpperCase())} placeholder="UF" /></label><label>Categoria<input value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} /></label><label>Canal preferido<select value={draft.preferred_channel} onChange={(event) => updateDraft("preferred_channel", event.target.value)}><option value="">Não definido</option><option value="whatsapp">WhatsApp</option><option value="phone">Telefone</option><option value="email">Email</option><option value="instagram">Instagram</option><option value="other">Outro</option></select></label><label className="prospect-form-wide">Endereço<input value={draft.address} onChange={(event) => updateDraft("address", event.target.value)} /></label><label>Bairro<input value={draft.neighborhood} onChange={(event) => updateDraft("neighborhood", event.target.value)} /></label><label>Status<select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as Status)}>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Responsável<select value={draft.assignee_id} onChange={(event) => updateDraft("assignee_id", event.target.value)}><option value="">Sem responsável</option>{members.map((member) => <option value={member.id} key={member.id}>{displayMember(member)}</option>)}</select></label><label>Próximo contato<input type="date" value={draft.next_contact_at} onChange={(event) => updateDraft("next_contact_at", event.target.value)} /></label><label>Website ou Instagram<input value={draft.website} onChange={(event) => updateDraft("website", event.target.value)} /></label><label>Nota pública<input inputMode="decimal" value={draft.rating} onChange={(event) => updateDraft("rating", event.target.value)} placeholder="Ex.: 4,8" /></label><label className="prospect-form-wide">Observações<textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} rows={4} placeholder="Contexto do contato, oportunidade e próximos passos" /></label></div><div className="workspace-modal-actions"><button className="edit-cancel-button" type="button" onClick={() => setLeadModal(null)}>Cancelar</button><button className="edit-save-button" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar cadastro"}</button></div></form></section></div> : null}
    </main>
  );
}
