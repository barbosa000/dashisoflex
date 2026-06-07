import { createFileRoute } from "@tanstack/react-router";
import { makePlaceholder } from "./marketing";

export const Route = createFileRoute("/_authenticated/rh")({
  component: makePlaceholder("Recursos Humanos", "Colaboradores, ponto e folha"),
});
