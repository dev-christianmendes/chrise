import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowLeftRight, CalendarDays, Home, Landmark, Moon, Plus, Settings, Sparkles, Sun, Target, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSheetParam, useTheme } from "@/hooks/use-ui";
import { IS_DEMO } from "@/lib/repository";
import { cn } from "@/lib/utils";
import { ImportDialog } from "./ImportDialog";
import { Logo } from "./Logo";
import { TransactionForm } from "./TransactionForm";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  { name: "Início", href: "/", icon: Home },
  { name: "Extrato", href: "/transactions", icon: ArrowLeftRight },
  { name: "Impostos", href: "/taxes", icon: Landmark },
  { name: "Calendário", href: "/calendar", icon: CalendarDays },
  { name: "Futuro", href: "/forecast", icon: Sparkles },
  { name: "Limites", href: "/budgets", icon: Target },
  { name: "Ajustes", href: "/settings", icon: Settings },
];

/** Dock do celular: 4 destinos + o botão de lançar no meio, onde o polegar alcança. */
const dock = [navigation[0]!, navigation[1]!, null, navigation[2]!, navigation[4]!] as const;

export function Layout() {
  const [theme, toggleTheme] = useTheme();
  const [formOpen, setFormOpen] = useSheetParam("new");
  const [importOpen, setImportOpen] = useSheetParam("import");
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar (tablet/desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-border px-4 py-6 md:flex">
        <Link to="/" className="px-2">
          <Logo />
        </Link>

        <Button size="lg" className="w-full justify-start gap-3 px-5" onClick={() => setFormOpen(true)}>
          <Plus className="!h-5 !w-5" strokeWidth={2.6} /> Lançar
        </Button>

        <nav className="flex-1 space-y-1">
          {navigation.map(({ name, href, icon: Icon }) => (
            <NavLink
              key={href}
              to={href}
              end={href === "/"}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-full px-4 py-2.5 text-[0.95rem] font-medium transition-colors",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("h-5 w-5", isActive && "text-income")} strokeWidth={isActive ? 2.4 : 2} />
                  {name}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3">
          {IS_DEMO && (
            <p className="rounded-2xl border border-dashed border-border p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Modo demonstração.</span> Dados fictícios; o que você lançar fica só neste navegador.
            </p>
          )}
          <Button variant="ghost" className="w-full justify-start gap-3 px-4 text-muted-foreground" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topo (celular): leve, sem borda; só marca e atalhos */}
        <header className="sticky top-0 z-20 flex items-center justify-between bg-background/80 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
          <Link to="/" aria-label="Início">
            <Logo compact />
          </Link>
          <div className="flex items-center gap-1">
            {IS_DEMO && (
              <span className="mr-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">demo</span>
            )}
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link to="/settings" aria-label="Ajustes">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(var(--nav-h)+2.5rem+env(safe-area-inset-bottom))] pt-2 md:px-8 md:pb-10 md:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Dock (celular) */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 md:hidden"
      >
        <ul className="grid h-[var(--nav-h)] grid-cols-5 items-center rounded-[1.75rem] border border-border bg-card/85 px-1 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)] backdrop-blur-xl">
          {dock.map((item) =>
            item ? (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  end={item.href === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn("h-[1.35rem] w-[1.35rem]", isActive && "text-income")} strokeWidth={isActive ? 2.4 : 2} />
                      {item.name}
                    </>
                  )}
                </NavLink>
              </li>
            ) : (
              <li key="add" className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  aria-label="Novo lançamento"
                  className="-mt-7 grid h-[3.75rem] w-[3.75rem] place-items-center rounded-[1.35rem] bg-lime text-[hsl(80_45%_8%)] shadow-[0_10px_28px_-6px_hsl(var(--lime)/0.55)] ring-4 ring-background transition-transform active:scale-95"
                >
                  <Plus className="h-7 w-7" strokeWidth={2.8} />
                </button>
              </li>
            ),
          )}
        </ul>
      </nav>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
