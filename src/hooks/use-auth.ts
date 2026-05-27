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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess?.user) {
        setProfile(null);
        setIsAdminMaster(false);
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
    setIsAdminMaster(!!roles?.some((r: any) => r.role === "admin_master"));
    setLoading(false);
  }

  return { user, session, profile, isAdminMaster, loading };
}

export async function signOut() {
  await supabase.auth.signOut();
}
