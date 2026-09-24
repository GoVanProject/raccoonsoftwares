import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-8 text-[#f5f5f2] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-[840px]">
      <Link className="inline-block text-sm leading-5 text-[#a5a5a0] transition-[color,transform] duration-700 ease-product hover:-translate-x-1 hover:text-[#f5f5f2] focus-visible:-translate-x-1 focus-visible:text-[#f5f5f2]" href="/">← Voltar para a RaccoonSoftwares</Link>
      <article className="mt-8 rounded-2xl border border-white/15 bg-[#181818] p-6 sm:mt-12 sm:p-12">
        <span className="text-xs font-bold tracking-[0.08em] text-[#ffb168] uppercase">RaccoonSoftwares</span>
        <h1 className="my-4 mb-6 text-4xl leading-none font-semibold tracking-[-0.07em] text-balance sm:text-5xl">Termos de uso</h1>
        <p className="mb-8 text-lg leading-7 text-[#f5f5f2] text-pretty">Estes termos descrevem as condições gerais para usar o site e iniciar uma conversa comercial com a RaccoonSoftwares.</p>
        <h2 className="mt-8 mb-2 text-2xl leading-8 font-semibold tracking-[-0.05em]">Uso do site</h2>
        <p className="text-base leading-6 text-[#a5a5a0] text-pretty">Você pode navegar e compartilhar informações verdadeiras para solicitar contato. O conteúdo do site é informativo e não representa uma proposta comercial fechada.</p>
        <h2 className="mt-8 mb-2 text-2xl leading-8 font-semibold tracking-[-0.05em]">Escopo e proposta</h2>
        <p className="text-base leading-6 text-[#a5a5a0] text-pretty">O escopo, o prazo, o investimento e o suporte de cada projeto são definidos em uma proposta específica antes do início do trabalho.</p>
        <h2 className="mt-8 mb-2 text-2xl leading-8 font-semibold tracking-[-0.05em]">Conteúdo</h2>
        <p className="text-base leading-6 text-[#a5a5a0] text-pretty">Textos, marcas e materiais apresentados nesta página pertencem à RaccoonSoftwares ou são usados com autorização. Não copie ou redistribua materiais sem permissão.</p>
        <h2 className="mt-8 mb-2 text-2xl leading-8 font-semibold tracking-[-0.05em]">Atualizações</h2>
        <p className="text-base leading-6 text-[#a5a5a0] text-pretty">Podemos atualizar o site, estes termos e os serviços descritos para acompanhar mudanças no negócio. A versão publicada nesta página é a referência atual.</p>
      </article>
      </div>
    </main>
  );
}
