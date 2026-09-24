import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-start justify-center bg-black px-6 py-8 text-[#f5f5f2] sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-start">
      <span className="mb-12 grid size-14 place-items-center rounded-2xl bg-[#f5f5f2] text-3xl font-bold text-black">R</span>
      <span className="text-xs font-bold tracking-[0.08em] text-[#ffb168] uppercase">RaccoonSoftwares / 404</span>
      <h1 className="my-4 mb-4 max-w-[560px] text-4xl leading-none font-semibold tracking-[-0.07em] text-balance sm:text-5xl">Essa página saiu do fluxo.</h1>
      <p className="mb-8 max-w-[480px] text-base leading-6 text-[#a5a5a0] text-pretty">O endereço que você tentou acessar não existe ou foi movido.</p>
      <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#f5f5f2] px-5 text-sm font-semibold text-black transition-transform duration-300 ease-product hover:-translate-y-0.5" href="/">Voltar para o início <span aria-hidden="true">↗</span></Link>
      </div>
    </main>
  );
}
