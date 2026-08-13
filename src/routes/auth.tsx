import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { sendWelcomeEmailForUser } from "@/lib/registration.functions";
import { requestPasswordResetCode, confirmPasswordResetCode } from "@/lib/password-reset.functions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatBRPhone, isValidBRPhone, normalizePhone } from "@/lib/phone";


function PasswordInput({ id, value, onChange, autoComplete, required }: { id: string; value: string; onChange: (v: string) => void; autoComplete?: string; required?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
        tabIndex={-1}
        aria-label={show ? "Esconder senha" : "Mostrar senha"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export const Route = createFileRoute("/auth")({ component: AuthPage });

function ForgotPasswordDialog({ defaultEmail }: { defaultEmail: string }) {
  const request = useServerFn(requestPasswordResetCode);
  const confirm = useServerFn(confirmPasswordResetCode);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("Informe seu e-mail.");
    setBusy(true);
    try {
      await request({ data: { email: email.trim() } });
      toast.success("Se este e-mail estiver cadastrado, enviamos um código de 6 dígitos.");
      setStep(2);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao enviar o código.");
    } finally { setBusy(false); }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) return toast.error("Digite o código de 6 dígitos.");
    if (pass.length < 6) return toast.error("A senha deve ter no mínimo 6 caracteres.");
    if (pass !== pass2) return toast.error("As senhas não coincidem.");
    setBusy(true);
    try {
      await confirm({ data: { email: email.trim(), code: code.trim(), password: pass } });
      toast.success("Senha redefinida! Faça login com a nova senha.");
      setOpen(false);
      setStep(1); setCode(""); setPass(""); setPass2("");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível redefinir a senha.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { setOpen(o); if (o) setEmail(defaultEmail); }}>
      <DialogTrigger asChild>
        <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
          Esqueci minha senha
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Informe seu e-mail e enviaremos um código de 6 dígitos."
              : "Digite o código recebido por e-mail e escolha a nova senha."}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <form onSubmit={send} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fp-email">E-mail</Label>
              <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Enviando..." : "Enviar código"}</Button>
          </form>
        ) : (
          <form onSubmit={reset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fp-code">Código de 6 dígitos</Label>
              <Input id="fp-code" inputMode="numeric" maxLength={6} required value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl tracking-[0.4em] font-black" placeholder="000000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-pass">Nova senha</Label>
              <PasswordInput id="fp-pass" autoComplete="new-password" required value={pass} onChange={setPass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-pass2">Confirmar nova senha</Label>
              <PasswordInput id="fp-pass2" autoComplete="new-password" required value={pass2} onChange={setPass2} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvando..." : "Redefinir senha"}</Button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
              Não recebi o código — enviar novamente
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}


const usernameRegex = /^[\p{L}\p{N}_.\- ]{2,30}$/u;
const signupSchema = z.object({
  username: z
    .string()
    .regex(usernameRegex, "Usuário deve ter de 2 a 30 caracteres (letras, números, espaço, ponto, hífen ou underline)"),
  email: z.string().email("Email inválido").max(255),
  phone: z.string().refine((v) => isValidBRPhone(v), "Telefone inválido. Use o formato (DDD) 9XXXX-XXXX para celular ou (DDD) XXXX-XXXX para fixo."),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(72),
});

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu email antes de entrar.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Já existe uma conta com este email. Faça login.";
  if (m.includes("password should be at least")) return "A senha deve ter no mínimo 6 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid format") || m.includes("email address") && m.includes("invalid"))
    return "Email inválido. Verifique se está correto.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns segundos e tente novamente.";
  if (m.includes("network")) return "Falha de conexão. Verifique sua internet.";
  return msg;
}

function AuthPage() {
  const nav = useNavigate();
  const welcome = useServerFn(sendWelcomeEmailForUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [li, setLi] = useState({ email: "", password: "" });
  const [su, setSu] = useState({
    username: "",
    email: "",
    phone: "",
    is_unochapeco: "" as "" | "sim" | "nao",
    course: "",
    matricula: "",
    class_code: "" as "" | "ATM31" | "ATM30" | "ATM29" | "ATM28" | "ATM27" | "ATM26",
    password: "",
    confirmPassword: "",
  });

  function reset() {
    setError(null);
    setSuccess(null);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: li.email.trim(),
      password: li.password,
    });
    setLoading(false);
    if (err) {
      const msg = translateError(err.message);
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Bem-vindo!");
    nav({ to: "/" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    reset();

    const cleaned = {
      username: su.username.trim(),
      email: su.email.trim(),
      phone: normalizePhone(su.phone),
      password: su.password,
    };
    const parsed = signupSchema.safeParse(cleaned);
    if (!parsed.success) {
      const msg = parsed.error.errors[0].message;
      setError(msg);
      toast.error(msg);
      return;
    }
    if (su.password !== su.confirmPassword) {
      const msg = "As senhas não coincidem.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (su.is_unochapeco === "") {
      const msg = "Informe se você é aluno(a) de Medicina da Unochapecó.";
      setError(msg); toast.error(msg); return;
    }
    if (su.is_unochapeco === "sim") {
      if (!/^\d{9}$/.test(su.matricula)) { const m = "Matrícula deve ter 9 dígitos."; setError(m); toast.error(m); return; }
      const validClasses = ["ATM31","ATM30","ATM29","ATM28","ATM27","ATM26"];
      if (!validClasses.includes(su.class_code)) { const m = "Selecione sua turma ATM."; setError(m); toast.error(m); return; }
    } else if (!su.course) {
      const m = "Selecione qual curso você estuda/trabalha."; setError(m); toast.error(m); return;
    }

    setLoading(true);
    // Verifica disponibilidade do usuário (via função SECURITY DEFINER — não expõe emails)
    const { data: available } = await supabase.rpc("username_available", { _username: cleaned.username });
    if (available === false) {
      setLoading(false);
      const msg = "Esse nome de usuário já está em uso. Escolha outro.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const { data, error: err } = await supabase.auth.signUp({
      email: cleaned.email,
      password: cleaned.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username: cleaned.username, phone: cleaned.phone },
      },
    });
    setLoading(false);

    if (err) {
      const msg = translateError(err.message);
      setError(msg);
      toast.error(msg);
      return;
    }

    // Atualiza perfil (Unochapecó, matrícula, turma ATM) e envia e-mail de boas-vindas
    if (data.user) {
      const patch: any = {
        is_unochapeco_student: su.is_unochapeco === "sim",
        profile_reviewed_at: new Date().toISOString(),
      };
      if (su.is_unochapeco === "sim") {
        const mat = su.matricula.replace(/\D/g, "");
        if (mat) patch.matricula = mat;
        patch.class_code = su.class_code;
        patch.course = "Medicina";
      } else {
        patch.matricula = null;
        patch.class_code = null;
        patch.course = su.course;
      }
      try { await supabase.from("profiles").update(patch).eq("id", data.user.id); } catch {}
      // não bloqueia o login: e-mail de boas-vindas é enviado em segundo plano
      void welcome({ data: { user_id: data.user.id } }).catch((e) => console.warn("welcome email failed", e));
    }

    // Como auto-confirm está ativo, a sessão já vem pronta
    if (data.session) {
      toast.success("Conta criada com sucesso!");
      nav({ to: "/" });
      return;
    }

    const okMsg = "Conta criada! Você já pode fazer login.";
    setSuccess(okMsg);
    toast.success(okMsg);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <Card className="overflow-hidden">
          <div className="hub-hero text-white p-8 text-center">
            <div className="size-14 mx-auto rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-3">
              <GraduationCap className="size-7" />
            </div>
            <h1 className="text-2xl font-black">Ligas Acadêmicas</h1>
            <p className="text-white/70 text-sm mt-1">Acesse ou crie sua conta</p>
          </div>
          <CardContent className="p-6">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="mb-4 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <Tabs defaultValue="login" className="w-full" onValueChange={reset}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-4">
                <form onSubmit={handleLogin} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="li-email">Email</Label>
                    <Input
                      id="li-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={li.email}
                      onChange={(e) => setLi({ ...li, email: e.target.value })}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="li-pass">Senha</Label>
                    <PasswordInput
                      id="li-pass"
                      autoComplete="current-password"
                      required
                      value={li.password}
                      onChange={(v) => setLi({ ...li, password: v })}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                  <ForgotPasswordDialog defaultEmail={li.email} />
                </form>

              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSignup} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-user">Usuário (até 30 caracteres)</Label>
                    <Input
                      id="su-user"
                      required
                      maxLength={30}
                      value={su.username}
                      onChange={(e) => setSu({ ...su, username: e.target.value })}
                      placeholder="ex: joao.silva"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input
                      id="su-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={su.email}
                      onChange={(e) => setSu({ ...su, email: e.target.value })}
                      placeholder="seu@unochapeco.edu.br"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-phone">Telefone</Label>
                    <Input
                      id="su-phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      value={su.phone}
                      onChange={(e) => setSu({ ...su, phone: formatBRPhone(e.target.value) })}
                      inputMode="tel"
                      maxLength={16}
                      placeholder="(49) 99999-9999"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Você é aluno(a) da Unochapecó?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setSu({ ...su, is_unochapeco: "sim" })}
                        className={`p-2.5 rounded-lg border-2 text-sm font-bold transition-all ${su.is_unochapeco === "sim" ? "border-primary bg-primary/10" : "border-border"}`}>Sim</button>
                      <button type="button" onClick={() => setSu({ ...su, is_unochapeco: "nao", matricula: "", class_code: "" })}
                        className={`p-2.5 rounded-lg border-2 text-sm font-bold transition-all ${su.is_unochapeco === "nao" ? "border-primary bg-primary/10" : "border-border"}`}>Não</button>
                    </div>
                  </div>
                  {su.is_unochapeco === "sim" && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="su-mat">Matrícula (9 dígitos)</Label>
                        <Input
                          id="su-mat"
                          value={su.matricula}
                          onChange={(e) => setSu({ ...su, matricula: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                          placeholder="123456789"
                          inputMode="numeric"
                          maxLength={9}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="su-atm">Turma ATM</Label>
                        <select
                          id="su-atm"
                          value={su.class_code}
                          onChange={(e) => setSu({ ...su, class_code: e.target.value as any })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Selecione sua turma…</option>
                          {["ATM31","ATM30","ATM29","ATM28","ATM27","ATM26"].map((c) => (
                            <option key={c} value={c}>{c} — formatura em 20{c.slice(3)}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass">Senha (mín. 6 caracteres)</Label>
                    <PasswordInput
                      id="su-pass"
                      autoComplete="new-password"
                      required
                      value={su.password}
                      onChange={(v) => setSu({ ...su, password: v })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass-confirm">Confirmar senha</Label>
                    <PasswordInput
                      id="su-pass-confirm"
                      autoComplete="new-password"
                      required
                      value={su.confirmPassword}
                      onChange={(v) => setSu({ ...su, confirmPassword: v })}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Cadastrando..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
