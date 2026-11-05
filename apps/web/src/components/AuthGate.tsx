import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IS_DEMO } from "@/lib/repository";
import { getSupabase } from "@/lib/supabase";
import { Logo } from "./Logo";

/** Na demo passa direto; em produção exige login por link mágico (sem senha). */
export function AuthGate({ children }: { children: ReactNode }) {
  if (IS_DEMO) return <>{children}</>;
  return <SupabaseGate>{children}</SupabaseGate>;
}

function SupabaseGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    let unsubscribe = () => {};
    getSupabase().then((db) => {
      db.auth.getSession().then(({ data }) => setSession(data.session));
      const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s));
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (session) return <>{children}</>;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    const { error } = await (await getSupabase()).auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    setStatus(error ? "error" : "sent");
  };

  return (
    <div className="min-h-dvh grid place-items-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <Logo />
        {status === "sent" ? (
          <p className="text-sm text-muted-foreground">Link enviado para <strong>{email}</strong>. Abra no mesmo dispositivo.</p>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={status === "sending"}>
              {status === "sending" ? "Enviando…" : "Entrar com link mágico"}
            </Button>
            {status === "error" && <p className="text-sm text-danger">Não foi possível enviar o link. Tente novamente.</p>}
          </form>
        )}
      </Card>
    </div>
  );
}
