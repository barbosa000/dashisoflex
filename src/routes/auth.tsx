import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { TrendingUp, ShieldAlert, Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => localStorage.getItem("rememberEmail") ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => !!localStorage.getItem("rememberEmail"));
  const [loading, setLoading] = useState(false);
  const [lock, setLock] = useState<{ locked: boolean; until?: string; remaining?: number } | null>(
    null,
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function recordAttempt(targetEmail: string, success: boolean) {
    try {
      const { data } = await supabase.rpc("record_login_attempt", {
        _email: targetEmail,
        _ip: "",
        _ua: navigator.userAgent.slice(0, 200),
        _success: success,
      });
      const r = data as { locked: boolean; locked_until?: string; attempts_remaining?: number };
      setLock({ locked: r?.locked, until: r?.locked_until, remaining: r?.attempts_remaining });
      return r;
    } catch {
      return null;
    }
  }

      const r = data as { locked: boolean; locked_until?: string; attempts_remaining?: number };
      setLock({ locked: r?.locked, until: r?.locked_until, remaining: r?.attempts_remaining });
      return r;
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      // 1) verifica bloqueio
      const { data: checkData } = await supabase.rpc("check_login_lock", { _email: email });
      const ck = checkData as { locked: boolean; locked_until?: string; attempts_remaining?: number };
      if (ck?.locked) {
        setLock({ locked: true, until: ck.locked_until, remaining: 0 });
        toast.error("Conta temporariamente bloqueada por excesso de tentativas.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const r = await recordAttempt(email, false);
        if (r?.locked) {
          toast.error("Bloqueado após 5 tentativas. Tente novamente em 15 minutos.");
        } else {
          toast.error(
            `Credenciais inválidas. ${r?.attempts_remaining ?? "?"} tentativa(s) restante(s).`,
          );
        }
      } else {
        await recordAttempt(email, true);
        if (remember) localStorage.setItem("rememberEmail", email);
        else localStorage.removeItem("rememberEmail");
        toast.success("Bem-vindo!");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  const blocked = lock?.locked === true;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <TrendingUp className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Isoflex — Acesso seguro</CardTitle>
          <CardDescription>Entre com suas credenciais corporativas</CardDescription>
        </CardHeader>
        <CardContent>
          {blocked && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Conta bloqueada temporariamente</p>
                <p>
                  Muitas tentativas inválidas.
                  {lock?.until && (
                    <> Tente novamente após {new Date(lock.until).toLocaleTimeString("pt-BR")}.</>
                  )}
                </p>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                maxLength={128}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                  id="remember"
                />
                <span>Lembrar-me</span>
              </label>
              <Link
                to="/auth/forgot"
                className="font-medium text-primary hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading || blocked}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="mt-4 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Sessão protegida — bloqueio após 5 tentativas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
