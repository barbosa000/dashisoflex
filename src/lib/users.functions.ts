import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_MODULES = [
  "dashboard",
  "lancamento",
  "historico",
  "metas",
  "relatorio",
  "marketing",
  "comercial",
  "financeiro",
  "rh",
  "producao",
  "configuracoes",
  "usuarios",
] as const;
const ROLES = ["admin_master", "gestor", "colaborador"] as const;

async function ensureAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin_master")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: apenas Administrador Master pode executar esta ação");
}

async function logAudit(
  actorId: string,
  actorEmail: string,
  action: string,
  entity?: string,
  entityId?: string,
  details?: unknown,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_log").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    entity,
    entity_id: entityId,
    details: details as never,
  });
}

// -------- LIST USERS --------
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p) => p.id);
    const [{ data: roles }, { data: perms }] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("user_permissions")
        .select("user_id, module")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      permissions: (perms ?? []).filter((r) => r.user_id === p.id).map((r) => r.module),
    }));
  });

// -------- CREATE USER --------
const createSchema = z.object({
  full_name: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  cargo: z.string().trim().max(100).optional().nullable(),
  setor: z.string().trim().max(100).optional().nullable(),
  role: z.enum(ROLES),
  permissions: z.array(z.enum(APP_MODULES)).default([]),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres")
    .max(72)
    .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Inclua ao menos um número")
    .optional()
    .nullable(),
  send_invite: z.boolean().optional(),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof createSchema>) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Senha: usa a fornecida pelo admin, senão gera uma temporária
    const customPassword = data.password?.trim() || "";
    const passwordIsCustom = customPassword.length >= 8;
    const password = passwordIsCustom
      ? customPassword
      : `Iso-${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 100)}!`;
    const origin = process.env.SITE_URL || "";
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Falha ao criar usuário");

    const uid = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        cargo: data.cargo ?? null,
        setor: data.setor ?? null,
      })
      .eq("id", uid);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });

    await supabaseAdmin.from("user_permissions").delete().eq("user_id", uid);
    if (data.role === "admin_master") {
      await supabaseAdmin
        .from("user_permissions")
        .insert(APP_MODULES.map((m) => ({ user_id: uid, module: m })));
    } else if (data.permissions.length) {
      await supabaseAdmin
        .from("user_permissions")
        .insert(data.permissions.map((m) => ({ user_id: uid, module: m })));
    }

    // Envia convite (link para definir nova senha) apenas se solicitado ou se senha foi gerada
    let emailSent = false;
    if (data.send_invite || !passwordIsCustom) {
      try {
        await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
          redirectTo: origin ? `${origin}/auth` : undefined,
        });
        emailSent = true;
      } catch {
        // ignore
      }
    }

    await logAudit(
      context.userId,
      (context.claims.email as string) ?? "",
      "user.create",
      "profiles",
      uid,
      { email: data.email, role: data.role, password_set_by_admin: passwordIsCustom },
    );

    return {
      id: uid,
      tempPassword: passwordIsCustom ? null : password,
      passwordSetByAdmin: passwordIsCustom,
      emailSent,
    };
  });

// -------- UPDATE USER --------
const updateSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(150).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  cargo: z.string().trim().max(100).nullable().optional(),
  setor: z.string().trim().max(100).nullable().optional(),
  status: z.enum(["ativo", "inativo", "bloqueado"]).optional(),
  role: z.enum(ROLES).optional(),
  permissions: z.array(z.enum(APP_MODULES)).optional(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof updateSchema>) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { user_id, role, permissions, ...profile } = data;

    const profilePatch: {
      full_name?: string;
      phone?: string | null;
      cargo?: string | null;
      setor?: string | null;
      status?: "ativo" | "inativo" | "bloqueado";
    } = {};
    if (profile.full_name !== undefined) profilePatch.full_name = profile.full_name;
    if (profile.phone !== undefined) profilePatch.phone = profile.phone;
    if (profile.cargo !== undefined) profilePatch.cargo = profile.cargo;
    if (profile.setor !== undefined) profilePatch.setor = profile.setor;
    if (profile.status !== undefined) profilePatch.status = profile.status;
    if (Object.keys(profilePatch).length) {
      await supabaseAdmin.from("profiles").update(profilePatch).eq("id", user_id);
    }

    if (role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id, role });
    }
    if (permissions) {
      await supabaseAdmin.from("user_permissions").delete().eq("user_id", user_id);
      if (permissions.length) {
        await supabaseAdmin
          .from("user_permissions")
          .insert(permissions.map((m) => ({ user_id, module: m })));
      }
    }
    // bloquear via banlist
    if (data.status === "bloqueado") {
      await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
    } else if (data.status === "ativo") {
      await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
    }

    await logAudit(
      context.userId,
      (context.claims.email as string) ?? "",
      "user.update",
      "profiles",
      user_id,
      data,
    );
    return { ok: true };
  });

// -------- DELETE USER --------
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await logAudit(
      context.userId,
      (context.claims.email as string) ?? "",
      "user.delete",
      "profiles",
      data.user_id,
    );
    return { ok: true };
  });

// -------- LIST AUDIT --------
export const listAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// -------- ME (current permissions + role) --------
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const [{ data: profile }, { data: roles }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_permissions").select("module").eq("user_id", userId),
    ]);
    return {
      userId,
      email: (claims.email as string) ?? profile?.email ?? "",
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
      permissions: (perms ?? []).map((p) => p.module as string),
    };
  });
