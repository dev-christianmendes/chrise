import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGate } from "./components/AuthGate";
import { Layout } from "./components/Layout";
import { PageSkeleton } from "./components/states";
import { useOutboxSync } from "./hooks/use-sync";
import Dashboard from "./pages/Dashboard";

// Páginas secundárias em chunks separados: o primeiro carregamento no celular fica leve.
const Transactions = lazy(() => import("./pages/Transactions"));
const Forecast = lazy(() => import("./pages/Forecast"));
const Taxes = lazy(() => import("./pages/Taxes"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    // O OfflineRepository decide o que fazer sem rede (fila + último extrato);
    // sem `always`, o React Query pausaria mutations e a fila nunca rodaria.
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, networkMode: "always" },
    mutations: { networkMode: "always" },
  },
});

function OutboxSync() {
  useOutboxSync();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OutboxSync />
      <TooltipProvider>
        <Toaster position="top-center" />
        <AuthGate>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="transactions" element={<Transactions />} />
                  <Route path="forecast" element={<Forecast />} />
                  <Route path="taxes" element={<Taxes />} />
                  <Route path="calendar" element={<Calendar />} />
                  <Route path="budgets" element={<Budgets />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthGate>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
