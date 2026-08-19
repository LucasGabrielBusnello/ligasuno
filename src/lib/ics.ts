/** Geração de arquivo .ics (iCalendar) para exportar o cronograma para a agenda. */

export type IcsEvent = {
  uid: string;
  title: string;
  date: string; // yyyy-mm-dd
  start?: string | null; // HH:MM
  end?: string | null; // HH:MM
  description?: string | null;
  location?: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toStamp(d: Date) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function localDT(date: string, time: string) {
  return date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
}

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(events: IcsEvent[], calName = "MEDHUB — Cronograma") {
  const now = toStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MEDHUB//Cronograma//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
  ];
  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}@meduno`);
    lines.push(`DTSTAMP:${now}`);
    if (ev.start) {
      lines.push(`DTSTART;TZID=America/Sao_Paulo:${localDT(ev.date, ev.start.slice(0, 5))}`);
      lines.push(
        `DTEND;TZID=America/Sao_Paulo:${localDT(ev.date, (ev.end ?? ev.start).slice(0, 5))}`
      );
    } else {
      const d = new Date(ev.date + "T00:00:00");
      d.setDate(d.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${ev.date.replace(/-/g, "")}`);
      lines.push(`DTEND;VALUE=DATE:${d.toISOString().slice(0, 10).replace(/-/g, "")}`);
    }
    lines.push(`SUMMARY:${esc(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-PT30M");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${esc(ev.title)}`);
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(content: string, filename = "meduno-cronograma.ics") {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
