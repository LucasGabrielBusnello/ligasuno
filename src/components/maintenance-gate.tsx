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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message || "Falha ao entrar");
      toast.success("Entrando…");
    } else {
      if (password.length < 8) { setBusy(false); return toast.error("A senha deve ter no mínimo 8 caracteres."); }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      setBusy(false);
      if (error) return toast.error(error.message || "Falha ao cadastrar");
      toast.success("Conta criada! Se o site estiver liberado para você, já pode entrar.");
    }
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
            Estamos preparando uma nova versão do MEDPLEX. Voltamos em breve.
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
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                {mode === "login" ? "Acesso restrito à versão teste" : "Criar conta"}
              </div>
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline"
              >
                {mode === "login" ? "Cadastrar" : "Entrar"}
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="m-email" className="text-neutral-300 text-xs">E-mail</Label>
                <Input id="m-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-500" />
              </div>
              <div>
                <Label htmlFor="m-pwd" className="text-neutral-300 text-xs">Senha</Label>
                <div className="relative">
                  <Input
                    id="m-pwd"
                    type={show ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-neutral-950 border-neutral-800 pr-10 text-neutral-100 placeholder:text-neutral-500"
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300" tabIndex={-1} aria-label={show ? "Esconder" : "Mostrar"}>
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
                <LogIn className="size-4" /> {busy ? (mode === "login" ? "Entrando…" : "Cadastrando…") : (mode === "login" ? "Entrar" : "Criar conta")}
              </Button>
              {mode === "signup" && (
                <p className="text-[11px] text-neutral-500 text-center">
                  Após criar a conta, o acesso à versão teste só é liberado para e-mails autorizados.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

