import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-8 text-[#f5f5f2] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-[840px]">
      <Link className="inline-block text-sm leading-5 text-[#a5a5a0] transition-[color,transform] duration-700 ease-product hover:-translate-x-1 hover:text-[#f5f5f2] focus-visible:-translate-x-1 focus-visible:text-[#f5f5f2]" href="/">← Voltar para a RaccoonSoftwares</Link>
      <article className="mt-8 rounded-2xl border border-white/15 bg-[#181818] p-6 sm:mt-12 sm:p-12">
        <span className="text-xs font-bold tracking-[0.08em] text-[#ffb168] uppercase">RaccoonSoftwares</span>
        <h1 className="my-4 mb-6 text-4xl leading-none font-semibold tracking-[-0.07em] text-balance sm:text-5xl">Política de privacidade</h1>
        <p className="mb-8 text-lg leading-7 text-[#f5f5f2] text-pretty">Esta página explica, de forma resumida, como tratamos informações quando você entra em contato com a RaccoonSoftwares.</p>
        <h2 className="mt-8 mb-2 text-2xl leading-8 font-semibold tracking-[-0.05em]">Dados enviados por você</h2>
        <p className="text-base leading-6 text-[#a5a5a0] text-pretty">Usamos os dados que você decidir compartilhar em uma conversa para entender sua operação, responder ao contato e preparar uma proposta adequada. Não vendemos essas informações.</p>
        <h2 className="mt-8 mb-2 text-2xl leading-8 font-semibold tracking-[-0.05em]">Uso e armazenamento</h2>
        <p className="text-base leading-6 text-[#a5a5a0] text-pretty">Tratamos apenas o que for necessário para responder, prestar o serviço ou cumprir uma obrigação legal. O período de armazenamento depende da finalidade do contato e das exigências aplicáveis.</p>
        <h2 className="mt-8 mb-2 text-2xl leading-8 font-semibold tracking-[-0.05em]">Seus direitos</h2>
        <p className="text-base leading-6 text-[#a5a5a0] text-pretty">Você pode pedir informações sobre o tratamento dos seus dados, solicitar correção ou pedir a exclusão quando não houver obrigação de retenção.</p>
        <h2 className="mt-8 mb-2 text-2xl leading-8 font-semibold tracking-[-0.05em]">Atualizações</h2>
        <p className="text-base leading-6 text-[#a5a5a0] text-pretty">Esta política pode ser atualizada para refletir mudanças no serviço ou na legislação. A versão publicada nesta página é a referência atual.</p>
      </article>
      </div>
    </main>
  );
}
