import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

function makePlaceholder(title: string, description: string) {
  return function Page() {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Construction className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold">Módulo em construção</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este módulo já está listado no menu e protegido por permissões.<br />
              Solicite a implementação do conteúdo quando desejar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };
}

export { makePlaceholder };

export const Route = createFileRoute("/_authenticated/marketing")({
  component: makePlaceholder("Marketing", "Campanhas, leads e desempenho de canais"),
});
