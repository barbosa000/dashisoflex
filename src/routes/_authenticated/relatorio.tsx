import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { fmtBRL, monthKey, totalDia, parseISODate } from "@/lib/calc";
import { FileText, Mail, Download, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/relatorio")({
  component: RelatorioPage,
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

function RelatorioPage() {
  const cur = monthKey(new Date());
  const [year, setYear] = useState(cur.year);
  const [month, setMonth] = useState(cur.month);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: sales = [] } = useQuery({
    queryKey: ["sales", year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const endD = new Date(year, month, 0);
      const end = `${year}-${String(month).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("daily_sales")
        .select("*")
        .gte("sale_date", start)
        .lte("sale_date", end)
        .order("sale_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const totals = { loja: 0, ml: 0, full: 0, total: 0 };
    let peak = { date: "", value: 0 };
    const daily = sales.map((s) => {
      const t = totalDia(s);
      totals.loja += Number(s.faturado_loja);
      totals.ml += Number(s.mercado_livre);
      totals.full += Number(s.full_value);
      totals.total += t;
      if (t > peak.value) peak = { date: s.sale_date, value: t };
      return {
        day: parseISODate(s.sale_date).getDate(),
        date: s.sale_date,
        loja: Number(s.faturado_loja),
        ml: Number(s.mercado_livre),
        full: Number(s.full_value),
        total: t,
      };
    });
    let acc = 0;
    const cumulative = daily.map((d) => ({ day: d.day, acumulado: (acc += d.total) }));
    return { totals, peak, daily, cumulative };
  }, [sales]);

  const handlePrint = () => window.print();

  const handleEmail = () => {
    const subject = `Relatório de Vendas - ${MONTHS[month - 1]}/${year}`;
    const lines = [
      `Relatório de Vendas - ${MONTHS[month - 1]}/${year}`,
      ``,
      `Faturamento Total: ${fmtBRL(stats.totals.total)}`,
      `Loja Virtual: ${fmtBRL(stats.totals.loja)}`,
      `Mercado Livre: ${fmtBRL(stats.totals.ml)}`,
      `Full: ${fmtBRL(stats.totals.full)}`,
      ``,
      `Pico de Vendas: ${stats.peak.date ? parseISODate(stats.peak.date).toLocaleDateString("pt-BR") : "-"} (${fmtBRL(stats.peak.value)})`,
      `Registros: ${sales.length} dias`,
    ].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
    toast.success("Abrindo cliente de e-mail...");
  };

  return (
    <div className="space-y-6">
      <style>{`@media print {
        body * { visibility: hidden; }
        #report-area, #report-area * { visibility: visible; }
        #report-area { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Relatório Geral</h1>
            <p className="text-sm text-muted-foreground">
              Emissão de relatório e histórico com gráficos.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEmail}>
            <Mail className="h-4 w-4" /> Enviar por E-mail
          </Button>
          <Button onClick={handlePrint}>
            <Download className="h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      <div id="report-area" ref={reportRef} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Período do Relatório</CardTitle>
            <CardDescription>Filtre o mês para visualizar e exportar.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40">
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
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = cur.year - 2 + i;
                  return (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardDescription>Faturamento Total ({MONTHS[month - 1]})</CardDescription>
              <CardTitle className="text-3xl">{fmtBRL(stats.totals.total)}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div>
                Loja Virtual:{" "}
                <span className="text-foreground font-medium">{fmtBRL(stats.totals.loja)}</span>
              </div>
              <div>
                Mercado Livre + Full:{" "}
                <span className="text-foreground font-medium">
                  {fmtBRL(stats.totals.ml + stats.totals.full)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pico de Vendas no Mês</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Trophy className="h-6 w-6 text-amber-500" />
                {stats.peak.date ? parseISODate(stats.peak.date).toLocaleDateString("pt-BR") : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <div>
                Faturamento:{" "}
                <span className="text-foreground font-medium">{fmtBRL(stats.peak.value)}</span>
              </div>
              <div>Maior resultado diário no período</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Registros</CardDescription>
              <CardTitle className="text-3xl">{sales.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Dias com faturamento lançado.
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Evolução Acumulada</CardTitle>
              <CardDescription>Crescimento do faturamento total ao longo do mês</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.cumulative}>
                  <defs>
                    <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Area
                    type="monotone"
                    dataKey="acumulado"
                    stroke="hsl(var(--primary))"
                    fill="url(#gAcc)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Faturamento Diário</CardTitle>
              <CardDescription>Comparação de canais vs Faturamento Total</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.daily}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend />
                  <Bar dataKey="loja" name="Loja Virtual" stackId="a" fill="#10b981" />
                  <Bar dataKey="ml" name="Mercado Livre" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="full" name="Full" stackId="a" fill="#3b82f6" />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total Diário"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalhamento Diário</CardTitle>
            <CardDescription>Todos os registros do período</CardDescription>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum lançamento neste período.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Loja Virtual</TableHead>
                    <TableHead className="text-right">Mercado Livre</TableHead>
                    <TableHead className="text-right">Full</TableHead>
                    <TableHead className="text-right">Total Diário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...stats.daily].reverse().map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium">
                        {parseISODate(d.date).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(d.loja)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(d.ml)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(d.full)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(d.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Total Geral</TableCell>
                    <TableCell className="text-right font-bold">
                      {fmtBRL(stats.totals.loja)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {fmtBRL(stats.totals.ml)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {fmtBRL(stats.totals.full)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {fmtBRL(stats.totals.total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
