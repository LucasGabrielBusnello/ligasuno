import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/perfil")({
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
});
