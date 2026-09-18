import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link className="legal-back" href="/">← Voltar para a RaccoonSoftwares</Link>
      <article className="legal-card">
        <span className="legal-kicker">RaccoonSoftwares</span>
        <h1>Termos de uso</h1>
        <p className="legal-lead">Estes termos descrevem as condições gerais para usar o site e iniciar uma conversa comercial com a RaccoonSoftwares.</p>
        <h2>Uso do site</h2>
        <p>Você pode navegar e compartilhar informações verdadeiras para solicitar contato. O conteúdo do site é informativo e não representa uma proposta comercial fechada.</p>
        <h2>Escopo e proposta</h2>
        <p>O escopo, o prazo, o investimento e o suporte de cada projeto são definidos em uma proposta específica antes do início do trabalho.</p>
        <h2>Conteúdo</h2>
        <p>Textos, marcas e materiais apresentados nesta página pertencem à RaccoonSoftwares ou são usados com autorização. Não copie ou redistribua materiais sem permissão.</p>
        <h2>Atualizações</h2>
        <p>Podemos atualizar o site, estes termos e os serviços descritos para acompanhar mudanças no negócio. A versão publicada nesta página é a referência atual.</p>
      </article>
    </main>
  );
}
