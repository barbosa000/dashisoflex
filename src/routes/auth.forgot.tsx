import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth/forgot")({
  ssr: false,
  component: ForgotPage,
});

const schema = z.object({ email: z.string().trim().email("E-mail inválido").max(255) });

function ForgotPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "E-mail inválido");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Recuperar senha</CardTitle>
          <CardDescription>
            Enviaremos um link para você redefinir sua senha
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">E-mail enviado!</p>
                <p>
                  Verifique a caixa de entrada de <strong>{email}</strong>. O link expira em 1 hora.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Voltar para o login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  placeholder="voce@isoflex.com.br"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <Link
                to="/auth"
                className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Voltar ao login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
