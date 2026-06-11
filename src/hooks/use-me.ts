import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/users.functions";

export type AppModule =
  | "dashboard"
  | "lancamento"
  | "historico"
  | "metas"
  | "relatorio"
  | "marketing"
  | "comercial"
  | "financeiro"
  | "engenharia"
  | "configuracoes"
  | "usuarios"
  | "top_produtos";

export function useMe() {
  const fetchMe = useServerFn(getMe);
  return useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    staleTime: 60_000,
  });
}

export function hasModule(perms: string[] | undefined, mod: AppModule, isMaster: boolean) {
  if (isMaster) return true;
  return !!perms?.includes(mod);
}
