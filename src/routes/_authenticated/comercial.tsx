import { createFileRoute } from "@tanstack/react-router";
import { makePlaceholder } from "./marketing";

export const Route = createFileRoute("/_authenticated/comercial")({
  component: makePlaceholder("Comercial", "Pipeline, oportunidades e equipe de vendas"),
});
