import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowUpDown, Landmark, LayoutDashboard, LineChart, Moon, Settings, Sun, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IS_DEMO } from "@/lib/repository";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const navigation = [
  { name: "Início", href: "/", icon: LayoutDashboard },
  { name: "Lançamentos", href: "/transactions", icon: ArrowUpDown },
  { name: "Previsões", href: "/forecast", icon: LineChart },
  { name: "Impostos", href: "/taxes", icon: Landmark },
  { name: "Orçamentos", href: "/budgets", icon: Target },
  { name: "Ajustes", href: "/settings", icon: Settings },
];

/** Na barra inferior do celular cabem 5 itens; "Ajustes" fica no header. */
const mobileNav = navigation.slice(0, 5);

type Theme = "light" | "dark";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage bloqueado */
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ok */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))] as const;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
  );

export function Layout() {
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex-col sticky top-0 h-dvh">
        <Link to="/" className="p-5 border-b border-sidebar-border text-sidebar-foreground">
          <Logo />
        </Link>
        <nav className="flex-1 p-3 space-y-1">
          {navigation.map(({ name, href, icon: Icon }) => (
            <NavLink key={href} to={href} end={href === "/"} className={linkClass}>
              <Icon className="w-5 h-5" />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>
        {IS_DEMO && (
          <p className="m-3 rounded-lg bg-warning/10 p-3 text-xs text-warning">
            Modo demonstração: dados fictícios, salvos só no seu navegador.
          </p>
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-card/90 backdrop-blur flex items-center justify-between px-4 md:px-6 pt-[env(safe-area-inset-top)]">
          <Link to="/" className="md:hidden">
            <Logo compact />
          </Link>
          <div className="flex items-center gap-1 ml-auto">
            {IS_DEMO && <span className="md:hidden rounded-md bg-warning/10 px-2 py-1 text-[11px] text-warning">demo</span>}
            <Button variant="ghost" size="icon" asChild className="md:hidden">
              <Link to="/settings" aria-label="Ajustes">
                <Settings className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {mobileNav.map(({ name, href, icon: Icon }) => (
            <li key={href}>
              <NavLink
                to={href}
                end={href === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-2 text-[11px] min-h-14 justify-center",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )
                }
              >
                <Icon className="w-5 h-5" />
                {name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
