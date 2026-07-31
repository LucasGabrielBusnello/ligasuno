import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type Shift = "morning" | "afternoon" | "night";
export type ScheduleEntry = {
  id: string;
  class_code: string;
  subdivision: string;
  date: string;
  shift: Shift;
  start_time: string;
  end_time: string;
  kind: "class" | "practice" | "exam" | "green_zone" | "abex";
  is_abex?: boolean;
  color?: string | null;
  notes?: string | null;
  rescheduled_from_entry_id?: string | null;
  rescheduled_to_date?: string | null;
  subject?: { id: string; name: string; professor: string | null } | null;
};
export type Holiday = { id: string; date: string; label: string };

export const SHIFT_LABEL: Record<Shift, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
};
export const SHIFT_HOURS: Record<Shift, string> = {
  morning: "08:00–12:00",
  afternoon: "13:30–17:30",
  night: "19:00–22:00",
};
export const DEFAULT_SHIFT_TIMES: Record<Shift, [string, string]> = {
  morning: ["08:00", "12:00"],
  afternoon: ["13:30", "17:30"],
  night: ["19:00", "22:00"],
};

export function getMonday(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  m.setHours(0, 0, 0, 0);
  return m;
}
export function weekDays(monday: Date) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Cor padrão por tipo de aula (usada quando a coordenação não escolhe uma cor). */
export const DEFAULT_KIND_COLORS: Record<string, string> = {
  class: "#0f766e",
  practice: "#7c3aed",
  abex: "#7c3aed",
  exam: "#dc2626",
  green_zone: "#65a30d",
};

export function entryColor(e: ScheduleEntry) {
  if (e.color) return e.color;
  if (e.is_abex) return DEFAULT_KIND_COLORS.abex;
  return DEFAULT_KIND_COLORS[e.kind] ?? DEFAULT_KIND_COLORS.class;
}

function kindStyle(e: ScheduleEntry) {
  if (e.rescheduled_to_date) return "bg-muted border-dashed text-muted-foreground";
  return "text-foreground";
}


export type PersonalItem = {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  color: string;
};
export type ExtraEvent = {
  id: string;
  title: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  source: "atletica" | "liga";
};

function shiftFromTime(t?: string | null): Shift | null {
  if (!t) return null;
  const h = parseInt(t.slice(0, 2), 10);
  if (isNaN(h)) return null;
  if (h < 13) return "morning";
  if (h < 18) return "afternoon";
  return "night";
}

export function ScheduleGrid({
  monday,
  entries,
  holidays,
  classCode,
  otherClassEntries,
  personalItems,
  extraEvents,
  onCellClick,
}: {
  monday: Date;
  entries: ScheduleEntry[];
  holidays: Holiday[];
  classCode?: string;
  /** used for "janela verde automática" — if empty for a class shift and another class has any entry, show green */
  otherClassEntries?: ScheduleEntry[];
  personalItems?: PersonalItem[];
  extraEvents?: ExtraEvent[];
  onCellClick?: (date: string, shift: Shift) => void;
}) {
  const days = useMemo(() => weekDays(monday), [monday]);
  const shifts: Shift[] = ["morning", "afternoon", "night"];

  const holidayByDate = useMemo(() => {
    const m: Record<string, Holiday> = {};
    for (const h of holidays) m[h.date] = h;
    return m;
  }, [holidays]);

  const byCell = useMemo(() => {
    const m: Record<string, ScheduleEntry[]> = {};
    for (const e of entries) {
      const k = `${e.date}|${e.shift}`;
      (m[k] ??= []).push(e);
    }
    return m;
  }, [entries]);

  const otherByCell = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const e of otherClassEntries ?? []) {
      if (e.class_code === classCode) continue;
      if (e.kind === "green_zone") continue;
      m[`${e.date}|${e.shift}`] = true;
    }
    return m;
  }, [otherClassEntries, classCode]);

  const personalByCell = useMemo(() => {
    const m: Record<string, PersonalItem[]> = {};
    for (const p of personalItems ?? []) {
      const sh = shiftFromTime(p.start_time) ?? "morning";
      (m[`${p.date}|${sh}`] ??= []).push(p);
    }
    return m;
  }, [personalItems]);

  const extraByCell = useMemo(() => {
    const m: Record<string, ExtraEvent[]> = {};
    for (const e of extraEvents ?? []) {
      const sh = shiftFromTime(e.start_time) ?? "night";
      (m[`${e.date}|${sh}`] ??= []).push(e);
    }
    return m;
  }, [extraEvents]);

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-emerald-900/30 dark:border-emerald-500/20 bg-white dark:bg-neutral-950 shadow-sm">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-32 border-b border-r border-emerald-900/20 dark:border-emerald-500/20 bg-emerald-800 dark:bg-emerald-900 p-2 text-left text-xs font-black uppercase text-white">
              Turno
            </th>
            {days.map((d) => {
              const iso = toISODate(d);
              const h = holidayByDate[iso];
              return (
                <th key={iso} className={cn(
                  "border-b border-r border-emerald-900/20 dark:border-emerald-500/20 p-2 text-center text-xs font-bold text-white",
                  h ? "bg-cyan-800 dark:bg-cyan-900" : "bg-emerald-800 dark:bg-emerald-900"
                )}>
                  <div className="uppercase">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</div>
                  <div className="text-[11px] font-semibold opacity-80">{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
                  {h && <div className="text-[10px] font-bold mt-0.5">{h.label}</div>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shifts.map((sh) => (
            <tr key={sh}>
              <td className="border-r border-b border-emerald-900/15 dark:border-emerald-500/15 bg-emerald-100 dark:bg-emerald-950/60 p-2 align-top">
                <div className="font-black text-xs uppercase text-emerald-900 dark:text-emerald-200">{SHIFT_LABEL[sh]}</div>
                <div className="text-[10px] text-emerald-800/70 dark:text-emerald-300/70">{SHIFT_HOURS[sh]}</div>
              </td>
              {days.map((d) => {
                const iso = toISODate(d);
                const h = holidayByDate[iso];
                const cellEntries = byCell[`${iso}|${sh}`] ?? [];
                const isGreenAuto = !h && cellEntries.length === 0 && otherByCell[`${iso}|${sh}`];
                return (
                  <td
                    key={iso}
                    onClick={() => onCellClick?.(iso, sh)}
                    className={cn(
                      "border-r border-b border-emerald-900/15 dark:border-emerald-500/15 p-1.5 align-top min-h-[92px] h-24 cursor-pointer transition-colors",
                      h && "bg-cyan-100 dark:bg-cyan-950/50",
                      !h && cellEntries.length === 0 && !isGreenAuto && "hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40",
                      isGreenAuto && "bg-lime-200 dark:bg-lime-900/50"
                    )}
                  >
                    {h ? (
                      <div className="text-[10px] font-black text-cyan-900 dark:text-cyan-100 text-center pt-4">FERIADO</div>
                    ) : isGreenAuto ? (
                      <div className="text-[10px] font-black text-lime-900 dark:text-lime-100 text-center pt-4">JANELA VERDE</div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(() => {
                          const bySub: Record<string, number> = {};
                          for (const e of cellEntries) bySub[e.subdivision] = (bySub[e.subdivision] ?? 0) + 1;
                          const hasClash = Object.values(bySub).some((n) => n > 1);
                          return hasClash ? (
                            <div className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-black uppercase bg-amber-400 text-amber-950 border border-amber-600">
                              ⚠ Choque
                            </div>
                          ) : null;
                        })()}
                        {cellEntries.slice(0, 3).map((e) => {
                          const c = entryColor(e);
                          const faded = !!e.rescheduled_to_date;
                          return (
                            <div
                              key={e.id}
                              className={cn(
                                "rounded-md px-1.5 py-1 text-[11px] leading-tight shadow-sm",
                                faded ? "border border-dashed opacity-70" : "text-white",
                                kindStyle(e)
                              )}
                              style={faded ? { borderColor: c, color: c } : { background: c, borderLeft: `4px solid rgba(0,0,0,0.28)` }}
                            >
                              <div className="font-bold truncate">
                                {e.kind === "green_zone" ? "Zona verde" : (e.subject?.name ?? "Aula")}
                                {e.is_abex && <span className="ml-1 text-[9px] font-black">ABEX</span>}
                              </div>
                              {e.kind !== "green_zone" && (() => {
                                const groups = (e.practice_groups ?? []).filter(Boolean);
                                const sub = e.subdivision === "*" ? "Todas" : (e.subdivision && e.subdivision !== "A" ? e.subdivision : "");
                                const parts = [groups.length ? `Grupos ${groups.join(", ")}` : "", sub].filter(Boolean);
                                return parts.length ? <div className="opacity-90 truncate">{parts.join(" · ")}</div> : null;
                              })()}

                              {e.rescheduled_from_entry_id && (
                                <div className="text-[9px] font-semibold">Remarcada</div>
                              )}
                              {e.rescheduled_to_date && (
                                <div className="text-[9px] font-semibold">→ {new Date(e.rescheduled_to_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
                              )}
                            </div>
                          );
                        })}
                        {cellEntries.length > 3 && (
                          <div className="text-[10px] text-muted-foreground">+{cellEntries.length - 3}</div>
                        )}
                        {(personalByCell[`${iso}|${sh}`] ?? []).map((p) => (
                          <div key={"p-" + p.id} className="rounded-md border px-1.5 py-0.5 text-[10px] leading-tight" style={{ borderLeft: `3px solid ${p.color}`, background: `${p.color}18` }}>
                            <div className="font-semibold truncate">{p.title}</div>
                            {p.start_time && <div className="opacity-70">{p.start_time.slice(0,5)}{p.end_time ? `–${p.end_time.slice(0,5)}` : ""}</div>}
                          </div>
                        ))}
                        {(extraByCell[`${iso}|${sh}`] ?? []).map((ev) => (
                          <div key={"e-" + ev.id} className="rounded-md border border-fuchsia-300 bg-fuchsia-50 dark:bg-fuchsia-950/30 px-1.5 py-0.5 text-[10px] leading-tight text-fuchsia-900 dark:text-fuchsia-100">
                            <div className="font-semibold truncate">🎉 {ev.title}</div>
                            <div className="opacity-70">{ev.source === "atletica" ? "Atlética" : "Liga"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScheduleLegend() {
  const chip = (color: string, label: string) => (
    <div className="inline-flex items-center gap-1.5 text-xs">
      <span className="size-3 rounded" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
  return (
    <div className="flex flex-wrap gap-3 py-2">
      {chip(DEFAULT_KIND_COLORS.class, "Aula")}
      {chip(DEFAULT_KIND_COLORS.practice, "Prática / ABEX")}
      {chip(DEFAULT_KIND_COLORS.exam, "Avaliação")}
      {chip(DEFAULT_KIND_COLORS.green_zone, "Zona verde")}
      {chip("#0e7490", "Feriado")}
      {chip("#a21caf", "Evento inscrito")}
    </div>
  );
}

