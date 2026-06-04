import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtBRL, totalDia, monthKey, parseISODate } from "@/lib/calc";
import { toast } from "sonner";
import { History, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/historico")({
  component: HistoricoPage,
});

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function HistoricoPage() {
  const qc = useQueryClient();
  const cur = monthKey(new Date());
  const [year, setYear] = useState(cur.year);
  const [month, setMonth] = useState(cur.month);

  const { data: sales = [] } = useQuery({
    queryKey: ["sales", year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = new Date(year, month, 0);
      const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("daily_sales")
        .select("*")
        .gte("sale_date", start).lte("sale_date", end)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento removido");
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const totals = sales.reduce(
    (acc, s) => {
      acc.faturadoLoja += Number(s.faturado_loja);
      acc.ml += Number(s.mercado_livre);
      acc.full += Number(s.full_value);
      acc.vendaLoja += Number(s.venda_loja);
      acc.total += totalDia(s);
      return acc;
    },
    { faturadoLoja: 0, ml: 0, full: 0, vendaLoja: 0, total: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Histórico Mensal</h1>
          <p className="text-sm text-muted-foreground">Veja, edite ou remova lançamentos do mês.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
          <CardDescription>Filtrar lançamentos por mês.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }).map((_, i) => {
                const y = cur.year - 2 + i;
                return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos de {MONTHS[month - 1]} / {year}</CardTitle>
          <CardDescription>{sales.length} {sales.length === 1 ? "registro" : "registros"}</CardDescription>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum lançamento neste período.
              <div className="mt-3">
                <Link to="/lancamento"><Button size="sm">Criar primeiro lançamento</Button></Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Venda Loja</TableHead>
                    <TableHead className="text-right">Faturado Loja</TableHead>
                    <TableHead className="text-right">Mercado Livre</TableHead>
                    <TableHead className="text-right">Full</TableHead>
                    <TableHead className="text-right">Total dia</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{parseISODate(s.sale_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtBRL(Number(s.venda_loja))}</TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(s.faturado_loja))}</TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(s.mercado_livre))}</TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(s.full_value))}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(totalDia(s))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link to="/lancamento" search={{ d: s.sale_date } as never}>
                            <Button size="icon" variant="ghost" title="Editar"><Pencil className="h-4 w-4" /></Button>
                          </Link>
                          <Button size="icon" variant="ghost" title="Excluir"
                            onClick={() => { if (confirm("Excluir este lançamento?")) del.mutate(s.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Totais</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtBRL(totals.vendaLoja)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(totals.faturadoLoja)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(totals.ml)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(totals.full)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(totals.total)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
