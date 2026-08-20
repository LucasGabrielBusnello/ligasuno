import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, GraduationCap } from "lucide-react";
import { formatBRPhone, isValidBRPhone, normalizePhone } from "@/lib/phone";

const ATM_CLASSES = ["ATM31", "ATM30", "ATM29", "ATM28", "ATM27", "ATM26"] as const;

/**
 * Modal exibido uma única vez para revisar o cadastro após a migração de campos.
 * Reaparece apenas se algum campo obrigatório voltar a faltar.
 */
export function ProfileReviewDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [isUno, setIsUno] = useState<"" | "sim" | "nao">("");
  const [matricula, setMatricula] = useState("");
  const [classCode, setClassCode] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle().then(({ data }) => {
      const p = data as any;
      setProfile(p);
      setPhone(p?.phone ? formatBRPhone(p.phone) : "");
      setIsUno(p?.is_unochapeco_student === true ? "sim" : p?.is_unochapeco_student === false ? "nao" : "");
      setMatricula(p?.matricula ?? "");
      setClassCode(p?.class_code ?? "");
      setLoading(false);
    });
  }, [open, userId]);

  async function save() {
    if (!phone || !isValidBRPhone(phone)) return toast.error("Telefone inválido");
    if (isUno === "") return toast.error("Diga se você é aluno(a) da Unochapecó");
    if (isUno === "sim") {
      if (!/^\d{9}$/.test(matricula)) return toast.error("Matrícula deve ter 9 dígitos");
      if (!ATM_CLASSES.includes(classCode as any)) return toast.error("Selecione sua turma ATM");
    }
    setSaving(true);
    const patch: any = {
      phone: normalizePhone(phone),
      is_unochapeco_student: isUno === "sim",
      profile_reviewed_at: new Date().toISOString(),
    };
    if (isUno === "sim") {
      patch.matricula = matricula;
      patch.class_code = classCode;
    } else {
      patch.matricula = null;
      patch.class_code = null;
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro atualizado!");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto size-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-2">
            <GraduationCap className="size-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center">Atualizar cadastro</DialogTitle>
          <DialogDescription className="text-center">
            Adicionamos novas informações ao MEDPLEX. Confirme seus dados para continuar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(formatBRPhone(e.target.value))}
                inputMode="tel"
                maxLength={16}
                placeholder="(49) 99999-9999"
              />
            </div>
            <div>
              <Label>Você é aluno(a) de Medicina da Unochapecó?</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button type="button" onClick={() => setIsUno("sim")}
                  className={`p-2.5 rounded-lg border-2 text-sm font-bold transition-all ${isUno === "sim" ? "border-primary bg-primary/10" : "border-border"}`}>Sim</button>
                <button type="button" onClick={() => { setIsUno("nao"); setMatricula(""); setClassCode(""); }}
                  className={`p-2.5 rounded-lg border-2 text-sm font-bold transition-all ${isUno === "nao" ? "border-primary bg-primary/10" : "border-border"}`}>Não</button>
              </div>
            </div>
            {isUno === "sim" && (
              <>
                <div>
                  <Label>Matrícula (9 dígitos)</Label>
                  <Input
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="123456789"
                  />
                </div>
                <div>
                  <Label>Turma ATM</Label>
                  <Select value={classCode} onValueChange={setClassCode}>
                    <SelectTrigger><SelectValue placeholder="Selecione sua turma" /></SelectTrigger>
                    <SelectContent>
                      {ATM_CLASSES.map((c) => (
                        <SelectItem key={c} value={c}>{c} — formatura em 20{c.slice(3)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={save} disabled={loading || saving} className="w-full">
            {saving && <Loader2 className="size-4 animate-spin" />} Confirmar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
