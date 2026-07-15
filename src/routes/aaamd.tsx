import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/aaamd")({
  beforeLoad: () => {
    throw redirect({ to: "/atletica" });
  },
});
