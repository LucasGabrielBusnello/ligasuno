import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  cpf: string | null;
  matricula: string | null;
  current_semester: number | null;
  class_code: string | null;
};

export type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  theme_color: string;
  president_id: string | null;
  published: boolean;
  paid_until: string | null;
  initial_setup_done: boolean;
};

export type Membership = {
  id: string;
  league_id: string;
  user_id: string;
  role: "admin_master" | "presidente" | "diretor" | "ligante" | "visitante";
};

const ALL_CAMED_TABS = ["info", "membros", "noticias", "ligas", "mensagens", "horarios", "documentos"] as const;
export type CamedTab = (typeof ALL_CAMED_TABS)[number];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [isCoordination, setIsCoordination] = useState(false);
  const [isCamedPresident, setIsCamedPresident] = useState(false);
  const [camedPanelTabs, setCamedPanelTabs] = useState<CamedTab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess?.user) {
        setProfile(null);
        setIsAdminMaster(false);
        setIsCoordination(false);
        setIsCamedPresident(false);
        setCamedPanelTabs([]);
        setLoading(false);
      } else {
        loadExtras(sess.user.id);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadExtras(data.session.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadExtras(uid: string) {
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p as Profile | null);
    const admin = !!roles?.some((r: any) => r.role === "admin_master");
    const coord = admin || !!roles?.some((r: any) => r.role === "coordenacao");
    setIsAdminMaster(admin);
    let coordFinal = coord;
    if (!coordFinal && (p as any)?.email) {
      const { data: cs } = await supabase
        .from("coordination_staff").select("email").ilike("email", (p as any).email).maybeSingle();
      if (cs) coordFinal = true;
    }
    setIsCoordination(coordFinal);
    let camedPres = false;
    if ((p as any)?.email) {
      const { data: cp } = await supabase
        .from("camed_presidents").select("id").ilike("email", (p as any).email).maybeSingle();
      camedPres = !!cp;
      setIsCamedPresident(camedPres);
    } else {
      setIsCamedPresident(false);
    }
    if (admin || camedPres) {
      setCamedPanelTabs([...ALL_CAMED_TABS]);
    } else if ((p as any)?.email) {
      const { data: cpa } = await (supabase as any)
        .from("camed_panel_access").select("permissions").ilike("email", (p as any).email).maybeSingle();
      const arr = ((cpa as any)?.permissions ?? []) as string[];
      setCamedPanelTabs(arr.filter((k): k is CamedTab => (ALL_CAMED_TABS as readonly string[]).includes(k)));
    } else {
      setCamedPanelTabs([]);
    }
    setLoading(false);
  }

  return { user, session, profile, isAdminMaster, isCoordination, isCamedPresident, camedPanelTabs, loading };
}

export const CAMED_TAB_LABELS: Record<CamedTab, string> = {
  info: "Info",
  membros: "Membros",
  noticias: "Notícias",
  ligas: "Ligas",
  mensagens: "Mensagens",
  horarios: "Horários",
  documentos: "Atas e Documentos",
};
export const ALL_CAMED_TABS_LIST = ALL_CAMED_TABS;

export async function signOut() {
  await supabase.auth.signOut();
}

