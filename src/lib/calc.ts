export type DailySale = {
  id: string;
  sale_date: string;
  venda_loja: number;
  faturado_loja: number;
  mercado_livre: number;
  full_value: number;
};

export type MonthlyGoal = {
  id?: string;
  year: number;
  month: number;
  meta_loja: number;
  meta_mercado_livre: number;
  dias_uteis: number;
};

export const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtPct = (n: number) =>
  `${(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

// Total do dia = faturado loja + mercado livre + full (NÃO inclui venda loja)
export const totalDia = (s: Pick<DailySale, "faturado_loja" | "mercado_livre" | "full_value">) =>
  Number(s.faturado_loja || 0) + Number(s.mercado_livre || 0) + Number(s.full_value || 0);

export const daysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate(); // month 1-12

export function statusColor(pct: number): "success" | "warning" | "destructive" {
  if (pct >= 100) return "success";
  if (pct >= 80) return "warning";
  return "destructive";
}

export function monthKey(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
