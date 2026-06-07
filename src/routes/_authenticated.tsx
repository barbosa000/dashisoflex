import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  PlusSquare,
  History,
  Target,
  LogOut,
  TrendingUp,
  Menu,
  FileText,
  Megaphone,
  Briefcase,
  DollarSign,
  Users as UsersIcon,
  Cog,
  Factory,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMe, hasModule, type AppModule } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

const allNav: { to: string; label: string; icon: typeof LayoutDashboard; mod: AppModule }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mod: "dashboard" },
  { to: "/lancamento", label: "Lançamento", icon: PlusSquare, mod: "lancamento" },
  { to: "/historico", label: "Histórico", icon: History, mod: "historico" },
  { to: "/metas", label: "Metas", icon: Target, mod: "metas" },
  { to: "/relatorio", label: "Relatório", icon: FileText, mod: "relatorio" },
  { to: "/marketing", label: "Marketing", icon: Megaphone, mod: "marketing" },
  { to: "/comercial", label: "Comercial", icon: Briefcase, mod: "comercial" },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign, mod: "financeiro" },
  { to: "/rh", label: "RH", icon: UsersIcon, mod: "rh" },
  { to: "/producao", label: "Produção", icon: Factory, mod: "producao" },
  { to: "/configuracoes", label: "Configurações", icon: Cog, mod: "configuracoes" },
  { to: "/usuarios", label: "Usuários", icon: ShieldCheck, mod: "usuarios" },
];

function Layout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { data: me } = useMe();

  const isMaster = me?.roles.includes("admin_master") ?? false;
  const nav = allNav.filter((n) => hasModule(me?.permissions, n.mod, isMaster));

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex sticky top-0 h-screen w-64 shrink-0 flex-col border-r bg-card">
          <div className="flex items-center gap-3 px-5 py-5 border-b">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold leading-tight">Isoflex</div>
              <div className="text-xs text-muted-foreground leading-tight">Gestão Corporativa</div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t p-3">
            <div className="mb-2 truncate px-2 text-xs text-muted-foreground">
              {me?.profile?.full_name || me?.email}
              {isMaster && (
                <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  MASTER
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="text-sm font-bold">Isoflex</div>
            </div>
            <div className="hidden lg:block">
              <h1 className="text-base font-semibold capitalize">
                {pathname.replace("/", "") || "Dashboard"}
              </h1>
            </div>
            <div className="text-xs text-muted-foreground hidden sm:block">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>
          </header>
          {open && (
            <div className="border-b bg-card lg:hidden">
              <div className="flex flex-col gap-1 p-3">
                {nav.map((n) => {
                  const Icon = n.icon;
                  const active = pathname.startsWith(n.to);
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" /> {n.label}
                    </Link>
                  );
                })}
                <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
                  <LogOut className="h-4 w-4" /> Sair
                </Button>
              </div>
            </div>
          )}
          <main className="flex-1 p-4 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
