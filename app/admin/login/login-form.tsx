"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push(next);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <form
      className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8"
      onSubmit={submit}
    >
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Kawakeeb Admin</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Enter the admin password to continue.
        </p>
      </div>
      <div>
        <Label htmlFor="pw">Password</Label>
        <Input
          autoFocus
          id="pw"
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          value={password}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button className="w-full" disabled={loading} type="submit">
        {loading ? "Checking…" : "Enter"}
      </Button>
    </form>
  );
}
