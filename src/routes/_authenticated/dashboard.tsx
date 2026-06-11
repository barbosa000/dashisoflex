import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  fmtBRL,
  fmtPct,
  daysInMonth,
  monthKey,
  statusColor,
  totalDia,
  isoDate,
  parseISODate,
} from "@/lib/calc";
import {
  ArrowUpRight,
  ArrowDownRight,
  Target,
  TrendingUp,
  Calendar,
  Store,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
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
  const metaDiaLoja = metaLoja / Math.max(diasUteis, 1);
  const metaDiaML = metaML / Math.max(totalDiasMes, 1);

  const acumulado = useMemo(() => {
    let loja = 0,
      ml = 0,
      full = 0;
    return sales.map((s) => {
      loja += Number(s.faturado_loja);
      ml += Number(s.mercado_livre);
      full += Number(s.full_value);
      const total = loja + ml + full;
      return {
        date: parseISODate(s.sale_date).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        rawDate: s.sale_date,
        diario: totalDia(s),
        loja: Number(s.faturado_loja),
        ml: Number(s.mercado_livre),
        full: Number(s.full_value),
        acumLoja: loja,
        acumML: ml,
        acumFull: full,
        acumTotal: total,
      };
    });
  }, [sales]);

  const totalMes = acumulado.at(-1)?.acumTotal ?? 0;
  const totalLojaMes = acumulado.at(-1)?.acumLoja ?? 0;
  const totalMLMes = acumulado.at(-1)?.acumML ?? 0;

  // Porcentagem absoluta do mês (usada na barra de progresso)
  const pctMes = metaTotal > 0 ? (totalMes / metaTotal) * 100 : 0;
  const pctLoja = metaLoja > 0 ? (totalLojaMes / metaLoja) * 100 : 0;
  const pctML = metaML > 0 ? (totalMLMes / metaML) * 100 : 0;
  const falta = Math.max(metaTotal - totalMes, 0);

  // Alertas de Meta
  const isCurrentMonth = year === cur.year && month === cur.month;
  const now = new Date();
  const diaAtual = isCurrentMonth ? now.getDate() : totalDiasMes;
  const diasRestantes = Math.max(totalDiasMes - diaAtual, 0);
  const expectedAtual = metaTotal > 0 ? (metaTotal / totalDiasMes) * diaAtual : 0;
  const pctRitmo = expectedAtual > 0 ? (totalMes / expectedAtual) * 100 : 0;

  // Ritmo por canal: compara realizado com o esperado proporcional aos dias decorridos
  // Loja Virtual usa dias úteis como base; limita diaAtual ao máximo de diasUteis
  const expectedLoja =
    metaLoja > 0 ? (metaLoja / Math.max(diasUteis, 1)) * Math.min(diaAtual, diasUteis) : 0;
  // Mercado Livre usa dias totais do mês
  const expectedML = metaML > 0 ? (metaML / totalDiasMes) * diaAtual : 0;
  const ritmoLoja = expectedLoja > 0 ? (totalLojaMes / expectedLoja) * 100 : 0;
  const ritmoML = expectedML > 0 ? (totalMLMes / expectedML) * 100 : 0;

  const alertTone: "success" | "warning" | "destructive" | null =
    metaTotal === 0
      ? null
      : pctMes >= 100
        ? "success"
        : pctRitmo >= 90
          ? "warning"
          : "destructive";

  // Lançamento do dia selecionado
  const dia = sales.find((s) => s.sale_date === selectedDay);
  const diaLoja = Number(dia?.faturado_loja ?? 0);
  const diaML = Number(dia?.mercado_livre ?? 0);
  const diaFull = Number(dia?.full_value ?? 0);
  const diaTotal = diaLoja + diaML + diaFull;
  const pctDiaLoja = metaDiaLoja > 0 ? (diaLoja / metaDiaLoja) * 100 : 0;
  const pctDiaML = metaDiaML > 0 ? (diaML / metaDiaML) * 100 : 0;

  const { data: me } = useMe();

  // Toast ao abrir o sistema (apenas uma vez por sessão por mês)
  const alertedRef = useRef(false);
  useEffect(() => {
    if (!alertTone || alertedRef.current || !isCurrentMonth) return;
    const sessionKey = `goal-alert-${year}-${month}`;
    if (sessionStorage.getItem(sessionKey)) return;
    alertedRef.current = true;
    sessionStorage.setItem(sessionKey, "1");
    if (alertTone === "success") {
      toast.success(`🎉 Meta de ${MONTHS[month - 1]} batida! ${fmtPct(pctMes)} atingido`);
    } else if (alertTone === "warning") {
      toast.warning(
        `Atenção: ${fmtPct(pctMes)} da meta · ${diasRestantes} dia(s) restante(s)`,
        { description: `Faltam ${fmtBRL(falta)} para atingir a meta` },
      );
    } else {
      toast.error(`Abaixo do ritmo: ${fmtPct(pctRitmo)} do esperado para hoje`, {
        description: `${diasRestantes} dia(s) restante(s) · Faltam ${fmtBRL(falta)}`,
      });
    }
  }, [alertTone, year, month, pctMes, pctRitmo, falta, diasRestantes, isCurrentMonth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a performance comercial em tempo real.
          </p>
          {me?.profile?.last_login && (
            <p className="mt-1 text-xs text-muted-foreground">
              Último acesso: {new Date(me.profile.last_login).toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36">
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
            <SelectTrigger className="w-24">
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
        </div>
      </div>

      {!goal && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="text-sm">
              Nenhuma meta configurada para {MONTHS[month - 1]}/{year}.
            </div>
            <Link to="/metas">
              <Button size="sm" variant="outline">
                Configurar metas
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {alertTone && (
        <Card
          className={cn(
            "border-l-4 shadow-sm",
            alertTone === "success" && "border-l-emerald-500 bg-emerald-50/60",
            alertTone === "warning" && "border-l-amber-500 bg-amber-50/60",
            alertTone === "destructive" && "border-l-rose-500 bg-rose-50/60",
          )}
        >
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                alertTone === "success" && "bg-emerald-100 text-emerald-600",
                alertTone === "warning" && "bg-amber-100 text-amber-600",
                alertTone === "destructive" && "bg-rose-100 text-rose-600",
              )}
            >
              {alertTone === "success" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : alertTone === "warning" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-[220px]">
              <div className="text-sm font-semibold">
                {alertTone === "success"
                  ? `Meta de ${MONTHS[month - 1]} batida 🎉`
                  : alertTone === "warning"
                    ? `Atenção: próximo da meta`
                    : `Abaixo do ritmo da meta`}
              </div>
              <div className="text-xs text-muted-foreground">
                {fmtPct(pctMes)} da meta · ritmo {fmtPct(pctRitmo)} ·{" "}
                {isCurrentMonth ? `${diasRestantes} dia(s) restante(s)` : "mês encerrado"} ·{" "}
                Faltam {fmtBRL(falta)}
              </div>
            </div>
            <Link to="/lancamento">
              <Button size="sm" variant={alertTone === "destructive" ? "default" : "outline"}>
                Lançar venda
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Cards principais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Faturado no mês"
          value={fmtBRL(totalMes)}
          icon={TrendingUp}
          subtitle={`${acumulado.length} dia(s) lançado(s)`}
        />
        <KpiCard
          title="Meta mensal"
          value={fmtBRL(metaTotal)}
          icon={Target}
          subtitle={`Loja ${fmtBRL(metaLoja)} + ML ${fmtBRL(metaML)}`}
        />
        <KpiCard
          title="% Atingido"
          value={fmtPct(pctMes)}
          icon={pctMes >= 100 ? ArrowUpRight : ArrowDownRight}
          tone={statusColor(pctMes)}
          subtitle={pctMes >= 100 ? "Meta batida!" : `Faltam ${fmtPct(100 - pctMes)}`}
        />
        <KpiCard
          title="% Dias decorridos"
          value={fmtPct((diaAtual / totalDiasMes) * 100)}
          icon={Calendar}
          subtitle={`${diaAtual} de ${totalDiasMes} dias${isCurrentMonth ? ` · ${diasRestantes} restantes` : " · encerrado"}`}
        />
        <KpiCard
          title="Atingido vs Decorrido"
          value={`${(pctMes - (diaAtual / totalDiasMes) * 100 >= 0 ? "+" : "")}${fmtPct(pctMes - (diaAtual / totalDiasMes) * 100)}`}
          icon={pctMes >= (diaAtual / totalDiasMes) * 100 ? ArrowUpRight : ArrowDownRight}
          tone={
            pctMes >= (diaAtual / totalDiasMes) * 100
              ? "success"
              : pctRitmo >= 90
                ? "warning"
                : "destructive"
          }
          subtitle={`Ritmo: ${fmtPct(pctRitmo)} do esperado`}
        />
      </div>

      {/* % por canal */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChannelProgress
          icon={Store}
          title="Loja Virtual"
          realizado={totalLojaMes}
          meta={metaLoja}
          pct={pctLoja}
          ritmo={ritmoLoja}
          subtitle={`Meta diária (${diasUteis} dias úteis): ${fmtBRL(metaDiaLoja)}`}
        />
        <ChannelProgress
          icon={ShoppingBag}
          title="Mercado Livre"
          realizado={totalMLMes}
          meta={metaML}
          pct={pctML}
          ritmo={ritmoML}
          subtitle={`Meta diária (${totalDiasMes} dias totais): ${fmtBRL(metaDiaML)}`}
        />
      </div>

      {/* Detalhamento do dia */}
      <Card className="custom-shadow border-slate-100/80">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Calendar className="h-4.5 w-4.5 text-primary" /> Detalhamento do dia
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80">
                Veja o resultado de qualquer dia do mês.
              </CardDescription>
            </div>
            <Input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="max-w-[180px] bg-white text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <DayMetric
            title="Loja Virtual (dias úteis)"
            realizado={diaLoja}
            meta={metaDiaLoja}
            pct={pctDiaLoja}
          />
          <DayMetric
            title="Mercado Livre (dias totais)"
            realizado={diaML}
            meta={metaDiaML}
            pct={pctDiaML}
          />
          <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-primary/5 to-primary/10 p-4 transition-all duration-200 hover:shadow-md">
            <div className="text-xs font-semibold text-primary/80">
              Total do dia (Loja Virtual + ML + Full)
            </div>
            <div className="mt-1.5 text-2xl font-black text-primary">{fmtBRL(diaTotal)}</div>
            <div className="mt-2 text-xs font-medium text-muted-foreground">
              Full: {fmtBRL(diaFull)}
            </div>
            {!dia && (
              <div className="mt-2 text-xs font-semibold text-amber-600">
                Sem lançamento para este dia.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="custom-shadow border-slate-100/80">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Faturamento diário
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground/80">
              Total por dia (Loja Virtual + ML + Full)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={acumulado}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
                <XAxis dataKey="date" fontSize={11} stroke="#64748b" />
                <YAxis
                  fontSize={11}
                  stroke="#64748b"
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => fmtBRL(v)}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                />
                <ReferenceLine
                  y={metaDiaLoja + metaDiaML}
                  stroke="#0f52ba"
                  strokeDasharray="4 4"
                  label={{
                    value: "Meta diária",
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#0f52ba",
                  }}
                />
                <Bar dataKey="diario" name="Total dia" radius={[6, 6, 0, 0]}>
                  {acumulado.map((d, i) => {
                    const metaDay = metaDiaLoja + metaDiaML;
                    const p = metaDay > 0 ? (d.diario / metaDay) * 100 : 0;
                    const color = p >= 100 ? "#10b981" : p >= 80 ? "#f59e0b" : "#ef4444";
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="custom-shadow border-slate-100/80">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Evolução acumulada vs meta
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground/80">
              Acumulado no mês comparado à meta total
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart
                data={acumulado.map((a) => {
                  const dayNum = parseISODate(a.rawDate).getDate();
                  return {
                    ...a,
                    meta: metaTotal,
                    esperado: (metaTotal / totalDiasMes) * dayNum,
                  };
                })}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
                <XAxis dataKey="date" fontSize={11} stroke="#64748b" />
                <YAxis
                  fontSize={11}
                  stroke="#64748b"
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => fmtBRL(v)}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="acumTotal"
                  name="Realizado"
                  stroke="var(--color-chart-1)"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="esperado"
                  name="Ritmo esperado (dias decorridos)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="meta"
                  name="Meta total"
                  stroke="var(--color-chart-4)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneClasses =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning-foreground"
        : tone === "destructive"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary";
  return (
    <Card className="card-hover-effect custom-shadow border-slate-100/80">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
              {title}
            </div>
            <div className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</div>
            {subtitle && <div className="mt-1 text-xs text-muted-foreground/80">{subtitle}</div>}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300",
              toneClasses,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelProgress({
  icon: Icon,
  title,
  realizado,
  meta,
  pct,
  ritmo,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  realizado: number;
  meta: number;
  pct: number;       // % absoluta do mês → usada na barra de progresso
  ritmo: number;     // % vs esperado até hoje → usada no badge
  subtitle: string;
}) {
  const tone = statusColor(pct);
  const barColor =
    tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-destructive";
  return (
    <Card className="card-hover-effect custom-shadow border-slate-100/80">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Icon className="h-4.5 w-4.5 text-primary" /> {title}
          </CardTitle>
          {/* Badge usa ritmo (realizado vs esperado até hoje), não a % absoluta */}
          <StatusBadge pct={ritmo} />
        </div>
        <CardDescription className="text-xs text-muted-foreground/80">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Realizado</span>
          <span className="font-semibold text-foreground">{fmtBRL(realizado)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Meta</span>
          <span className="font-semibold text-foreground">{fmtBRL(meta)}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full transition-all duration-500 rounded-full", barColor)}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="text-right text-sm font-bold text-foreground">{fmtPct(pct)}</div>
      </CardContent>
    </Card>
  );
}

function DayMetric({
  title,
  realizado,
  meta,
  pct,
}: {
  title: string;
  realizado: number;
  meta: number;
  pct: number;
}) {
  const tone = statusColor(pct);
  return (
    <div className="rounded-xl border border-slate-100/80 bg-white p-4 custom-shadow card-hover-effect">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        <StatusBadge pct={pct} />
      </div>
      <div className="mt-2 text-xl font-bold text-foreground">{fmtBRL(realizado)}</div>
      <div className="text-xs text-muted-foreground">Meta: {fmtBRL(meta)}</div>
      <div
        className={cn(
          "mt-1 text-xs font-semibold",
          tone === "success"
            ? "text-success"
            : tone === "warning"
              ? "text-warning-foreground"
              : "text-destructive",
        )}
      >
        {fmtPct(pct)} da meta diária
      </div>
    </div>
  );
}

function StatusBadge({ pct }: { pct: number }) {
  const tone = statusColor(pct);
  if (tone === "success")
    return (
      <Badge className="bg-success text-success-foreground hover:bg-success border-none shadow-none font-medium px-2 py-0.5 text-xs">
        Atingiu
      </Badge>
    );
  if (tone === "warning")
    return (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning border-none shadow-none font-medium px-2 py-0.5 text-xs">
        Atenção
      </Badge>
    );
  return (
    <Badge
      variant="destructive"
      className="border-none shadow-none font-medium px-2 py-0.5 text-xs"
    >
      Abaixo
    </Badge>
  );
}
