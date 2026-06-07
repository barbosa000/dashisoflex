import { createFileRoute } from "@tanstack/react-router";
import { makePlaceholder } from "./marketing";

export const Route = createFileRoute("/_authenticated/producao")({
  component: makePlaceholder("Produção", "Ordens, estoque e capacidade"),
});
