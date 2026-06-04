import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { fmtBRL, fmtPct, daysInMonth, monthKey, statusColor, totalDia, isoDate, parseISODate } from "@/lib/calc";
import { ArrowUpRight, ArrowDownRight, Target, TrendingUp, Calendar, Store, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function DashboardPage() {
  const today = new Date();
  const cur = monthKey(today);
  const [year, setYear] = useState(cur.year);
  const [month, setMonth] = useState(cur.month);
  const [selectedDay, setSelectedDay] = useState(isoDate(today));

  const { data: sales = [] } = useQuery({
    queryKey: ["sales", year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const endD = new Date(year, month, 0);
      const end = `${year}-${String(month).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("daily_sales").select("*")
        .gte("sale_date", start).lte("sale_date", end)
        .order("sale_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: goal } = useQuery({
    queryKey: ["goal", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_goals").select("*")
        .eq("year", year).eq("month", month).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const metaLoja = Number(goal?.meta_loja ?? 0);
  const metaML = Number(goal?.meta_mercado_livre ?? 0);
  const diasUteis = Number(goal?.dias_uteis ?? 22);
  const totalDiasMes = daysInMonth(year, month);
  const metaTotal = metaLoja + metaML;
  const metaDiaLoja = metaLoja / Math.max(diasUteis, 1);
  const metaDiaML = metaML / Math.max(totalDiasMes, 1);

  const acumulado = useMemo(() => {
    let loja = 0, ml = 0, full = 0;
    return sales.map((s) => {
      loja += Number(s.faturado_loja);
      ml += Number(s.mercado_livre);
      full += Number(s.full_value);
      const total = loja + ml + full;
      return {
        date: parseISODate(s.sale_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        rawDate: s.sale_date,
        diario: totalDia(s),
        loja: Number(s.faturado_loja),
        ml: Number(s.mercado_livre),
        full: Number(s.full_value),
        acumLoja: loja, acumML: ml, acumFull: full, acumTotal: total,
      };
    });
  }, [sales]);

  const totalMes = acumulado.at(-1)?.acumTotal ?? 0;
  const totalLojaMes = acumulado.at(-1)?.acumLoja ?? 0;
  const totalMLMes = acumulado.at(-1)?.acumML ?? 0;
  const pctMes = metaTotal > 0 ? (totalMes / metaTotal) * 100 : 0;
  const pctLoja = metaLoja > 0 ? (totalLojaMes / metaLoja) * 100 : 0;
  const pctML = metaML > 0 ? (totalMLMes / metaML) * 100 : 0;
  const falta = Math.max(metaTotal - totalMes, 0);

  // Lançamento do dia selecionado
  const dia = sales.find((s) => s.sale_date === selectedDay);
  const diaLoja = Number(dia?.faturado_loja ?? 0);
  const diaML = Number(dia?.mercado_livre ?? 0);
  const diaFull = Number(dia?.full_value ?? 0);
  const diaTotal = diaLoja + diaML + diaFull;
  const pctDiaLoja = metaDiaLoja > 0 ? (diaLoja / metaDiaLoja) * 100 : 0;
  const pctDiaML = metaDiaML > 0 ? (diaML / metaDiaML) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Vendas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe a performance comercial em tempo real.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 5 }).map((_, i) => {
              const y = cur.year - 2 + i;
              return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
            })}</SelectContent>
          </Select>
        </div>
      </div>

      {!goal && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="text-sm">Nenhuma meta configurada para {MONTHS[month - 1]}/{year}.</div>
            <Link to="/metas"><Button size="sm" variant="outline">Configurar metas</Button></Link>
          </CardContent>
        </Card>
      )}

      {/* Cards principais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Faturado no mês" value={fmtBRL(totalMes)} icon={TrendingUp}
          subtitle={`${acumulado.length} dia(s) lançado(s)`} />
        <KpiCard title="Meta mensal" value={fmtBRL(metaTotal)} icon={Target}
          subtitle={`Loja ${fmtBRL(metaLoja)} + ML ${fmtBRL(metaML)}`} />
        <KpiCard title="% Atingido" value={fmtPct(pctMes)} icon={pctMes >= 100 ? ArrowUpRight : ArrowDownRight}
          tone={statusColor(pctMes)}
          subtitle={pctMes >= 100 ? "Meta batida!" : `Faltam ${fmtPct(100 - pctMes)}`} />
        <KpiCard title="Falta para meta" value={fmtBRL(falta)} icon={Target}
          subtitle={falta === 0 ? "Meta atingida" : "Para atingir o mês"} />
      </div>

      {/* % por canal */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChannelProgress
          icon={Store} title="Loja Virtual"
          realizado={totalLojaMes} meta={metaLoja} pct={pctLoja}
          subtitle={`Meta diária (${diasUteis} dias úteis): ${fmtBRL(metaDiaLoja)}`}
        />
        <ChannelProgress
          icon={ShoppingBag} title="Mercado Livre"
          realizado={totalMLMes} meta={metaML} pct={pctML}
          subtitle={`Meta diária (${totalDiasMes} dias totais): ${fmtBRL(metaDiaML)}`}
        />
      </div>

      {/* Detalhamento do dia */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Detalhamento do dia</CardTitle>
              <CardDescription>Veja o resultado de qualquer dia do mês.</CardDescription>
            </div>
            <Input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="max-w-[180px]" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <DayMetric
            title="Loja Virtual (dias úteis)"
            realizado={diaLoja} meta={metaDiaLoja} pct={pctDiaLoja}
          />
          <DayMetric
            title="Mercado Livre (dias totais)"
            realizado={diaML} meta={metaDiaML} pct={pctDiaML}
          />
          <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
            <div className="text-xs text-muted-foreground">Total do dia (Loja Virtual + ML + Full)</div>
            <div className="mt-1 text-2xl font-bold text-primary">{fmtBRL(diaTotal)}</div>
            <div className="mt-2 text-xs text-muted-foreground">Full: {fmtBRL(diaFull)}</div>
            {!dia && <div className="mt-2 text-xs text-muted-foreground">Sem lançamento para este dia.</div>}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Faturamento diário</CardTitle>
            <CardDescription>Total por dia (Loja Virtual + ML + Full)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={acumulado}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Bar dataKey="diario" name="Total dia" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução acumulada vs meta</CardTitle>
            <CardDescription>Acumulado no mês comparado à meta total</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={acumulado.map((a) => ({ ...a, meta: metaTotal }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend />
                <Line type="monotone" dataKey="acumTotal" name="Realizado" stroke="var(--color-chart-1)" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="meta" name="Meta" stroke="var(--color-chart-4)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title, value, subtitle, icon: Icon, tone,
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneClasses =
    tone === "success" ? "bg-success/10 text-success" :
    tone === "warning" ? "bg-warning/15 text-warning-foreground" :
    tone === "destructive" ? "bg-destructive/10 text-destructive" :
    "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className="mt-1 text-2xl font-bold">{value}</div>
            {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneClasses)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelProgress({
  icon: Icon, title, realizado, meta, pct, subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; realizado: number; meta: number; pct: number; subtitle: string;
}) {
  const tone = statusColor(pct);
  const barColor =
    tone === "success" ? "bg-success" :
    tone === "warning" ? "bg-warning" : "bg-destructive";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4" /> {title}
          </CardTitle>
          <StatusBadge pct={pct} />
        </div>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Realizado</span>
          <span className="font-semibold">{fmtBRL(realizado)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Meta</span>
          <span className="font-semibold">{fmtBRL(meta)}</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full transition-all", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className="text-right text-sm font-semibold">{fmtPct(pct)}</div>
      </CardContent>
    </Card>
  );
}

function DayMetric({
  title, realizado, meta, pct,
}: { title: string; realizado: number; meta: number; pct: number }) {
  const tone = statusColor(pct);
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{title}</div>
        <StatusBadge pct={pct} />
      </div>
      <div className="mt-2 text-xl font-bold">{fmtBRL(realizado)}</div>
      <div className="text-xs text-muted-foreground">Meta: {fmtBRL(meta)}</div>
      <div className={cn(
        "mt-1 text-xs font-semibold",
        tone === "success" ? "text-success" : tone === "warning" ? "text-warning-foreground" : "text-destructive",
      )}>{fmtPct(pct)} da meta diária</div>
    </div>
  );
}

function StatusBadge({ pct }: { pct: number }) {
  const tone = statusColor(pct);
  if (tone === "success") return <Badge className="bg-success text-success-foreground hover:bg-success">Atingiu</Badge>;
  if (tone === "warning") return <Badge className="bg-warning text-warning-foreground hover:bg-warning">Atenção</Badge>;
  return <Badge variant="destructive">Abaixo</Badge>;
}
