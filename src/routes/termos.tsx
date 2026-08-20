import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ScrollText } from "lucide-react";
import { TERMS_CLAUSES, TERMS_TITLE, TERMS_VERSION } from "@/lib/terms";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso e Privacidade — MEDPLEX" },
      {
        name: "description",
        content:
          "Termos de uso e política de privacidade do MEDPLEX, plataforma estudantil independente para ligas acadêmicas, atlética, CAMED e IFMSA.",
      },
      { property: "og:title", content: "Termos de Uso e Privacidade — MEDPLEX" },
      {
        property: "og:description",
        content: "Leia os termos de uso e a política de privacidade da plataforma MEDPLEX.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <div className="mb-8 flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ScrollText className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black leading-tight">{TERMS_TITLE}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Versão {TERMS_VERSION}</p>
        </div>
      </div>

      <div className="space-y-6">
        {TERMS_CLAUSES.map((c) => (
          <section key={c.n}>
            <h2 className="text-base font-bold">
              {c.n}. {c.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
