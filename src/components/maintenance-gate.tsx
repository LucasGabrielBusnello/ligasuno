import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, LogIn, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, isAdminMaster, loading: authLoading } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [allowlist, setAllowlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    async function load() {
      const [{ data: s }, { data: al }] = await Promise.all([
        supabase.from("app_settings").select("maintenance_enabled").eq("id", 1).maybeSingle(),
        supabase.from("maintenance_allowlist" as any).select("email"),
      ]);
      if (!alive) return;
      setEnabled(!!(s as any)?.maintenance_enabled);
      setAllowlist(new Set(((al as any) ?? []).map((r: any) => String(r.email).toLowerCase())));
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  if (enabled === null || authLoading) return null;

  const email = (user?.email ?? "").toLowerCase();
  const allowed = !enabled || isAdminMaster || (email && allowlist.has(email));

  if (allowed) return <>{children}</>;
  return <MaintenanceScreen signedInAs={user?.email ?? null} />;
}

function MaintenanceScreen({ signedInAs }: { signedInAs: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message || "Falha ao entrar");
    toast.success("Entrando…");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-950 via-neutral-950 to-neutral-950 px-4 py-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="size-16 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto ring-1 ring-emerald-500/30">
          <Wrench className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-white">Site em Manutenção</h1>
          <p className="text-sm text-neutral-400">
            Estamos preparando uma nova versão do MEDUNO. Voltamos em breve.
          </p>
        </div>

        {signedInAs && (
          <div className="text-xs text-neutral-500">
            Conectado como <b className="text-neutral-300">{signedInAs}</b> — sem acesso à versão teste.{" "}
            <button onClick={() => signOut()} className="underline text-emerald-400 hover:text-emerald-300">Sair</button>
          </div>
        )}

        <Card className="bg-neutral-900/70 border-neutral-800 backdrop-blur">
          <CardContent className="p-5 text-left">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-3">Acesso restrito à versão teste</div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="m-email" className="text-neutral-300 text-xs">E-mail</Label>
                <Input id="m-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-neutral-950 border-neutral-800" />
              </div>
              <div>
                <Label htmlFor="m-pwd" className="text-neutral-300 text-xs">Senha</Label>
                <div className="relative">
                  <Input
                    id="m-pwd"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-neutral-950 border-neutral-800 pr-10"
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300" tabIndex={-1} aria-label={show ? "Esconder" : "Mostrar"}>
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
                <LogIn className="size-4" /> {busy ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
