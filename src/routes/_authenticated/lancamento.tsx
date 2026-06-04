import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmtBRL, isoDate, totalDia } from "@/lib/calc";
import { PlusSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lancamento")({
  component: LancamentoPage,
});

function LancamentoPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(isoDate(new Date()));
  const [vendaLoja, setVendaLoja] = useState("0");
  const [faturadoLoja, setFaturadoLoja] = useState("0");
  const [ml, setMl] = useState("0");
  const [full, setFull] = useState("0");

  const { data: existing } = useQuery({
    queryKey: ["sale", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_sales")
        .select("*")
        .eq("sale_date", date)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setVendaLoja(String(existing?.venda_loja ?? 0));
    setFaturadoLoja(String(existing?.faturado_loja ?? 0));
    setMl(String(existing?.mercado_livre ?? 0));
    setFull(String(existing?.full_value ?? 0));
  }, [existing, date]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const payload = {
        user_id: u.user.id,
        sale_date: date,
        venda_loja: Number(vendaLoja) || 0,
        faturado_loja: Number(faturadoLoja) || 0,
        mercado_livre: Number(ml) || 0,
        full_value: Number(full) || 0,
      };
      const { error } = await supabase
        .from("daily_sales")
        .upsert(payload, { onConflict: "user_id,sale_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(existing ? "Lançamento atualizado!" : "Lançamento criado!");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sale"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const total = totalDia({
    faturado_loja: Number(faturadoLoja) || 0,
    mercado_livre: Number(ml) || 0,
    full_value: Number(full) || 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PlusSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Lançamento Diário</h1>
          <p className="text-sm text-muted-foreground">Insira ou atualize os valores faturados do dia.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>Escolha a data para lançar ou editar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
          {existing && (
            <p className="mt-2 text-xs text-muted-foreground">Já existe lançamento para esta data — os valores serão atualizados.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valores</CardTitle>
          <CardDescription>Todos os valores em R$.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Venda Loja Física</Label>
            <Input type="number" step="0.01" value={vendaLoja} onChange={(e) => setVendaLoja(e.target.value)} />
            <p className="text-xs text-muted-foreground">Informativo — não entra no total do dia.</p>
          </div>
          <div className="space-y-2">
            <Label>Faturado Loja Virtual</Label>
            <Input type="number" step="0.01" value={faturadoLoja} onChange={(e) => setFaturadoLoja(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Mercado Livre</Label>
            <Input type="number" step="0.01" value={ml} onChange={(e) => setMl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Full</Label>
            <Input type="number" step="0.01" value={full} onChange={(e) => setFull(e.target.value)} />
          </div>

          <div className="sm:col-span-2 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
            <div className="text-xs text-muted-foreground">Total faturado do dia (Loja Virtual + ML + Full)</div>
            <div className="text-3xl font-bold text-primary">{fmtBRL(total)}</div>
          </div>

          <div className="sm:col-span-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full sm:w-auto">
              {save.isPending ? "Salvando..." : existing ? "Atualizar lançamento" : "Salvar lançamento"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
