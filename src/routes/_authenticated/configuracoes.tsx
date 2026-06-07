import { createFileRoute } from "@tanstack/react-router";
import { makePlaceholder } from "./marketing";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: makePlaceholder("Configurações", "Preferências do sistema e integrações"),
});
