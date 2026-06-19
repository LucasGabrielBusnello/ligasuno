import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";
import { Loader2 } from "lucide-react";

function formatCpf(v: string) {
  const d = normalizeCpf(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d)/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d)/, "($1) $2-$3").trim();
}

export function ProfileEditDialog({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (v: boolean) => void; userId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle().then(({ data }) => {
      const p = data as any;
      setFullName(p?.full_name ?? "");
      setUsername(p?.username ?? "");
      setPhone(p?.phone ? formatPhone(p.phone) : "");
      setCpf(p?.cpf ? formatCpf(p.cpf) : "");
      setRegistrationNumber(p?.registration_number ?? "");
      setEmail(p?.email ?? "");
      setLoading(false);
    });
  }, [open, userId]);

  async function save() {
    const uname = username.trim();
    if (uname.length < 2 || uname.length > 30) return toast.error("Usuário deve ter entre 2 e 30 caracteres");
    if (!/^[a-zA-Z0-9_.]+$/.test(uname)) return toast.error("Usuário só pode conter letras, números, ponto e underline");
    const cpfDigits = normalizeCpf(cpf);
    if (cpfDigits && !isValidCPF(cpfDigits)) return toast.error("CPF inválido");
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) return toast.error("Telefone inválido");
    if (fullName.trim().length > 120) return toast.error("Nome muito longo");
    if (registrationNumber.trim().length > 30) return toast.error("Matrícula muito longa");

    setSaving(true);
    const payload: any = {
      full_name: fullName.trim() || null,
      username: uname,
      phone: phoneDigits || null,
      cpf: cpfDigits || null,
      registration_number: registrationNumber.trim() || null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    setSaving(false);
    if (error) {
      if (error.message.toLowerCase().includes("unique") || error.code === "23505") {
        return toast.error("Usuário ou CPF já cadastrado por outra conta");
      }
      return toast.error(error.message);
    }
    toast.success("Dados atualizados");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Meus dados</DialogTitle>
          <DialogDescription>Atualize ou complete suas informações cadastrais.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>E-mail</Label>
              <Input value={email} disabled />
            </div>
            <div>
              <Label htmlFor="pe-name">Nome completo</Label>
              <Input id="pe-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} placeholder="Seu nome completo" />
            </div>
            <div>
              <Label htmlFor="pe-user">Usuário</Label>
              <Input id="pe-user" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} placeholder="seu_usuario" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pe-cpf">CPF</Label>
                <Input id="pe-cpf" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
              </div>
              <div>
                <Label htmlFor="pe-phone">Telefone</Label>
                <Input id="pe-phone" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" />
              </div>
            </div>
            <div>
              <Label htmlFor="pe-reg">Matrícula</Label>
              <Input id="pe-reg" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} maxLength={30} placeholder="Opcional" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={loading || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
