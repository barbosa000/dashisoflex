import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, PlusSquare, History, Target, LogOut, TrendingUp, Menu, FileText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lancamento", label: "Lançamento", icon: PlusSquare },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/relatorio", label: "Relatório", icon: FileText },
] as const;

function Layout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">Isoflex</div>
              <div className="text-xs text-muted-foreground leading-tight">Relatório de Vendas</div>
            </div>
          </div>
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = pathname.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}>
                  <Icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden md:inline-flex">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {open && (
          <div className="border-t md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-2">
              {nav.map((n) => {
                const Icon = n.icon;
                const active = pathname.startsWith(n.to);
                return (
                  <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                    )}>
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
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
