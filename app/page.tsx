"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type IconName = "arrow" | "check" | "close" | "spark" | "shield" | "target" | "flow" | "clock" | "menu";
type Theme = "light" | "dark";

const whatsappMessage = encodeURIComponent("Olá, quero mapear uma automação para a minha operação.");
const configuredWhatsAppUrl = process.env.NEXT_PUBLIC_WHATSAPP_URL?.trim() ?? "";

function Icon({ name }: { name: IconName }) {
  const symbols: Record<IconName, string> = {
    arrow: "↗",
    check: "✓",
    close: "×",
    spark: "✦",
    shield: "◈",
    target: "◎",
    flow: "⌁",
    clock: "◷",
    menu: "≡",
  };

  return <span className={`text-icon text-icon-${name}`} aria-hidden="true">{symbols[name]}</span>;
}

function ButtonArrow() {
  return <Icon name="arrow" />;
}

function getWhatsAppHref() {
  if (!configuredWhatsAppUrl) return "";
  if (configuredWhatsAppUrl.includes("text=")) return configuredWhatsAppUrl;
  return `${configuredWhatsAppUrl}${configuredWhatsAppUrl.includes("?") ? "&" : "?"}text=${whatsappMessage}`;
}

function WhatsAppCta({ className = "", children = "Mapear minha automação" }: { className?: string; children?: ReactNode }) {
  const [error, setError] = useState(false);
  const href = getWhatsAppHref();
  const content = <>{children}<ButtonArrow /></>;

  return (
    <span className={`cta-wrap ${className}`}>
      {href ? (
        <a className="primary-button" href={href} target="_blank" rel="noreferrer" onClick={() => setError(false)}>{content}</a>
      ) : (
        <button className="primary-button" type="button" onClick={() => setError(true)}>{content}</button>
      )}
      {error ? <span className="cta-error" role="status">Configure o endereço do WhatsApp em `NEXT_PUBLIC_WHATSAPP_URL` para ativar esta conversa.</span> : null}
    </span>
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>{children}</div>;
}

function WordReveal({ text }: { text: string }) {
  return (
    <span className="word-reveal" aria-label={text}>
      {text.split(" ").map((word, index) => <Word key={`${word}-${index}`} word={word} index={index} />)}
    </span>
  );
}

function Word({ word, index }: { word: string; index: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.7, rootMargin: "0px 0px -12% 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <span ref={ref} className={`reveal-word ${visible ? "is-visible" : ""}`} style={{ transitionDelay: `${index * 70}ms` }}>{word} </span>;
}

function Brand() {
  return (
    <span className="brand" aria-label="RaccoonSoftwares">
      <span className="brand-mark"><Image src="/raccoon-mascot.webp" width={48} height={48} alt="" /></span>
      <span className="brand-copy"><strong>RaccoonSoftwares</strong><small>IDEIAS EM SOLUÇÕES REAIS</small></span>
    </span>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return <button className="theme-switch" type="button" onClick={onToggle} aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"} title={isDark ? "Ativar modo claro" : "Ativar modo escuro"} aria-pressed={isDark}><span aria-hidden="true">{isDark ? "☼" : "◐"}</span></button>;
}

function Header({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <Link href="#top" className="brand-link" onClick={closeMenu}><Brand /></Link>
      <nav className={`site-nav ${menuOpen ? "is-open" : ""}`} aria-label="Navegação principal">
        <a href="#solucoes" onClick={closeMenu}>Soluções</a>
        <a href="#processo" onClick={closeMenu}>Processo</a>
        <a href="#projetos" onClick={closeMenu}>Casos</a>
        <a href="#faq" onClick={closeMenu}>Perguntas</a>
        <div className="mobile-nav-cta"><WhatsAppCta /></div>
      </nav>
      <div className="header-actions">
        <a className="header-text-link" href="#sobre">Sobre</a>
        <ThemeToggle theme={theme} onToggle={onToggle} />
        <WhatsAppCta className="header-cta" />
        <button className={`menu-button ${menuOpen ? "is-open" : ""}`} type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}

function InteractiveMascot() {
  return <div className="mascot-stage mascot-stage-library">
    <Image
      src="/raccoon-hero.png"
      width={320}
      height={240}
      priority
      className="hero-raccoon-image"
      alt="Guaxinim apoiado em um galho"
    />
  </div>;
}

function DashboardPreview() {
  return (
    <div className="dashboard-preview" aria-label="Prévia de uma operação organizada em um workspace">
      <div className="dashboard-topbar"><span className="window-dots"><i /><i /><i /></span><span className="dashboard-url">workspace.raccoonsoftwares</span><span className="dashboard-avatar">A</span></div>
      <div className="dashboard-body">
        <aside className="dashboard-sidebar">
          <span className="dashboard-brand"><b>R</b> RaccoonSoftwares</span>
          <span className="dashboard-nav active"><Icon name="target" /> Visão geral</span>
          <span className="dashboard-nav"><Icon name="flow" /> Fluxos ativos</span>
          <span className="dashboard-nav"><Icon name="clock" /> Tarefas</span>
          <span className="dashboard-nav"><Icon name="shield" /> Aprovações</span>
          <span className="dashboard-sidebar-line" />
          <span className="dashboard-nav muted">Configurações</span>
        </aside>
        <div className="dashboard-main">
          <div className="dashboard-heading"><div><span className="dashboard-kicker">terça, 15 de setembro</span><h3>Bom dia, Ana.</h3><p>Veja o que merece sua atenção hoje.</p></div><span className="dashboard-status"><i /> operação estável</span></div>
          <div className="dashboard-metrics"><div><span>Leads priorizados</span><strong>38</strong><em>+12% nesta semana</em></div><div><span>Tarefas automáticas</span><strong>74</strong><em>21h poupadas</em></div><div><span>Aguardando revisão</span><strong>06</strong><em>3 precisam de você</em></div></div>
          <div className="dashboard-panels">
            <div className="dashboard-chart"><div className="panel-title"><b>Atividade da operação</b><span>últimos 7 dias</span></div><div className="chart-bars"><i style={{ height: "38%" }} /><i style={{ height: "54%" }} /><i style={{ height: "46%" }} /><i style={{ height: "72%" }} /><i style={{ height: "62%" }} /><i style={{ height: "84%" }} /><i style={{ height: "68%" }} /></div><div className="chart-labels"><span>seg</span><span>ter</span><span>qua</span><span>qui</span><span>sex</span><span>sáb</span><span>dom</span></div></div>
            <div className="dashboard-queue"><div className="panel-title"><b>Fila de revisão</b><span>ver tudo</span></div><div className="queue-item"><span className="queue-icon blue"><Icon name="spark" /></span><span><b>Follow up de lead</b><small>WhatsApp · agora</small></span><em>revisar</em></div><div className="queue-item"><span className="queue-icon orange"><Icon name="flow" /></span><span><b>Atualizar cadastro</b><small>CRM · há 8 min</small></span><em>revisar</em></div><div className="queue-item"><span className="queue-icon green"><Icon name="check" /></span><span><b>Enviar confirmação</b><small>Agenda · concluído</small></span><em className="done">feito</em></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero-section" id="top">
      <div className="hero-copy">
        <div className="hero-topline"><span className="eyebrow"><i /> IA e automação para negócios de serviços</span><span className="hero-index">RAC / 01</span></div>
        <h1>Automatize sua operação <span>sem perder o controle.</span></h1>
        <p className="hero-description">Criamos agents de IA e sistemas sob medida para negócios de serviços venderem, atenderem e operarem com menos trabalho manual.</p>
        <div className="hero-action-row"><WhatsAppCta /><span className="hero-action-note">Conversa inicial sem compromisso<br />pelo WhatsApp.</span></div>
        <div className="proof-line"><span className="proof-pip" /> Projetos reais para academias, restaurantes e operações de atendimento.</div>
      </div>
      <InteractiveMascot />
      <div className="hero-visual"><div className="visual-caption"><span>controle em um só lugar</span><span>RAC / WORKSPACE</span></div><DashboardPreview /><div className="visual-footnote"><span>O agent trabalha nos bastidores.</span><b>Você decide o próximo passo.</b></div></div>
    </section>
  );
}

function SectionIntro({ kicker, title, text, className = "" }: { kicker: string; title: string; text?: string; className?: string }) {
  return <div className={`section-intro ${className}`}><div className="section-intro-copy"><span className="section-kicker">{kicker}</span>{text ? <p>{text}</p> : null}</div><h2>{title}</h2></div>;
}

function Problem() {
  return (
    <section className="section problem-section" id="solucoes">
      <Reveal><SectionIntro kicker="O gargalo não é falta de esforço" title="Sua equipe não deveria perder o dia juntando pedaços da operação." text="Leads chegam pelo WhatsApp, dados ficam em planilhas e tarefas importantes dependem de alguém lembrar do próximo passo. A RaccoonSoftwares conecta esse fluxo para você recuperar contexto e tempo." /></Reveal>
      <div className="problem-grid">
        <Reveal className="problem-card" delay={80}><span className="problem-number">01</span><h3>Informação espalhada</h3><p>O histórico do cliente fica dividido entre conversas, planilhas e ferramentas que não se falam.</p><span className="problem-line" /></Reveal>
        <Reveal className="problem-card" delay={160}><span className="problem-number">02</span><h3>Rotina que se repete</h3><p>Sua equipe gasta energia copiando dados, conferindo status e cobrando respostas manualmente.</p><span className="problem-line" /></Reveal>
        <Reveal className="problem-card" delay={240}><span className="problem-number">03</span><h3>Decisão sem contexto</h3><p>Oportunidades importantes aparecem tarde porque ninguém tem uma visão clara do que está acontecendo.</p><span className="problem-line" /></Reveal>
      </div>
    </section>
  );
}

function Tagline() {
  return <section className="tagline-section" aria-label="Benefício principal"><span className="tagline-index">RAC / 02</span><p><WordReveal text="Menos tarefa repetitiva para sua equipe." /><br /><WordReveal text="Mais clareza para cada decisão importante." /></p></section>;
}

const benefits = [
  { icon: "flow" as IconName, title: "Reduza trabalho manual", text: "Automatize atendimento, follow up e rotinas internas sem criar mais uma tela para sua equipe." },
  { icon: "clock" as IconName, title: "Responda no tempo certo", text: "Priorize leads e clientes com base no histórico e no contexto de cada conversa." },
  { icon: "target" as IconName, title: "Conecte sua operação", text: "Reúna dados, tarefas e integrações em um fluxo único que todos conseguem acompanhar." },
  { icon: "shield" as IconName, title: "Mantenha o controle", text: "Ações importantes passam por revisão humana antes de qualquer envio ou mudança sensível." },
];

function Benefits() {
  return (
    <section className="section benefits-section">
      <Reveal><SectionIntro kicker="O que muda na prática" title="Tecnologia que tira peso da operação e devolve clareza para o time." /></Reveal>
      <div className="benefits-grid">{benefits.map((benefit, index) => <Reveal className="benefit-card" delay={index * 70} key={benefit.title}><span className="feature-icon"><Icon name={benefit.icon} /></span><span className="feature-index">0{index + 1}</span><h3>{benefit.title}</h3><p>{benefit.text}</p></Reveal>)}</div>
    </section>
  );
}

const processSteps = [
  { number: "01", title: "Mapeamos o gargalo", text: "Entendemos onde a operação perde tempo, contexto ou oportunidades importantes." },
  { number: "02", title: "Construímos o primeiro fluxo", text: "Entregamos a menor automação capaz de gerar valor real para a sua rotina." },
  { number: "03", title: "Medimos e evoluímos", text: "Ajustamos o sistema com base no uso e nos resultados observados pela equipe." },
];

function Process() {
  return (
    <section className="section process-section" id="processo">
      <Reveal><SectionIntro kicker="Como trabalhamos" title="Começamos pelo problema certo e evoluímos com a sua operação." text="Cada projeto nasce de um gargalo concreto. O primeiro fluxo precisa ser pequeno o bastante para sair do papel e útil o bastante para ser percebido." /></Reveal>
      <div className="process-grid">{processSteps.map((step, index) => <Reveal className="process-step" delay={index * 90} key={step.number}><span className="step-number">{step.number}</span><span className="step-connector" aria-hidden="true" /><h3>{step.title}</h3><p>{step.text}</p></Reveal>)}</div>
    </section>
  );
}

const demoScenes = [
  { label: "Atendimento", title: "Entender antes de responder", text: "O agent consulta o histórico, identifica a intenção e prepara uma resposta para sua revisão.", action: "Sugerir resposta" },
  { label: "Vendas", title: "Priorizar a próxima conversa", text: "O agent cruza interesse, momento e histórico para indicar qual lead merece atenção agora.", action: "Priorizar leads" },
  { label: "Operação", title: "Tirar a rotina do caminho", text: "O agent atualiza dados, cria tarefas e sinaliza exceções sem esconder o que fez.", action: "Organizar rotina" },
];

function AgentDemo() {
  const [activeScene, setActiveScene] = useState(0);
  const [running, setRunning] = useState(false);
  const [approved, setApproved] = useState(false);
  const scene = demoScenes[activeScene];

  function runDemo() {
    setRunning(true);
    setApproved(false);
    window.setTimeout(() => setRunning(false), 1100);
  }

  return (
    <section className="section agent-section" id="agentes">
      <Reveal><SectionIntro kicker="Veja o mecanismo" title="O agent cuida do próximo passo. A decisão continua sendo sua." text="Uma automação boa não esconde o processo. Ela mostra o contexto, sugere uma ação e deixa sua equipe aprovar o que importa." /></Reveal>
      <Reveal className="agent-demo" delay={120}>
        <div className="agent-tabs" role="tablist" aria-label="Exemplos de uso do agent">{demoScenes.map((item, index) => <button type="button" role="tab" aria-selected={activeScene === index} className={activeScene === index ? "active" : ""} onClick={() => { setActiveScene(index); setApproved(false); }} key={item.label}>{item.label}</button>)}</div>
        <div className="agent-demo-body">
          <div className="agent-chat"><span className="agent-label"><i /> agent em execução</span><div className="chat-message user-message">Novo contato pediu informações sobre o plano anual. Ele já conversou com a equipe duas vezes.</div><div className="chat-message agent-message"><span className="agent-avatar">R</span><div><b>{scene.title}</b><p>{scene.text}</p><span className="context-tags"><small>histórico</small><small>intenção</small><small>próxima ação</small></span></div></div><button className="demo-run-button" type="button" onClick={runDemo} disabled={running}>{running ? <><span className="button-loading-bar" /> analisando contexto</> : <><Icon name="spark" /> {scene.action}</>}</button></div>
          <aside className="agent-review"><span className="review-kicker">human in the loop</span><div className="review-icon"><Icon name="shield" /></div><h3>{approved ? "Ação aprovada" : "Revisar antes de enviar?"}</h3><p>{approved ? "O agent registrou sua aprovação e pode seguir para a próxima etapa." : "Você mantém o controle de cada ação importante antes que ela chegue ao cliente."}</p><button className={`review-button ${approved ? "approved" : ""}`} type="button" onClick={() => setApproved((current) => !current)}><Icon name={approved ? "check" : "arrow"} /> {approved ? "Aprovado" : "Aprovar ação"}</button></aside>
        </div>
      </Reveal>
    </section>
  );
}

function Projects() {
  return (
    <section className="section projects-section" id="projetos">
      <Reveal><SectionIntro kicker="Projetos que já saíram do papel" title="Construímos sistemas que cabem na operação real." text="Sem prometer números que ainda não foram medidos. Estes são exemplos factuais do tipo de produto que a RaccoonSoftwares coloca em funcionamento." /></Reveal>
      <div className="projects-grid">
        <Reveal className="project-card project-govan" delay={100}><div className="project-art"><span className="project-art-top">produto digital / 01</span><div className="govan-wordmark"><b>GO</b><span>VAN</span></div><span className="project-art-bottom">gestão para academia</span></div><div className="project-card-copy"><span className="project-type">GOVAN</span><h3>Gestão de academia em um só sistema.</h3><p>CRM, agendamentos, planos, tarefas e automações de atendimento reunidos em um workspace para a operação.</p></div></Reveal>
        <Reveal className="project-card project-pedido" delay={180}><div className="project-art"><span className="project-art-top">produto digital / 02</span><div className="pedido-wordmark"><span>⌁</span><b>Pedido<br />Divino</b></div><span className="project-art-bottom">pedidos para restaurante</span></div><div className="project-card-copy"><span className="project-type">Pedido Divino</span><h3>Um caminho mais claro entre cardápio e entrega.</h3><p>Cardápio digital, pedidos online, pagamento e gestão de entregas em uma experiência pensada para restaurantes.</p></div></Reveal>
      </div>
    </section>
  );
}

const faqs = [
  ["Para quais negócios a RaccoonSoftwares trabalha?", "Principalmente negócios de serviços com atendimento recorrente, vendas consultivas ou processos operacionais repetitivos, como academias, clínicas, consultórios e restaurantes."],
  ["O agent pode agir sozinho?", "Pode executar tarefas definidas, mas ações sensíveis podem exigir aprovação humana antes do envio. O nível de autonomia é combinado no desenho do fluxo."],
  ["O agent substitui minha equipe?", "Não. Ele reduz tarefas repetitivas para que a equipe se concentre em atendimento, relacionamento e decisões importantes."],
  ["É possível integrar com meu CRM ou sistema atual?", "Sim, desde que o sistema ofereça uma integração ou acesso técnico compatível. O diagnóstico inicial define o caminho mais seguro."],
  ["Preciso trocar todas as ferramentas que já uso?", "Não necessariamente. A prioridade é conectar e simplificar o que já funciona antes de propor uma troca."],
  ["Quanto custa uma implementação?", "O investimento depende do número de fluxos, integrações e nível de personalização. Depois do diagnóstico, a equipe apresenta uma proposta clara."],
  ["Quanto tempo leva para colocar a primeira automação no ar?", "O prazo depende do escopo e das integrações. O primeiro fluxo é definido com clareza antes de qualquer promessa de data."],
  ["Existe suporte depois da entrega?", "Sim. A proposta informa o que está incluído em suporte, manutenção e evolução contínua."],
];

function FAQ() {
  return (
    <section className="section faq-section" id="faq">
      <Reveal><SectionIntro kicker="Perguntas honestas" title="Antes de automatizar, você precisa saber como isso vai funcionar." /></Reveal>
      <div className="faq-list">{faqs.map(([question, answer], index) => <Reveal className="faq-item" delay={index * 40} key={question}><details><summary><span>{question}</span><b aria-hidden="true">+</b></summary><p>{answer}</p></details></Reveal>)}</div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="final-cta" id="contato">
      <Reveal><span className="section-kicker">O próximo passo começa pequeno</span><h2>Conte onde sua operação perde tempo.</h2><p>A conversa inicial é sem compromisso. A gente entende o gargalo e aponta o fluxo mais simples para começar.</p><WhatsAppCta /></Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer" id="sobre">
      <div className="footer-main"><Brand /><p>IA e automação para negócios de serviços que querem operar com mais clareza.</p></div>
      <div className="footer-links"><span className="footer-label">Navegue</span><a href="#solucoes">Soluções</a><a href="#processo">Processo</a><a href="#projetos">Casos</a><a href="#faq">Perguntas</a></div>
      <div className="footer-links"><span className="footer-label">Informações</span><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link><a href="#contato">WhatsApp</a></div>
      <div className="footer-bottom"><span>© 2026 RaccoonSoftwares</span><span>Feito para transformar ideias em soluções reais.</span></div>
    </footer>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("raccoon-theme");
    const initialTheme: Theme = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme: Theme = current === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem("raccoon-theme", nextTheme);
      return nextTheme;
    });
  }

  return (
    <main className="landing-page">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <div className="landing-shell">
        <Header theme={theme} onToggle={toggleTheme} />
        <div id="conteudo"><Hero /><Problem /><Tagline /><Benefits /><Process /><AgentDemo /><Projects /><FAQ /><FinalCTA /></div>
        <Footer />
      </div>
    </main>
  );
}
