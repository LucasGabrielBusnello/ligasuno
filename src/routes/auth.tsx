import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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

const usernameRegex = /^[a-zA-Z0-9_.-]{2,30}$/;
const signupSchema = z.object({
  username: z
    .string()
    .regex(usernameRegex, "Usuário deve ter de 2 a 30 caracteres (letras, números, ponto, hífen ou underline)"),
  email: z.string().email("Email inválido").max(255),
  phone: z.string().min(8, "Telefone inválido (mínimo 8 dígitos)").max(20),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").max(72),
});

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu email antes de entrar.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Já existe uma conta com este email. Faça login.";
  if (m.includes("password should be at least")) return "A senha deve ter no mínimo 8 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid format") || m.includes("email address") && m.includes("invalid"))
    return "Email inválido. Verifique se está correto.";
  if (m.includes("weak password") || m.includes("pwned") || m.includes("compromised"))
    return "Essa senha é muito comum. Escolha uma mais forte.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns segundos e tente novamente.";
  if (m.includes("network")) return "Falha de conexão. Verifique sua internet.";
  return msg;
}

function AuthPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [li, setLi] = useState({ email: "", password: "" });
  const [su, setSu] = useState({ username: "", email: "", phone: "", password: "", confirmPassword: "" });

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
      phone: su.phone.trim(),
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
                    <Input
                      id="li-pass"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={li.password}
                      onChange={(e) => setLi({ ...li, password: e.target.value })}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
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
                      onChange={(e) => setSu({ ...su, phone: e.target.value })}
                      placeholder="(49) 99999-9999"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass">Senha (mín. 8 caracteres)</Label>
                    <Input
                      id="su-pass"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={su.password}
                      onChange={(e) => setSu({ ...su, password: e.target.value })}
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
