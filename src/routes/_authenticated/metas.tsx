import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { fmtBRL, daysInMonth, monthKey } from "@/lib/calc";
import { Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/metas")({
  component: MetasPage,
});

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function MetasPage() {
  const qc = useQueryClient();
  const now = new Date();
  const cur = monthKey(now);
  const [year, setYear] = useState(cur.year);
  const [month, setMonth] = useState(cur.month);
  const [metaLoja, setMetaLoja] = useState("0");
  const [metaML, setMetaML] = useState("0");
  const [diasUteis, setDiasUteis] = useState("22");

  const { data: goal } = useQuery({
    queryKey: ["goal", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_goals")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setMetaLoja(String(goal?.meta_loja ?? 0));
    setMetaML(String(goal?.meta_mercado_livre ?? 0));
    setDiasUteis(String(goal?.dias_uteis ?? 22));
  }, [goal]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const payload = {
        user_id: u.user.id,
        year,
        month,
        meta_loja: Number(metaLoja) || 0,
        meta_mercado_livre: Number(metaML) || 0,
        dias_uteis: Number(diasUteis) || 22,
      };
      const { error } = await supabase
        .from("monthly_goals")
        .upsert(payload, { onConflict: "user_id,year,month" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Metas salvas!");
      qc.invalidateQueries({ queryKey: ["goal"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const metaLojaN = Number(metaLoja) || 0;
  const metaMLN = Number(metaML) || 0;
  const diasUteisN = Number(diasUteis) || 1;
  const totalDiasMes = daysInMonth(year, month);
  const metaTotal = metaLojaN + metaMLN;
  const metaDiaLoja = metaLojaN / Math.max(diasUteisN, 1);
  const metaDiaML = metaMLN / Math.max(totalDiasMes, 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configuração de Metas</h1>
          <p className="text-sm text-muted-foreground">
            Defina a meta mensal de cada canal e os dias úteis do mês.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
          <CardDescription>Escolha o mês para configurar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Mês</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ano</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metas do mês</CardTitle>
          <CardDescription>
            Loja Virtual usa <b>dias úteis</b> · Mercado Livre usa <b>dias totais</b> (
            {totalDiasMes} dias)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Meta Loja Virtual (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={metaLoja}
              onChange={(e) => setMetaLoja(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Diária: <b>{fmtBRL(metaDiaLoja)}</b>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Meta Mercado Livre (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={metaML}
              onChange={(e) => setMetaML(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Diária: <b>{fmtBRL(metaDiaML)}</b>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Dias úteis do mês</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={diasUteis}
              onChange={(e) => setDiasUteis(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Aplicado à meta da Loja Virtual</p>
          </div>
          <div className="sm:col-span-3 rounded-lg border bg-muted/40 p-4">
            <div className="text-xs text-muted-foreground">Meta mensal total (Loja + ML)</div>
            <div className="text-2xl font-bold">{fmtBRL(metaTotal)}</div>
          </div>
          <div className="sm:col-span-3">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar metas"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
