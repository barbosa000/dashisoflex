import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Trophy, Plus, Trash2, Pencil, Upload, ImageIcon, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/calc";

export const Route = createFileRoute("/_authenticated/top-produtos")({
  component: TopProdutosPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  price: number | null;
  active: boolean;
};
type Sale = {
  id: string;
  product_id: string;
  sale_date: string;
  quantity: number;
  total_value: number;
};

type RangeKey = "week" | "month" | "year";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0..6 (Sun..Sat)
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeRange(range: RangeKey): { start: string; end: string; label: string } {
  const t = new Date();
  if (range === "week") {
    const s = startOfWeek(t);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return { start: isoDate(s), end: isoDate(e), label: "Esta semana" };
  }
  if (range === "month") {
    const s = new Date(t.getFullYear(), t.getMonth(), 1);
    const e = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    return { start: isoDate(s), end: isoDate(e), label: "Este mês" };
  }
  const s = new Date(t.getFullYear(), 0, 1);
  const e = new Date(t.getFullYear(), 11, 31);
  return { start: isoDate(s), end: isoDate(e), label: "Este ano" };
}

function TopProdutosPage() {
  const { data: me } = useMe();
  const isMaster = me?.roles.includes("admin_master") ?? false;
  const [range, setRange] = useState<RangeKey>("month");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [launching, setLaunching] = useState(false);
  const qc = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const period = computeRange(range);
  const { data: sales = [] } = useQuery({
    queryKey: ["product-sales", period.start, period.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_sales")
        .select("*")
        .gte("sale_date", period.start)
        .lte("sale_date", period.end);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  // Aggregate per product
  const ranking = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    sales.forEach((s) => {
      const cur = map.get(s.product_id) ?? { qty: 0, total: 0 };
      cur.qty += Number(s.quantity);
      cur.total += Number(s.total_value);
      map.set(s.product_id, cur);
    });
    return products
      .map((p) => {
        const agg = map.get(p.id) ?? { qty: 0, total: 0 };
        return { ...p, qty: agg.qty, total: agg.total };
      })
      .sort((a, b) => b.qty - a.qty || b.total - a.total)
      .slice(0, 10);
  }, [products, sales]);

  const grandTotal = ranking.reduce((a, b) => a + b.total, 0);
  const grandQty = ranking.reduce((a, b) => a + b.qty, 0);

  const chartData = ranking.map((p, i) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name,
    qty: p.qty,
    total: p.total,
    color: i === 0 ? "#10b981" : i < 3 ? "#0f52ba" : "#94a3b8",
  }));

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento removido");
      qc.invalidateQueries({ queryKey: ["product-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto removido");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">TOP 10 Produtos</h1>
            <p className="text-sm text-muted-foreground">
              Ranking dos produtos mais vendidos com comparação semanal, mensal e anual.
            </p>
          </div>
        </div>
        {isMaster && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
            <Button onClick={() => setLaunching(true)} disabled={products.length === 0}>
              <TrendingUp className="h-4 w-4" /> Lançar venda
            </Button>
          </div>
        )}
      </div>

      <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
        <TabsList>
          <TabsTrigger value="week">Semanal</TabsTrigger>
          <TabsTrigger value="month">Mensal</TabsTrigger>
          <TabsTrigger value="year">Anual</TabsTrigger>
        </TabsList>

        <TabsContent value={range} className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label={`Período (${period.label})`} value={period.label} />
            <KpiCard label="Unidades vendidas" value={String(grandQty)} tone="primary" />
            <KpiCard label="Faturamento" value={fmtBRL(grandTotal)} tone="success" />
          </div>

          <Card className="custom-shadow">
            <CardHeader>
              <CardTitle className="text-base">Ranking — TOP 10 ({period.label})</CardTitle>
              <CardDescription>
                Ordenado por quantidade vendida. 1º lugar destacado em verde.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ranking.length === 0 || grandQty === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                  Sem vendas registradas neste período. Use “Lançar venda” para começar.
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="h-[360px]">
                    <ResponsiveContainer>
                      <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" fontSize={11} />
                        <YAxis dataKey="name" type="category" fontSize={11} width={110} />
                        <Tooltip
                          formatter={(v: number, k) =>
                            k === "total" ? fmtBRL(v) : `${v} un.`
                          }
                        />
                        <Bar dataKey="qty" name="Qtd" radius={[0, 6, 6, 0]}>
                          {chartData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2">
                    {ranking.map((p, i) => (
                      <ProductRow
                        key={p.id}
                        position={i + 1}
                        product={p}
                        qty={p.qty}
                        total={p.total}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {isMaster && (
            <Card className="custom-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Catálogo de Produtos</CardTitle>
                  <CardDescription>Cadastre e gerencie produtos.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhum produto cadastrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead></TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <ProductThumb path={p.image_url} size={40} />
                            </TableCell>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {p.sku || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {p.price != null ? fmtBRL(Number(p.price)) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditing(p)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm(`Remover "${p.name}"?`)) deleteProduct.mutate(p.id);
                                }}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isMaster && sales.length > 0 && (
            <Card className="custom-shadow">
              <CardHeader>
                <CardTitle className="text-base">Lançamentos do período</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...sales]
                        .sort((a, b) => b.sale_date.localeCompare(a.sale_date))
                        .map((s) => {
                          const p = products.find((pr) => pr.id === s.product_id);
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="text-xs">
                                {new Date(s.sale_date).toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell>{p?.name ?? "—"}</TableCell>
                              <TableCell className="text-right">{s.quantity}</TableCell>
                              <TableCell className="text-right font-medium">
                                {fmtBRL(Number(s.total_value))}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Remover lançamento?")) deleteSale.mutate(s.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-rose-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {creating && (
        <ProductDialog
          onClose={() => setCreating(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["products"] })}
        />
      )}
      {editing && (
        <ProductDialog
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["products"] })}
        />
      )}
      {launching && (
        <SaleDialog
          products={products}
          onClose={() => setLaunching(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["product-sales"] })}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "success";
}) {
  const bg =
    tone === "success"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-amber-50 text-amber-600";
  return (
    <Card className="custom-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
              {label}
            </div>
            <div className="mt-1.5 text-2xl font-bold">{value}</div>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
            <Trophy className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductRow({
  position,
  product,
  qty,
  total,
}: {
  position: number;
  product: Product;
  qty: number;
  total: number;
}) {
  const medal = position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : null;
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 transition hover:shadow-sm">
      <div className="text-xl font-black w-8 text-center text-muted-foreground">
        {medal ?? position}
      </div>
      <ProductThumb path={product.image_url} size={48} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{product.name}</div>
        <div className="text-xs text-muted-foreground truncate">{product.sku || "—"}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold">{qty} un.</div>
        <div className="text-xs text-muted-foreground">{fmtBRL(total)}</div>
      </div>
    </div>
  );
}

function ProductThumb({ path, size = 40 }: { path: string | null; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from("product-images")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-md object-cover border bg-muted"
    />
  );
}

function ProductDialog({
  product,
  onClose,
  onSaved,
}: {
  product?: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(product?.price ? String(product.price) : "");
  const [imagePath, setImagePath] = useState<string | null>(product?.image_url ?? null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      setImagePath(path);
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        sku: sku.trim() || null,
        price: price ? Number(price) : null,
        image_url: imagePath,
        active: true,
      };
      if (isEdit) {
        const { error } = await supabase.from("products").update(payload).eq("id", product!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Produto atualizado" : "Produto criado");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <ProductThumb path={imagePath} size={84} />
            <div className="space-y-2">
              <Label className="text-xs">Imagem do produto</Label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando..." : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </label>
            </div>
          </div>
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Preço</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || uploading}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaleDialog({
  products,
  onClose,
  onSaved,
}: {
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [date, setDate] = useState(isoDate(new Date()));
  const [qty, setQty] = useState("1");
  const [value, setValue] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_sales").insert({
        product_id: productId,
        sale_date: date,
        quantity: Number(qty),
        total_value: Number(value),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento registrado");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar venda de produto</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label className="text-xs">Produto *</Label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="block w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs">Quantidade *</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Valor total (R$) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !productId}>
              {save.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// silence unused
void Badge;
