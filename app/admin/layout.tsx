/**
 * Admin panel shell with sidebar navigation.
 * All /admin/* pages share this layout.
 */

import Link from "next/link";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/chat", label: "Chat", icon: "💬" },
  { href: "/admin/research", label: "Research", icon: "🔬" },
  { href: "/admin/agents", label: "Agents", icon: "🤖" },
  { href: "/admin/skills", label: "Skills", icon: "🧠" },
  { href: "/admin/tools", label: "Tools", icon: "🔧" },
  { href: "/admin/cron", label: "Scheduled", icon: "⏰" },
  { href: "/admin/usage", label: "Usage", icon: "📈" },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-56 flex-col border-r bg-muted/30">
        <div className="border-b px-4 py-4">
          <Link className="font-semibold text-lg tracking-tight" href="/admin">
            Kawakeeb Admin
          </Link>
          <p className="mt-1 text-muted-foreground text-xs">
            Agent platform control
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
              href={item.href}
              key={item.href}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <Link
            className="block rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
            href="/"
          >
            ← Back to chat
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
