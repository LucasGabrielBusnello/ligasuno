import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/auth")({ component: AuthPage });

const usernameRegex = /^[a-zA-Z0-9_.-]{2,30}$/;
const signupSchema = z.object({
  username: z.string().regex(usernameRegex, "Usuário inválido (2-30 caracteres, letras/números/._-)"),
  email: z.string().email("Email inválido").max(255),
  phone: z.string().min(8, "Telefone inválido").max(20),
  password: z.string().min(8, "Senha mínima de 8 caracteres").max(72),
});

function AuthPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  // login
  const [li, setLi] = useState({ email: "", password: "" });
  // signup
  const [su, setSu] = useState({ username: "", email: "", phone: "", password: "" });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: li.email, password: li.password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    nav({ to: "/" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse(su);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);

    setLoading(true);
    // Check username availability
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", su.username)
      .maybeSingle();
    if (existing) { setLoading(false); return toast.error("Esse nome de usuário já está em uso"); }

    const { error } = await supabase.auth.signUp({
      email: su.email,
      password: su.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username: su.username, phone: su.phone },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro realizado! Verifique seu email para confirmar.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground">
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
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={li.email} onChange={(e) => setLi({ ...li, email: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Senha</Label><Input type="password" required value={li.password} onChange={(e) => setLi({ ...li, password: e.target.value })} /></div>
                  <Button type="submit" disabled={loading} className="w-full">{loading ? "Entrando..." : "Entrar"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-1.5"><Label>Usuário (até 30 caracteres)</Label><Input required maxLength={30} value={su.username} onChange={(e) => setSu({ ...su, username: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={su.email} onChange={(e) => setSu({ ...su, email: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Telefone</Label><Input type="tel" required value={su.phone} onChange={(e) => setSu({ ...su, phone: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Senha (mín. 8)</Label><Input type="password" required value={su.password} onChange={(e) => setSu({ ...su, password: e.target.value })} /></div>
                  <Button type="submit" disabled={loading} className="w-full">{loading ? "Cadastrando..." : "Criar conta"}</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
