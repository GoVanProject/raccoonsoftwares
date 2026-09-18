import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <span className="not-found-mark">R</span>
      <span className="legal-kicker">RaccoonSoftwares / 404</span>
      <h1>Essa página saiu do fluxo.</h1>
      <p>O endereço que você tentou acessar não existe ou foi movido.</p>
      <Link className="primary-button" href="/">Voltar para o início <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
