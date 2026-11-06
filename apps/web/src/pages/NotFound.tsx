import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-5 text-center">
      <LogoMark className="h-14 w-14 opacity-80" />
      <div>
        <p className="money text-6xl font-semibold">404</p>
        <p className="mt-2 text-muted-foreground">Essa página não existe. Sem crise.</p>
      </div>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
