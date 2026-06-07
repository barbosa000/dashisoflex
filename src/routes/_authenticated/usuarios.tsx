import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, createUser, updateUser, deleteUser, listAudit } from "@/lib/users.functions";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserCheck, UserX, ShieldCheck, Plus, Pencil, Trash2, Lock, Eye, Mail, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/usuarios")({
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: UsuariosPage,
});

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "lancamento", label: "Lançamento" },
  { key: "historico", label: "Histórico" },
  { key: "metas", label: "Metas" },
  { key: "relatorio", label: "Relatórios" },
  { key: "marketing", label: "Marketing" },
  { key: "comercial", label: "Comercial" },
  { key: "financeiro", label: "Financeiro" },
  { key: "rh", label: "RH" },
  { key: "producao", label: "Produção" },
  { key: "configuracoes", label: "Configurações" },
  { key: "usuarios", label: "Usuários" },
] as const;

type ModuleKey = typeof MODULES[number]["key"];
type Role = "admin_master" | "gestor" | "colaborador";

const ROLE_LABEL: Record<Role, string> = {
  admin_master: "Administrador Master",
  gestor: "Gestor",
  colaborador: "Colaborador",
};

function UsuariosPage() {
  const { data: me } = useMe();
  const isMaster = me?.roles.includes("admin_master") ?? false;

  if (me && !isMaster) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">Somente Administradores Master podem gerenciar usuários.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários e Permissões</h1>
        <p className="text-sm text-muted-foreground">Gerencie acessos, perfis e auditoria do sistema</p>
      </div>
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Usuários</TabsTrigger>
          <TabsTrigger value="audit"><Eye className="mr-2 h-4 w-4" />Auditoria</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type UserRow = {
  id: string; email: string; full_name: string; phone: string | null;
  cargo: string | null; setor: string | null; avatar_url: string | null;
  status: "ativo"|"inativo"|"bloqueado"; last_login: string | null;
  roles: string[]; permissions: string[];
};

function UsersTab() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers() as Promise<UserRow[]>,
  });

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);

  const totals = {
    total: users.length,
    ativos: users.filter((u) => u.status === "ativo").length,
    inativos: users.filter((u) => u.status !== "ativo").length,
    admins: users.filter((u) => u.roles.includes("admin_master")).length,
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <KPI icon={Users} label="Total de usuários" value={totals.total} color="text-primary" />
        <KPI icon={UserCheck} label="Usuários ativos" value={totals.ativos} color="text-emerald-600" />
        <KPI icon={UserX} label="Usuários inativos" value={totals.inativos} color="text-rose-600" />
        <KPI icon={ShieldCheck} label="Administradores" value={totals.admins} color="text-primary" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Todos os usuários</CardTitle>
          <Button onClick={() => setCreating(true)} className="gap-2"><Plus className="h-4 w-4" />Novo usuário</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Cargo / Setor</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name || u.email} />
                          <div>
                            <div className="font-medium">{u.full_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{u.cargo || "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.setor || "—"}</div>
                      </TableCell>
                      <TableCell>
                        {u.roles.map((r) => (
                          <Badge key={r} variant={r === "admin_master" ? "default" : "secondary"} className="mr-1">
                            {ROLE_LABEL[r as Role] ?? r}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.last_login ? new Date(u.last_login).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions user={u} onEdit={() => setEditing(u)} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {creating && <UserFormDialog open onClose={() => setCreating(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["users"] })} />}
      {editing && <UserFormDialog open user={editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["users"] })} />}
    </>
  );
}

function UserActions({ user, onEdit }: { user: UserRow; onEdit: () => void }) {
  const qc = useQueryClient();
  const update = useServerFn(updateUser);
  const del = useServerFn(deleteUser);
  const block = useMutation({
    mutationFn: () => update({ data: { user_id: user.id, status: user.status === "bloqueado" ? "ativo" : "bloqueado" } }),
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { user_id: user.id } }),
    onSuccess: () => { toast.success("Usuário excluído"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex justify-end gap-1">
      <Button size="icon" variant="ghost" onClick={onEdit} title="Editar"><Pencil className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => block.mutate()} title="Bloquear/Desbloquear">
        <Lock className={user.status === "bloqueado" ? "h-4 w-4 text-rose-600" : "h-4 w-4"} />
      </Button>
      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Excluir ${user.email}?`)) remove.mutate(); }} title="Excluir">
        <Trash2 className="h-4 w-4 text-rose-600" />
      </Button>
    </div>
  );
}

function UserFormDialog({ open, onClose, onSaved, user }: { open: boolean; onClose: () => void; onSaved: () => void; user?: UserRow }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    cargo: user?.cargo ?? "",
    setor: user?.setor ?? "",
    role: (user?.roles[0] as Role) ?? "colaborador",
    status: user?.status ?? "ativo",
  });
  const [perms, setPerms] = useState<Set<ModuleKey>>(
    new Set((user?.permissions as ModuleKey[]) ?? ["dashboard"]),
  );
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const create = useServerFn(createUser);
  const update = useServerFn(updateUser);

  const mutation = useMutation({
    mutationFn: async () => {
      const permissions = Array.from(perms);
      if (isEdit) {
        return update({ data: {
          user_id: user!.id,
          full_name: form.full_name, phone: form.phone || null,
          cargo: form.cargo || null, setor: form.setor || null,
          status: form.status, role: form.role, permissions,
        }});
      }
      return create({ data: {
        full_name: form.full_name, email: form.email,
        phone: form.phone || null, cargo: form.cargo || null, setor: form.setor || null,
        role: form.role, permissions,
      }});
    },
    onSuccess: (res) => {
      if (!isEdit && res && "tempPassword" in res) {
        setTempPw(res.tempPassword);
        setEmailSent(res.emailSent);
        toast.success(res.emailSent ? "Usuário criado — convite enviado por email" : "Usuário criado");
      } else {
        toast.success("Alterações salvas");
        onSaved();
        onClose();
        return;
      }
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(m: ModuleKey) {
    setPerms((s) => {
      const n = new Set(s);
      if (n.has(m)) n.delete(m); else n.add(m);
      return n;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuário" : "Novo usuário"}</DialogTitle>
        </DialogHeader>

        {tempPw ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <p className="font-semibold text-emerald-900">Usuário criado com sucesso.</p>
              <p className="mt-1 text-emerald-800">
                {emailSent ? (
                  <>Um convite foi enviado para <strong>{form.email}</strong> definir a senha.</>
                ) : (
                  <>Não foi possível enviar o email automaticamente. Repasse a senha temporária manualmente.</>
                )}
              </p>
            </div>
            <div>
              <Label>Senha temporária</Label>
              <div className="mt-1 flex gap-2">
                <Input readOnly value={tempPw} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(tempPw); toast.success("Copiado"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Guarde — só será exibida agora.</p>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome completo *">
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </Field>
              <Field label="E-mail *">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={isEdit} />
              </Field>
              <Field label="Telefone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Cargo">
                <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </Field>
              <Field label="Setor">
                <Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
              </Field>
              <Field label="Perfil de acesso *">
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin_master">Administrador Master</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {isEdit && (
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "ativo"|"inativo"|"bloqueado" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Permissões de módulos</p>
                {form.role === "admin_master" && (
                  <Badge variant="secondary">Master tem acesso a tudo</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {MODULES.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 rounded-md bg-card px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.role === "admin_master" ? true : perms.has(m.key)}
                      disabled={form.role === "admin_master"}
                      onCheckedChange={() => toggle(m.key)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar usuário"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditTab() {
  const fetchAudit = useServerFn(listAudit);
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: () => fetchAudit() as Promise<Array<{
      id: string; actor_email: string | null; action: string; entity: string | null;
      entity_id: string | null; ip_address: string | null; created_at: string; details: unknown;
    }>>,
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Histórico de acessos e alterações</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/hora</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{a.actor_email || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.entity}{a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}</TableCell>
                    <TableCell className="text-xs">{a.ip_address || "—"}</TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Sem registros ainda</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----- UI helpers -----
function KPI({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number; color: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: "ativo"|"inativo"|"bloqueado" }) {
  const map = {
    ativo: "bg-emerald-100 text-emerald-700 border-emerald-200",
    inativo: "bg-muted text-muted-foreground",
    bloqueado: "bg-rose-100 text-rose-700 border-rose-200",
  } as const;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>{status}</span>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {initials || "?"}
    </div>
  );
}
