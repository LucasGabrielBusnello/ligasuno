import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { NOT_OFFICIAL_NOTICE } from "@/lib/terms";

export function NotOfficialNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`container mx-auto px-4 py-6 ${className}`}>
      <p className="mx-auto max-w-3xl text-center text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mr-1 inline size-3 align-[-2px]" />
        {NOT_OFFICIAL_NOTICE}{" "}
        <Link to="/termos" className="underline underline-offset-2 hover:text-foreground">
          Ver termos de uso
        </Link>
      </p>
    </div>
  );
}
