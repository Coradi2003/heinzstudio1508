import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { Eye, LoaderCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "./supabase";

export type UserRole = "admin" | "viewer";

interface AuthValue {
  user: User;
  role: UserRole;
  canEdit: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function loadRole(userId: string): Promise<UserRole> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data?.role === "admin" ? "admin" : "viewer";
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <form onSubmit={submit} className="surface w-full max-w-sm rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <img
            src="/favicon.png"
            alt="Família Heinz"
            className="size-12 rounded-2xl object-cover ring-1 ring-primary/30"
          />
          <div>
            <h1 className="font-display text-xl font-bold">Família Heinz</h1>
            <p className="text-sm text-muted-foreground">Acesso ao controle financeiro</p>
          </div>
        </div>

        <div className="mt-7 space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-12 rounded-2xl"
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="h-12 rounded-2xl"
          />
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="mt-6 h-12 w-full rounded-2xl">
          {loading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <LogIn className="size-4" />
          )}
          Entrar
        </Button>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Eye className="size-3.5" /> O acesso respeita as permissões de cada conta.
        </p>
      </form>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <LoaderCircle className="size-8 animate-spin text-primary" aria-label="Carregando" />
    </main>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    let alive = true;

    const applyUser = async (nextUser: User | null) => {
      if (!alive) return;
      setUser(nextUser);
      setRole(null);
      setProfileError(false);
      if (!nextUser) {
        setLoading(false);
        return;
      }
      try {
        const nextRole = await loadRole(nextUser.id);
        if (alive) setRole(nextRole);
      } catch {
        if (alive) setProfileError(true);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data }) => applyUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      void applyUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  if (profileError || !role) {
    return (
      <main className="grid min-h-dvh place-items-center px-4 text-center">
        <div className="surface max-w-sm rounded-3xl p-6">
          <h1 className="font-display text-lg font-bold">Perfil não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta conta ainda não possui uma permissão configurada.
          </p>
          <Button className="mt-5 rounded-2xl" onClick={() => supabase.auth.signOut()}>
            Voltar ao login
          </Button>
        </div>
      </main>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        canEdit: role === "admin",
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return value;
}
