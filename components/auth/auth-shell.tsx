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
    <main className="grid min-h-dvh place-items-center overflow-x-hidden bg-background px-4 py-8 font-sans text-foreground max-[520px]:place-items-start max-[520px]:py-4">
      <MagicCard
        className="w-full max-w-[480px] rounded-2xl shadow-[0_24px_64px_hsl(var(--foreground)/0.12)]"
        gradientColor="hsl(var(--primary))"
        gradientFrom="hsl(var(--primary))"
        gradientTo="#7c5cff"
        gradientOpacity={0.12}
      >
        <section className="p-6 sm:p-10">
          <Link className="inline-flex items-center gap-3 text-sm font-bold text-foreground no-underline" href="/">
            <span className="grid size-10 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
              <Image src="/raccoon-mascot.webp" width={36} height={36} alt="" />
            </span>
            RaccoonSoftwares
          </Link>
          <div className="my-6 grid gap-2 sm:my-8">
            <p className="m-0 text-xs font-bold tracking-[0.08em] text-primary uppercase">{kicker}</p>
            <h1 className="m-0 text-[26px] leading-[1.1] font-bold tracking-[-0.035em] text-foreground sm:text-3xl">{title}</h1>
            <span className="text-sm leading-relaxed text-muted-foreground">{description}</span>
          </div>
          {children}
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5 text-[13px] text-muted-foreground max-[520px]:flex-col max-[520px]:items-start">
            {footer}
            <Link href="/" className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-primary no-underline">
              <ArrowLeft size={16} />
              Voltar para o site
            </Link>
          </div>
        </section>
      </MagicCard>
    </main>
  );
}
