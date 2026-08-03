/** Lógica de importação de cronograma (servidor). */

type Sub = { name: string; professor?: string | null; groups?: string[] | null };
type Entry = {
  date: string;
  shift: "morning" | "afternoon" | "night";
  start_time: string;
  end_time: string;
  kind: "class" | "practice" | "exam" | "green_zone" | "abex";
  is_abex: boolean;
  subject_name?: string | null;
  notes?: string | null;
  practice_groups?: string[] | null;
};

export async function runScheduleImport(
  supabase: any,
  userId: string,
  input: {
    class_code: string;
    subdivision: string;
    term_id?: string | null;
    replace: boolean;
    subjects: Sub[];
    groups?: string[];
    entries: Entry[];
  },
) {
  const { class_code, subdivision, term_id, replace, subjects, entries } = input;
  const groups = (input.groups ?? []).map((g) => g.trim().toUpperCase()).filter(Boolean);

  // 0) garante as turmas (A, B, C…) confirmadas pela coordenação
  if (groups.length) {
    const { data: existingGroups } = await supabase
      .from("class_subdivisions").select("letter").eq("class_code", class_code);
    const have = new Set((existingGroups ?? []).map((g: any) => String(g.letter).toUpperCase()));
    const missing = groups.filter((g) => !have.has(g));
    if (missing.length) {
      await supabase.from("class_subdivisions").insert(missing.map((letter) => ({ class_code, letter })));
    }
  }

  // 1) garante os componentes curriculares (com suas turmas de prática)
  const byName = new Map<string, string>();
  const groupsByName = new Map<string, string[]>();
  if (subjects.length) {
    const { data: existing } = await supabase.from("subjects").select("id,name,class_codes");
    const existingList = (existing ?? []) as any[];
    for (const s of subjects) {
      const subGroups = Array.from(
        new Set((s.groups ?? []).map((g) => String(g).trim().toUpperCase()).filter(Boolean)),
      ).sort();
      const finalGroups = subGroups.length ? subGroups : ["A"];
      groupsByName.set(s.name.toLowerCase(), finalGroups);
      const found = existingList.find((e) => String(e.name).trim().toLowerCase() === s.name.trim().toLowerCase());
      if (found) {
        byName.set(s.name.toLowerCase(), found.id);
        const codes: string[] = Array.isArray(found.class_codes) ? found.class_codes : [];
        const patch: any = { subdivisions: finalGroups };
        if (!codes.includes(class_code)) patch.class_codes = [...codes, class_code];
        await supabase.from("subjects").update(patch).eq("id", found.id);
        continue;
      }
      const { data: ins } = await supabase
        .from("subjects")
        .insert({
          name: s.name,
          professor: s.professor ?? null,
          class_codes: [class_code],
          subdivisions: finalGroups,
        })
        .select("id")
        .single();
      if (ins?.id) byName.set(s.name.toLowerCase(), ins.id);
    }
  }


  if (!entries.length) return { subjects: byName.size, entries: 0, replaced: 0 };

  const dates = entries.map((e) => e.date).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];

  let replaced = 0;
  if (replace) {
    const { data: del } = await supabase
      .from("schedule_entries")
      .delete()
      .eq("class_code", class_code)
      .gte("date", from)
      .lte("date", to)
      .select("id");
    replaced = (del ?? []).length;
  }

  const rows = entries.map((e) => ({
    term_id: term_id ?? null,
    subject_id: e.subject_name ? byName.get(e.subject_name.toLowerCase()) ?? null : null,
    class_code,
    subdivision: subdivision || "A",
    date: e.date,
    shift: e.shift,
    start_time: e.start_time,
    end_time: e.end_time,
    kind: e.kind,
    is_abex: e.is_abex,
    // [] = todas as turmas; null = não identificado (a coordenação ajusta depois)
    practice_groups:
      e.practice_groups === null || e.practice_groups === undefined
        ? []
        : e.practice_groups.length === 0 && (e.kind === "practice" || e.kind === "abex" || e.is_abex)
          ? groups
          : e.practice_groups,
    notes: e.notes ?? null,
    created_by: userId,
  }));

  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from("schedule_entries").insert(rows.slice(i, i + 400));
    if (error) throw error;
  }

  return { subjects: byName.size, entries: rows.length, replaced, from, to };
}
