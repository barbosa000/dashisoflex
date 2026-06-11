import { createFileRoute } from "@tanstack/react-router";
import { makePlaceholder } from "./marketing";

export const Route = createFileRoute("/_authenticated/engenharia")({
  component: makePlaceholder("Engenharia", "Projetos, desenhos técnicos e PCP"),
});
