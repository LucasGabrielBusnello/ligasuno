import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

/**
 * Botão de curtir uma liga — uma curtida por usuário (UNIQUE no banco).
 * Mostra a contagem total e fica preenchido quando o usuário já curtiu.
 */
export function LeagueHeartButton({
  leagueId,
  userId,
  themeColor,
}: {
  leagueId: string;
  userId: string | null;
  themeColor: string;
}) {
  const nav = useNavigate();
  const [count, setCount] = useState<number>(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count: c } = await supabase
        .from("league_likes")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId);
      if (!cancelled) setCount(c ?? 0);
      if (userId) {
        const { data } = await supabase
          .from("league_likes")
          .select("id")
          .eq("league_id", leagueId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!cancelled) setLiked(!!data);
      } else if (!cancelled) {
        setLiked(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leagueId, userId]);

  async function toggle() {
    if (!userId) {
      toast.message("Entre para curtir a liga");
      nav({ to: "/auth" });
      return;
    }
    if (busy) return;
    setBusy(true);
    if (liked) {
      const { error } = await supabase
        .from("league_likes").delete()
        .eq("league_id", leagueId).eq("user_id", userId);
      if (error) { toast.error("Não foi possível remover a curtida"); setBusy(false); return; }
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase
        .from("league_likes").insert({ league_id: leagueId, user_id: userId });
      if (error) { toast.error("Já curtiu ou erro de conexão"); setBusy(false); return; }
      setLiked(true);
      setCount((c) => c + 1);
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={liked ? "Remover curtida" : "Curtir liga"}
      className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-md transition-all active:scale-95 disabled:opacity-60"
    >
      <span className="relative inline-flex">
        <Heart
          className={`size-5 transition-all duration-300 ${
            liked ? "fill-current scale-110" : "scale-100"
          } ${pulse ? "animate-ping-once" : ""}`}
          style={{ color: liked ? themeColor : "white" }}
          strokeWidth={liked ? 2 : 2}
        />
        {pulse && (
          <Heart
            className="size-5 absolute inset-0 fill-current opacity-70 animate-ping"
            style={{ color: themeColor }}
          />
        )}
      </span>
      <span className="text-sm font-bold tabular-nums text-white">
        {count.toLocaleString("pt-BR")}
      </span>
    </button>
  );
}
