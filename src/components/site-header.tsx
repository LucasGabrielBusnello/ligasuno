import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  LogIn,
  LogOut,
  UserCircle,
  Trophy,
  Users,
  Building2,
  Stethoscope,
  Menu,
  X,
  Settings2,
  Shield,
  Handshake,

} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, signOut } from "@/hooks/use-auth";
import { ProfileEditDialog } from "@/components/profile-edit-dialog";
import { ProfileReviewDialog } from "@/components/profile-review-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/aluno", label: "Aluno", icon: Stethoscope },
  { to: "/aaamd", label: "AAAMD", icon: Trophy },
  { to: "/ligas", label: "Ligas", icon: Users },
  { to: "/camed", label: "CAMED", icon: Building2 },
  { to: "/parceiros", label: "Parceiros", icon: Handshake },
] as const;


export function SiteHeader() {
  const { user, profile, isCoordination, isAdminMaster, isCamedPresident, camedPanelTabs, loading } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [profileOpen, setProfileOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const needsReview = useMemo(() => {
    if (!user || !profile) return false;
    // reviewed = ok
    if ((profile as any).profile_reviewed_at) return false;
    return true;
  }, [user, profile]);

  useEffect(() => {
    if (needsReview) setReviewOpen(true);
  }, [needsReview]);

  // Hide on auth route
  if (pathname.startsWith("/auth")) return null;

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                <GraduationCap className="size-5 text-primary-foreground" />
              </div>
              <div className="font-black text-lg tracking-tight leading-none">MEDUNO</div>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => {
                const Icon = n.icon;
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="size-4" /> {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden inline-flex size-9 items-center justify-center rounded-full hover:bg-accent"
              aria-label="Menu"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            {loading ? null : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-2 rounded-full pl-2 pr-1 py-1 hover:bg-accent transition-colors">
                    <span className="hidden sm:inline text-sm text-muted-foreground max-w-[140px] truncate">
                      {profile?.username ?? user.email}
                    </span>
                    <span className="size-9 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center">
                      <UserCircle className="size-5" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {profile?.full_name ?? profile?.username ?? user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>Editar dados</DropdownMenuItem>
                  {isCoordination && (
                    <DropdownMenuItem onClick={() => nav({ to: "/coordenacao/cronograma" })}>
                      <Settings2 className="size-4" /> Painel da Coordenação
                    </DropdownMenuItem>
                  )}
                  {(isCamedPresident || camedPanelTabs.length > 0) && (
                    <DropdownMenuItem onClick={() => nav({ to: "/camed-painel" })}>
                      <Building2 className="size-4" /> Painel do CAMED
                    </DropdownMenuItem>
                  )}
                  {isAdminMaster && (
                    <DropdownMenuItem onClick={() => nav({ to: "/admin" })}>
                      <Shield className="size-4" /> Painel do Administrador
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="size-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">
                  <LogIn className="size-4" /> Entrar
                </Link>
              </Button>
            )}
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur px-3 py-2">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => {
                const Icon = n.icon;
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setMenuOpen(false)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="size-4" /> {n.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {user && (
        <>
          <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen} userId={user.id} />
          <ProfileReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} userId={user.id} />
        </>
      )}
    </>
  );
}
