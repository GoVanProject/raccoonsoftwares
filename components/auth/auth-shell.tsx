import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { MagicCard } from "@/components/ui/magic-card";

export function AuthShell({
  kicker,
  title,
  description,
  children,
  footer,
}: {
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="auth-v2-page">
      <MagicCard
        className="auth-v2-card"
        gradientColor="hsl(var(--primary))"
        gradientFrom="hsl(var(--primary))"
        gradientTo="#7c5cff"
        gradientOpacity={0.12}
      >
        <section className="auth-v2-content">
          <Link className="auth-v2-brand" href="/">
            <span>
              <Image src="/raccoon-mascot.webp" width={36} height={36} alt="" />
            </span>
            RaccoonSoftwares
          </Link>
          <div className="auth-v2-heading">
            <p>{kicker}</p>
            <h1>{title}</h1>
            <span>{description}</span>
          </div>
          {children}
          <div className="auth-v2-footer">
            {footer}
            <Link href="/" className="auth-v2-back">
              <ArrowLeft size={16} />
              Voltar para o site
            </Link>
          </div>
        </section>
      </MagicCard>
    </main>
  );
}
