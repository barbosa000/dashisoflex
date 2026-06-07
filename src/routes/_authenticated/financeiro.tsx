import { createFileRoute } from "@tanstack/react-router";
import { makePlaceholder } from "./marketing";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: makePlaceholder("Financeiro", "Receitas, despesas e fluxo de caixa"),
});
