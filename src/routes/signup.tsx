import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { signUp, getUser } from "@/lib/auth";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Create account — mindflowAI" }] }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getUser()) navigate({ to: "/dashboard" });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const result = await signUp(name, email, password);
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 lg:px-16 h-12 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="size-[18px] bg-aurora" />
          <span className="font-display text-sm font-semibold tracking-tight">mindflowAI</span>
        </a>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-foreground hover:text-accent transition-colors underline underline-offset-4">
              Sign in
            </Link>
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-[360px]">
          <div className="mb-10">
            <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Free forever</p>
            <h1 className="font-display text-3xl font-bold tracking-tight">Create account</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground block mb-1.5">
                Full name
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Johnson"
                className="w-full border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-accent/60 placeholder:text-muted-foreground/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground block mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-accent/60 placeholder:text-muted-foreground/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground block mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-accent/60 placeholder:text-muted-foreground/40 transition-colors"
              />
            </div>

            {error && (
              <div className="border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground text-background py-3 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40 mt-1"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-[11px] text-muted-foreground mt-6 text-center leading-relaxed">
            By signing up you agree to our{" "}
            <a href="#" className="underline underline-offset-4 hover:text-foreground transition-colors">Terms</a>
            {" "}and{" "}
            <a href="#" className="underline underline-offset-4 hover:text-foreground transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
