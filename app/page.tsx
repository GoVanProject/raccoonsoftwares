"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type IconName =
  | "arrow"
  | "arrowUp"
  | "bot"
  | "box"
  | "chart"
  | "check"
  | "chevron"
  | "clock"
  | "code"
  | "command"
  | "cube"
  | "heart"
  | "instagram"
  | "layers"
  | "link"
  | "mail"
  | "menu"
  | "moon"
  | "play"
  | "plus"
  | "send"
  | "spark"
  | "sun"
  | "users"
  | "zap";

function Icon({ name, size = 18, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    arrowUp: <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>,
    bot: <><rect x="5" y="7" width="14" height="11" rx="3" /><path d="M9 3v4M15 3v4M8.5 12h.01M15.5 12h.01M9 15h6" /></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.5 7.5 4 7.5-4M12 11.5V21" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,
    command: <><path d="M18 5a3 3 0 1 0-3 3h4v4a3 3 0 1 0 3-3" /><path d="M6 19a3 3 0 1 0 3-3H5v-4a3 3 0 1 0-3 3" /><path d="M9 16 15 8" /></>,
    cube: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M12 12 4 7.5M12 12l8-4.5M12 12v9" /></>,
    heart: <path d="M20.8 4.6c-1.5-1.5-4-1.5-5.5 0L12 7.9 8.7 4.6a3.9 3.9 0 0 0-5.5 5.5L12 19l8.8-8.9a3.9 3.9 0 0 0 0-5.5Z" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r=".7" fill="currentColor" stroke="none" /></>,
    layers: <><path d="m12 2 8 4-8 4-8-4 8-4Z" /><path d="m4 10 8 4 8-4M4 14l8 4 8-4" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    moon: <path d="M20.7 14.1A8.3 8.3 0 0 1 9.9 3.3a8.5 8.5 0 1 0 10.8 10.8Z" />,
    play: <path d="m9 7 8 5-8 5V7Z" fill="currentColor" stroke="none" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    send: <><path d="m21 3-7.5 18-3.7-7.1L3 10.2 21 3Z" /><path d="M9.8 13.9 21 3" /></>,
    spark: <><path d="m13 2-9 13h7l-1 7 9-13h-7l1-7Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41" /></>,
    users: <><circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c0-4 2.7-7 6-7s6 3 6 7M15 14c3 0 5 2.2 5 5" /></>,
    zap: <><path d="m13 2-9 13h7l-1 7 9-13h-7l1-7Z" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function ButtonLink({
  children,
  href,
  ghost = false,
  className = "",
}: {
  children: React.ReactNode;
  href: string;
  ghost?: boolean;
  className?: string;
}) {
  return (
    <a className={`btn ${ghost ? "btn-ghost" : "btn-primary"} ${className}`} href={href}>
      {children}
    </a>
  );
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button className="theme-toggle" type="button" onClick={onToggle} aria-label="Alternar tema" title="Alternar tema">
      <span className={`theme-icon ${!dark ? "active" : ""}`}><Icon name="sun" size={15} /></span>
      <span className={`theme-icon ${dark ? "active" : ""}`}><Icon name="moon" size={15} /></span>
    </button>
  );
}

function Brand() {
  return (
    <span className="brand" aria-label="RaccoonTech">
      <Image className="brand-mark" src="/raccoon-mascot.webp" width={42} height={42} alt="Mascote guaxinim da RaccoonTech" priority />
      <span>
        <span className="brand-name">RaccoonTech</span>
        <span className="brand-sub">IDEIAS EM SOLUÇÕES REAIS</span>
      </span>
    </span>
  );
}

function Header({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="nav">
      <a href="#top" className="brand-link"><Brand /></a>
      <nav className={`nav-links ${menuOpen ? "open" : ""}`} aria-label="Navegação principal">
        <a href="#solucoes" onClick={() => setMenuOpen(false)}>Soluções</a>
        <a href="#agentes" onClick={() => setMenuOpen(false)}>Agents</a>
        <a href="#projetos" onClick={() => setMenuOpen(false)}>Projetos</a>
        <a href="#processo" onClick={() => setMenuOpen(false)}>Como trabalhamos</a>
        <a href="#sobre" onClick={() => setMenuOpen(false)}>Sobre</a>
      </nav>
      <div className="actions">
        <a className="social-link header-social" href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram da RaccoonTech">
          <Icon name="instagram" size={17} />
        </a>
        <ThemeToggle dark={dark} onToggle={onToggle} />
        <ButtonLink href="#contato" className="header-cta">Fale conosco <Icon name="arrow" size={17} strokeWidth={2} /></ButtonLink>
        <button className="mobile-btn" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Abrir menu" aria-expanded={menuOpen}>
          <Icon name={menuOpen ? "plus" : "menu"} size={20} />
        </button>
      </div>
    </header>
  );
}

function Dashboard() {
  return (
    <div className="dashboard-wrap">
      <div className="dashboard-label"><span className="pulse-dot" /> workspace / overview</div>
      <div className="dashboard">
        <div className="dash-top">
          <strong><span className="dash-raccoon">🦝</span> RaccoonTech</strong>
          <div className="dash-tools"><span className="search-mini">⌕ Buscar...</span><span className="avatar-dot">A</span></div>
        </div>
        <div className="dash-grid">
          <div className="sidebar-mini">
            <div className="side-pill active"><span>⌂</span> Início</div>
            <div className="side-pill"><span>◫</span> Projetos</div>
            <div className="side-pill"><span>✦</span> Agents de IA</div>
            <div className="side-pill"><span>⌁</span> Automações</div>
            <div className="side-pill"><span>◎</span> Clientes</div>
            <div className="side-pill"><span>▥</span> Relatórios</div>
          </div>
          <div className="dash-content">
            <h3>Olá, vamos construir algo incrível?</h3>
            <p>Aqui estão os principais insights do seu negócio.</p>
            <div className="stats">
              <div className="stat"><span>Projetos ativos</span><b>12</b><em>+20%</em></div>
              <div className="stat"><span>Automações</span><b>28</b><em>+40%</em></div>
              <div className="stat"><span>Clientes</span><b>142</b><em>+18%</em></div>
            </div>
            <div className="chart-row">
              <div className="chart"><div className="chart-heading"><strong>Crescimento</strong><span>+70%</span></div><div className="chart-line"><i /></div><div className="chart-foot"><span>Jan</span><span>Fev</span><span>Mar</span><span>Abr</span></div></div>
              <div className="tasks"><strong>Tarefas</strong><div className="task done"><Icon name="check" size={9} strokeWidth={3} /> Finalizar integração</div><div className="task done"><Icon name="check" size={9} strokeWidth={3} /> Ajustes no CRM</div><div className="task"><span /> Reunião com cliente</div><div className="task"><span /> Publicar nova página</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <span className="eyebrow">Tecnologia que impulsiona</span>
        <h1>Transforme seu negócio com <span className="soft">IA, automação e produtos digitais.</span></h1>
        <p>Criamos agents de IA personalizados, CRMs para academias, dentistas e médicos, páginas sob medida e produtos digitais que resolvem problemas reais do seu negócio.</p>
        <div className="hero-cta">
          <ButtonLink href="#contato">Fale conosco <Icon name="arrow" size={17} strokeWidth={2} /></ButtonLink>
          <ButtonLink href="#agentes" ghost><Icon name="play" size={16} /> Ver como funciona</ButtonLink>
        </div>
        <div className="trust-row">
          <span className="trust-item"><Icon name="command" size={15} /> Soluções sob medida</span>
          <span className="trust-item"><Icon name="check" size={15} /> Entrega ágil</span>
          <span className="trust-item"><Icon name="heart" size={15} /> Parceria de longo prazo</span>
        </div>
      </div>
      <div className="hero-visual" aria-label="Demonstração de dashboard">
        <Image className="mascot" src="/raccoon-mascot.webp" width={900} height={844} alt="Guaxinim codando em um notebook" priority />
        <Dashboard />
        <span className="hero-note">Tecnologia<br />para um futuro<br /><em>mais simples.</em> <b>↘</b></span>
      </div>
    </section>
  );
}

const serviceData: { icon: IconName; tone: string; title: string; text: string }[] = [
  { icon: "bot", tone: "blue", title: "Agents personalizados", text: "Agents de IA treinados para atendimento, vendas, suporte, rotinas internas e automações." },
  { icon: "heart", tone: "red", title: "CRM para clínicas e academias", text: "Gestão de clientes, agenda, acompanhamento, histórico, tarefas e automações em um só lugar." },
  { icon: "link", tone: "purple", title: "Páginas personalizadas", text: "Links na bio, páginas de captura, perfis profissionais e sites institucionais com a sua identidade." },
  { icon: "cube", tone: "blue", title: "Produtos sob medida", text: "Sistemas web e ferramentas internas pensadas para resolver desafios específicos do seu negócio." },
];

function SectionHeading({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <div className="section-head">
      <div><div className="section-kicker">{kicker}</div><h2>{title}</h2></div>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function ServicePreview({ index }: { index: number }) {
  if (index === 0) {
    return <div className="mini-ui mini-agent"><Image className="mini-avatar" src="/raccoon-mascot.webp" width={50} height={50} alt="" /><span>Olá! Como posso ajudar você hoje?</span><div className="mini-dots"><i /><i /><i /></div><button aria-label="Abrir agent"><Icon name="arrow" size={14} /></button></div>;
  }
  if (index === 1) {
    return <div className="mini-ui mini-clients"><div className="mini-ui-title"><span>Clientes</span><b><Icon name="plus" size={11} /> Novo</b></div><div className="client-row"><span className="client-avatar amber">JS</span><span>João Silva<small>Musculação</small></span><em>Ativo</em></div><div className="client-row"><span className="client-avatar coral">MC</span><span>Mariana Costa<small>Consulta</small></span><em>Ativo</em></div></div>;
  }
  if (index === 2) {
    return <div className="mini-ui mini-profile"><div className="profile-head"><span className="profile-avatar">A</span><span><b>Seu Nome</b><small>@seunome</small></span></div><div className="profile-line">Meus serviços</div><div className="profile-line">Agendar horário</div><div className="profile-line">Fale no WhatsApp</div></div>;
  }
  return <div className="mini-ui device-mock"><div className="phone"><span /><i /></div><div className="screen"><Icon name="chart" size={18} /></div><div className="phone dark"><span /><i /></div></div>;
}

function Solutions() {
  return (
    <section className="section" id="solucoes">
      <SectionHeading kicker="Nossas soluções" title="Tudo que você precisa para crescer no mundo digital." text="Da estratégia à implementação, criamos soluções completas para automatizar processos, atender melhor e transformar ideias em produtos." />
      <div className="service-grid">
        {serviceData.map((service, index) => (
          <article className="service-card" key={service.title}>
            <div className={`icon-box ${service.tone}`}><Icon name={service.icon} size={20} /></div>
            <h3>{service.title}</h3>
            <p>{service.text}</p>
            <ServicePreview index={index} />
          </article>
        ))}
      </div>
    </section>
  );
}

const demoTabs = ["Atendimento", "Vendas", "Operação"];

function AgentDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [approved, setApproved] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setRunning(false), 2600);
    return () => window.clearTimeout(timer);
  }, [running]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    setCustomMessage(prompt.trim());
    setPrompt("");
    setApproved(false);
    setRunning(true);
  };

  return (
    <section className="section agent-section" id="agentes">
      <SectionHeading kicker="Demonstração de agents" title="Uma IA que mostra o trabalho enquanto resolve." text="Interfaces claras para acompanhar raciocínio, ferramentas acionadas e decisões que precisam de você." />
      <div className="agent-workspace">
        <div className="agent-window">
          <div className="window-top"><div className="window-title"><span className="agent-orb"><Icon name="spark" size={14} /></span><span><b>Ari</b><small>Agent de operação</small></span><em><i /> online</em></div><div className="window-dots"><i /><i /><i /></div></div>
          <div className="agent-tabs" role="tablist" aria-label="Tipos de agent">
            {demoTabs.map((tab, index) => <button key={tab} type="button" role="tab" aria-selected={activeTab === index} className={activeTab === index ? "active" : ""} onClick={() => setActiveTab(index)}>{tab}</button>)}
          </div>
          <div className="agent-chat">
            <div className="chat-time">HOJE, 10:42</div>
            <div className="user-message">{customMessage || ["Quero entender quais leads precisam de atenção hoje.", "Encontre oportunidades quentes e prepare uma abordagem.", "Organize as tarefas da equipe para esta manhã."][activeTab]}</div>
            <div className="agent-message">
              <div className="message-author"><span className="small-orb"><Icon name="spark" size={11} /></span><b>Ari</b><span>agora</span></div>
              {running ? <div className="thinking-line"><span className="thinking-shimmer">Pensando</span><i /><i /><i /></div> : <>
                <p>Analisei os dados recentes e encontrei um caminho para você começar com clareza.</p>
                <div className="reasoning-card"><div className="reasoning-head"><span className="status-check"><Icon name="check" size={11} strokeWidth={2.5} /></span><b>Plano de ação pronto</b><span>3 etapas</span></div><div className="tool-list"><span><Icon name="chart" size={12} /> CRM consultado <em>concluído</em></span><span><Icon name="users" size={12} /> 18 leads priorizados <em>concluído</em></span><span><Icon name="mail" size={12} /> Mensagem personalizada <em>aguardando</em></span></div></div>
                <p className="agent-answer">Separei 6 leads com maior intenção de compra e deixei uma abordagem inicial pronta para revisão.</p>
              </>}
            </div>
          </div>
          <form className="prompt-bar" onSubmit={handleSubmit}><button type="button" aria-label="Adicionar contexto"><Icon name="plus" size={16} /></button><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Peça algo para o seu agent..." aria-label="Mensagem para o agent" /><span className="prompt-hint">⌘ ↵</span><button className="send-button" type="submit" aria-label="Enviar mensagem"><Icon name="send" size={15} /></button></form>
        </div>
        <aside className="agent-sidebar">
          <div className="agent-side-card task-card">
            <div className="side-card-top"><span>Execução em andamento</span><span className="live-badge"><i /> Live</span></div>
            <h3>Preparando follow-up</h3>
            <p>O agent cruza histórico, intenção e contexto antes de sugerir uma ação.</p>
            <div className="progress-track"><span /></div>
            <div className="task-rows"><div className="task-row done"><span><Icon name="check" size={10} /></span><b>Entender o pedido</b><em>feito</em></div><div className="task-row done"><span><Icon name="check" size={10} /></span><b>Buscar dados no CRM</b><em>feito</em></div><div className={`task-row ${running ? "active" : ""}`}><span>{running ? <i className="loader" /> : <Icon name="clock" size={10} />}</span><b>Gerar recomendação</b><em>{running ? "agora" : "pronto"}</em></div></div>
          </div>
          <div className="agent-side-card approval-card"><div className="approval-icon"><Icon name="users" size={16} /></div><span className="section-kicker">Human in the loop</span><h3>{approved ? "Ação aprovada" : "Revisar antes de enviar?"}</h3><p>{approved ? "O agent pode seguir com a próxima etapa." : "Você mantém o controle de cada ação importante."}</p><button type="button" className={`approval-button ${approved ? "approved" : ""}`} onClick={() => setApproved((value) => !value)}><Icon name={approved ? "check" : "arrow"} size={14} /> {approved ? "Aprovado" : "Aprovar ação"}</button></div>
          <div className="side-stats"><span><b>14.8s</b><small>tempo poupado</small></span><span><b>94%</b><small>confiança</small></span></div>
        </aside>
      </div>
    </section>
  );
}

function Projects() {
  return (
    <section className="section" id="projetos">
      <SectionHeading kicker="Projetos em destaque" title="Histórias reais, resultados de verdade." text="Conheça alguns dos projetos que desenvolvemos e os resultados que ajudamos a alcançar." />
      <div className="projects">
        <article className="project-card"><div className="project-art"><div className="project-logo">GO<span className="accent">VAN</span></div><span className="project-arrow"><Icon name="arrow" size={14} /></span></div><div className="project-copy"><h3>GOVAN</h3><p>Sistema completo de gestão para academia, com CRM, agendamentos, planos e automações de atendimento.</p><a className="project-link" href="#contato">Conhecer projeto <Icon name="arrow" size={13} /></a></div></article>
        <article className="project-card"><div className="project-art divino"><div className="project-logo pedido">⌁<br /><small>Pedido</small> Divino</div><span className="project-arrow"><Icon name="arrow" size={14} /></span></div><div className="project-copy"><h3>Pedido Divino</h3><p>Plataforma de pedidos online para restaurantes, com cardápio digital, pagamento e gestão de entregas.</p><a className="project-link" href="#contato">Conhecer projeto <Icon name="arrow" size={13} /></a></div></article>
      </div>
    </section>
  );
}

const benefits: { icon: IconName; title: string; text: string }[] = [
  { icon: "zap", title: "Automação inteligente", text: "Menos tarefa repetitiva e mais tempo para o que importa." },
  { icon: "layers", title: "Integrações poderosas", text: "Conecte serviços e organize a operação em um fluxo único." },
  { icon: "chart", title: "Resultado mensurável", text: "Produtos construídos para gerar eficiência e valor real." },
  { icon: "users", title: "Suporte próximo", text: "Comunicação direta durante a construção e evolução do produto." },
];

function Process() {
  return <section className="section process-section" id="processo"><div className="section-head"><div><div className="section-kicker">Por que escolher a RaccoonTech?</div><h2>Mais do que tecnologia, um parceiro para o seu crescimento.</h2></div></div><div className="benefits">{benefits.map((benefit) => <div className="benefit" key={benefit.title}><div className="benefit-icon"><Icon name={benefit.icon} size={17} /></div><div><b>{benefit.title}</b><span>{benefit.text}</span></div></div>)}</div></section>;
}

function Footer() {
  return <footer id="sobre"><div className="footer-brand"><Brand /><span className="footer-copy">© 2026 RaccoonTech. Soluções digitais sob medida.</span></div><div className="footer-right"><span>Agents de IA · CRM · Web · Produtos digitais</span><a className="social-link" href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram da RaccoonTech"><Icon name="instagram" size={17} /></a></div></footer>;
}

export default function Home() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("raccoon-theme");
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved ? saved === "dark" : preferred;
    setDark(initial);
    document.documentElement.dataset.theme = initial ? "dark" : "light";
  }, []);

  const toggleTheme = () => {
    setDark((current) => {
      const next = !current;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      window.localStorage.setItem("raccoon-theme", next ? "dark" : "light");
      return next;
    });
  };

  return <main className="shell"><Header dark={dark} onToggle={toggleTheme} /><Hero /><Solutions /><AgentDemo /><Projects /><Process /><section className="cta" id="contato"><div className="section-kicker">Vamos construir?</div><h2>Transforme a próxima ideia do seu negócio em produto.</h2><p>Conte o que você precisa e começamos pela solução mais simples que gere resultado.</p><div className="cta-actions"><ButtonLink href="mailto:contato@seudominio.com">Fale conosco <Icon name="arrow" size={17} strokeWidth={2} /></ButtonLink><ButtonLink href="#projetos" ghost><Icon name="box" size={15} /> Ver nossos projetos</ButtonLink></div><span className="cta-note">Grandes ideias<br />começam com<br /><em>uma conversa.</em> ↗</span></section><Footer /></main>;
}
