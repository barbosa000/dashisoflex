import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { fmtBRL, fmtPct, monthKey, totalDia, parseISODate, daysInMonth, statusColor } from "@/lib/calc";
import { FileText, Mail, Download, Trophy, TrendingUp, Target, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/relatorio")({
  component: RelatorioPage,
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS = {
  good: "#10b981",
  warn: "#f59e0b",
  bad: "#ef4444",
};

function colorFor(pct: number) {
  return pct >= 100 ? STATUS.good : pct >= 80 ? STATUS.warn : STATUS.bad;
}

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

  const metaLoja = Number(goal?.meta_loja ?? 0);
  const metaML = Number(goal?.meta_mercado_livre ?? 0);
  const diasUteis = Number(goal?.dias_uteis ?? 22);
  const totalDiasMes = daysInMonth(year, month);
  const metaTotal = metaLoja + metaML;
  const metaDiaTotal = metaLoja / Math.max(diasUteis, 1) + metaML / Math.max(totalDiasMes, 1);

  const stats = useMemo(() => {
    const totals = { loja: 0, ml: 0, full: 0, total: 0 };
    let peak = { date: "", value: 0 };
    let diasAcimaMeta = 0;
    const daily = sales.map((s) => {
      const t = totalDia(s);
      totals.loja += Number(s.faturado_loja);
      totals.ml += Number(s.mercado_livre);
      totals.full += Number(s.full_value);
      totals.total += t;
      if (t > peak.value) peak = { date: s.sale_date, value: t };
      if (metaDiaTotal > 0 && t >= metaDiaTotal) diasAcimaMeta++;
      const pct = metaDiaTotal > 0 ? (t / metaDiaTotal) * 100 : 0;
      return {
        day: parseISODate(s.sale_date).getDate(),
        date: s.sale_date,
        loja: Number(s.faturado_loja),
        ml: Number(s.mercado_livre),
        full: Number(s.full_value),
        total: t,
        pct,
        color: colorFor(pct),
      };
    });
    let acc = 0;
    const cumulative = daily.map((d) => {
      acc += d.total;
      const expected = (metaTotal / totalDiasMes) * d.day;
      return { day: d.day, acumulado: acc, meta: expected, metaFinal: metaTotal };
    });
    return { totals, peak, daily, cumulative, diasAcimaMeta };
  }, [sales, metaDiaTotal, metaTotal, totalDiasMes]);

  const pctMes = metaTotal > 0 ? (stats.totals.total / metaTotal) * 100 : 0;
  const ticket = stats.daily.length > 0 ? stats.totals.total / stats.daily.length : 0;
  const projecao = stats.daily.length > 0 ? (stats.totals.total / stats.daily.length) * totalDiasMes : 0;

  const pieData = [
    { name: "Loja Virtual", value: stats.totals.loja, color: "#0f52ba" },
    { name: "Mercado Livre", value: stats.totals.ml, color: "#f59e0b" },
    { name: "Full", value: stats.totals.full, color: "#10b981" },
  ];

  const radialData = [
    { name: "Atingido", value: Math.min(pctMes, 100), fill: colorFor(pctMes) },
  ];

  const handlePrint = () => window.print();

  const handleEmail = () => {
    const subject = `Relatório de Vendas - ${MONTHS[month - 1]}/${year}`;
    const lines = [
      `Relatório de Vendas - ${MONTHS[month - 1]}/${year}`,
      ``,
      `Faturamento Total: ${fmtBRL(stats.totals.total)}`,
      `Meta: ${fmtBRL(metaTotal)} (${fmtPct(pctMes)})`,
      `Loja Virtual: ${fmtBRL(stats.totals.loja)}`,
      `Mercado Livre: ${fmtBRL(stats.totals.ml)}`,
      `Full: ${fmtBRL(stats.totals.full)}`,
      `Ticket médio diário: ${fmtBRL(ticket)}`,
      `Projeção do mês: ${fmtBRL(projecao)}`,
      `Dias acima da meta: ${stats.diasAcimaMeta}/${stats.daily.length}`,
      ``,
      `Pico: ${stats.peak.date ? parseISODate(stats.peak.date).toLocaleDateString("pt-BR") : "-"} (${fmtBRL(stats.peak.value)})`,
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
              Indicadores visuais e detalhamento por canal.
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
        <Card className="custom-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Período do Relatório</CardTitle>
            <CardDescription>Filtre o mês para visualizar e exportar.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
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

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiBig
            title="Faturamento Total"
            value={fmtBRL(stats.totals.total)}
            subtitle={`Meta: ${fmtBRL(metaTotal)}`}
            tone={statusColor(pctMes)}
            icon={TrendingUp}
          />
          <KpiBig
            title="% da Meta"
            value={fmtPct(pctMes)}
            subtitle={pctMes >= 100 ? "Meta batida 🎉" : `Faltam ${fmtBRL(Math.max(metaTotal - stats.totals.total, 0))}`}
            tone={statusColor(pctMes)}
            icon={Target}
          />
          <KpiBig
            title="Projeção do mês"
            value={fmtBRL(projecao)}
            subtitle={`Ticket médio diário: ${fmtBRL(ticket)}`}
            tone={statusColor(metaTotal > 0 ? (projecao / metaTotal) * 100 : 0)}
            icon={Calendar}
          />
          <KpiBig
            title="Dias acima da meta"
            value={`${stats.diasAcimaMeta} / ${stats.daily.length}`}
            subtitle={stats.peak.date ? `Pico: ${parseISODate(stats.peak.date).toLocaleDateString("pt-BR")}` : "—"}
            tone={stats.daily.length > 0 && stats.diasAcimaMeta / stats.daily.length >= 0.5 ? "success" : "warning"}
            icon={Trophy}
          />
        </div>

        {/* Radial + Pie + Channel progress */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="custom-shadow">
            <CardHeader>
              <CardTitle className="text-base">Atingimento da Meta</CardTitle>
              <CardDescription>Mês corrente</CardDescription>
            </CardHeader>
            <CardContent className="h-[260px] flex items-center justify-center relative">
              <ResponsiveContainer>
                <RadialBarChart
                  innerRadius="65%"
                  outerRadius="100%"
                  data={radialData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar dataKey="value" cornerRadius={12} background={{ fill: "#f1f5f9" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-3xl font-black" style={{ color: colorFor(pctMes) }}>
                  {fmtPct(pctMes)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">da meta mensal</div>
              </div>
            </CardContent>
          </Card>

          <Card className="custom-shadow">
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Canal</CardTitle>
              <CardDescription>Participação no faturamento</CardDescription>
            </CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="custom-shadow">
            <CardHeader>
              <CardTitle className="text-base">Canais vs Meta</CardTitle>
              <CardDescription>Desempenho por canal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <ChannelBar label="Loja Virtual" realizado={stats.totals.loja} meta={metaLoja} />
              <ChannelBar label="Mercado Livre" realizado={stats.totals.ml} meta={metaML} />
              <ChannelBar label="Full" realizado={stats.totals.full} meta={0} hideMeta />
            </CardContent>
          </Card>
        </div>

        {/* Big charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="custom-shadow">
            <CardHeader>
              <CardTitle className="text-base">Evolução Acumulada vs Meta Esperada</CardTitle>
              <CardDescription>Comparativo com o ritmo necessário para bater a meta</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer>
                <AreaChart data={stats.cumulative}>
                  <defs>
                    <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f52ba" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#0f52ba" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={metaTotal} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Meta final", position: "insideTopRight", fontSize: 10, fill: "#10b981" }} />
                  <Area type="monotone" dataKey="acumulado" name="Realizado" stroke="#0f52ba" fill="url(#gAcc)" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="meta" name="Meta esperada" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="custom-shadow">
            <CardHeader>
              <CardTitle className="text-base">Faturamento Diário por Status</CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-1.5 mr-3"><span className="h-2 w-2 rounded-full bg-[#10b981]" /> Meta batida</span>
                <span className="inline-flex items-center gap-1.5 mr-3"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Próximo (≥80%)</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ef4444]" /> Abaixo</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer>
                <ComposedChart data={stats.daily}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <ReferenceLine y={metaDiaTotal} stroke="#0f52ba" strokeDasharray="4 4" label={{ value: "Meta dia", position: "insideTopRight", fontSize: 10, fill: "#0f52ba" }} />
                  <Bar dataKey="total" name="Total" radius={[6, 6, 0, 0]}>
                    {stats.daily.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="custom-shadow">
          <CardHeader>
            <CardTitle className="text-base">Composição por Canal (empilhado)</CardTitle>
            <CardDescription>Loja Virtual + Mercado Livre + Full por dia</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer>
              <BarChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="loja" name="Loja Virtual" stackId="a" fill="#0f52ba" />
                <Bar dataKey="ml" name="Mercado Livre" stackId="a" fill="#f59e0b" />
                <Bar dataKey="full" name="Full" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="custom-shadow">
          <CardHeader>
            <CardTitle className="text-base">Detalhamento Diário</CardTitle>
            <CardDescription>Todos os registros do período, com status diário</CardDescription>
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
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">% Meta dia</TableHead>
                    <TableHead className="text-center">Status</TableHead>
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
                      <TableCell className="text-right" style={{ color: d.color }}>{fmtPct(d.pct)}</TableCell>
                      <TableCell className="text-center">
                        <StatusPill pct={d.pct} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Total Geral</TableCell>
                    <TableCell className="text-right font-bold">{fmtBRL(stats.totals.loja)}</TableCell>
                    <TableCell className="text-right font-bold">{fmtBRL(stats.totals.ml)}</TableCell>
                    <TableCell className="text-right font-bold">{fmtBRL(stats.totals.full)}</TableCell>
                    <TableCell className="text-right font-bold">{fmtBRL(stats.totals.total)}</TableCell>
                    <TableCell className="text-right font-bold" style={{ color: colorFor(pctMes) }}>{fmtPct(pctMes)}</TableCell>
                    <TableCell className="text-center"><StatusPill pct={pctMes} /></TableCell>
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

function KpiBig({
  title, value, subtitle, tone, icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone: "success" | "warning" | "destructive";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const bg = tone === "success" ? "bg-emerald-50 text-emerald-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600";
  const border = tone === "success" ? "border-emerald-200" : tone === "warning" ? "border-amber-200" : "border-red-200";
  return (
    <Card className={cn("custom-shadow border", border)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">{title}</div>
            <div className="mt-1.5 text-2xl font-bold">{value}</div>
            {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bg)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelBar({ label, realizado, meta, hideMeta }: { label: string; realizado: number; meta: number; hideMeta?: boolean }) {
  const pct = meta > 0 ? (realizado / meta) * 100 : 0;
  const color = hideMeta ? "#0f52ba" : colorFor(pct);
  const width = hideMeta ? 100 : Math.min(pct, 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {fmtBRL(realizado)}{!hideMeta && <span> / {fmtBRL(meta)}</span>}
          {!hideMeta && <span className="ml-2 font-semibold" style={{ color }}>{fmtPct(pct)}</span>}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function StatusPill({ pct }: { pct: number }) {
  const color = colorFor(pct);
  const label = pct >= 100 ? "Atingiu" : pct >= 80 ? "Próximo" : "Abaixo";
  return (
    <Badge style={{ backgroundColor: color, color: "white" }} className="border-none shadow-none text-xs font-medium">
      {label}
    </Badge>
  );
}
