import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link className="legal-back" href="/">← Voltar para a RaccoonSoftwares</Link>
      <article className="legal-card">
        <span className="legal-kicker">RaccoonSoftwares</span>
        <h1>Política de privacidade</h1>
        <p className="legal-lead">Esta página explica, de forma resumida, como tratamos informações quando você entra em contato com a RaccoonSoftwares.</p>
        <h2>Dados enviados por você</h2>
        <p>Usamos os dados que você decidir compartilhar em uma conversa para entender sua operação, responder ao contato e preparar uma proposta adequada. Não vendemos essas informações.</p>
        <h2>Uso e armazenamento</h2>
        <p>Tratamos apenas o que for necessário para responder, prestar o serviço ou cumprir uma obrigação legal. O período de armazenamento depende da finalidade do contato e das exigências aplicáveis.</p>
        <h2>Seus direitos</h2>
        <p>Você pode pedir informações sobre o tratamento dos seus dados, solicitar correção ou pedir a exclusão quando não houver obrigação de retenção.</p>
        <h2>Atualizações</h2>
        <p>Esta política pode ser atualizada para refletir mudanças no serviço ou na legislação. A versão publicada nesta página é a referência atual.</p>
      </article>
    </main>
  );
}
