import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminGet, readAdminToken, storeAdminToken } from "@/lib/adminAuth";

/** Password gate for admin pages. Renders children(token, logout) once the backend accepts the password. */
export default function AdminGate({
  title,
  children,
}: {
  title: string;
  children: (token: string, logout: () => void) => ReactNode;
}) {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  async function verify(candidate: string) {
    setChecking(true);
    const { status } = await adminGet(import.meta.env.VITE_ADMIN_AUTH, candidate);
    if (status >= 200 && status < 300) {
      storeAdminToken(candidate);
      setToken(candidate);
      setError("");
    } else {
      storeAdminToken("");
      setToken("");
      setError(status === 0 ? "Could not reach the server." : "Incorrect password. Try again.");
    }
    setChecking(false);
  }

  useEffect(() => {
    const stored = readAdminToken();
    if (stored) verify(stored);
    else setChecking(false);
  }, []);

  function logout() {
    storeAdminToken("");
    setToken("");
    setError("");
  }

  if (token) return <>{children(token, logout)}</>;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const p = input.trim();
          if (!p) return;
          setInput("");
          verify(p);
        }}
        className="w-full max-w-sm bg-card border-2 border-border rounded-2xl p-6 sm:p-8 shadow-soft"
      >
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-warm flex items-center justify-center shadow-glow">
          <Lock className="text-primary-foreground" size={24} />
        </div>
        <h1 className="text-2xl font-display font-bold text-center mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Enter the admin password to continue.</p>
        <Input
          type="password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Password"
          className="h-12 rounded-xl border-2"
        />
        {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
        <Button
          type="submit"
          disabled={!input.trim() || checking}
          className="w-full h-12 mt-4 rounded-xl bg-gradient-warm text-primary-foreground hover:opacity-90"
        >
          {checking ? "Checking…" : "Unlock"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate("/")} className="w-full mt-2 rounded-xl">
          <ArrowLeft size={16} className="mr-2" /> Back to home
        </Button>
      </form>
    </main>
  );
}
