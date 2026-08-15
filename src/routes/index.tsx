import { createFileRoute } from "@tanstack/react-router";
import { StoreProvider } from "@/lib/store";
import { Dashboard } from "@/components/fh/Dashboard";
import { AuthProvider, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Patricia Heinz — Nail Designer" },
      {
        name: "description",
        content:
          "App financeiro do studio Patricia Heinz Nail Designer: saldo, entradas, saídas, reserva, despesas parceladas e relatórios em PDF.",
      },
      { property: "og:title", content: "Patricia Heinz — Nail Designer" },
      {
        property: "og:description",
        content:
          "Saldo em tempo real, reserva independente, despesas parceladas e fixas, filtros inteligentes e relatórios mensais e anuais em PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { canEdit } = useAuth();
  return (
    <StoreProvider canEdit={canEdit}>
      <Dashboard />
    </StoreProvider>
  );
}
