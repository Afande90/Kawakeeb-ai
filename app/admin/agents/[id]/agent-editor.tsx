"use client";

/**
 * Client-side agent editor.
 * Edit core fields + manage attached skills/tools via checkboxes.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AgentWithRelations, Skill, Tool } from "@/lib/db/agent-types";

const PROVIDERS = [
  "google",
  "groq",
  "cerebras",
  "openrouter",
  "mistral",
  "github",
  "huggingface",
  "cohere",
];

interface Props {
  agent: AgentWithRelations;
  allSkills: Skill[];
  allTools: Tool[];
}

export function AgentEditor({ agent, allSkills, allTools }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [icon, setIcon] = useState(agent.icon ?? "🤖");
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [modelProvider, setModelProvider] = useState(agent.model_provider);
  const [modelId, setModelId] = useState(agent.model_id);
  const [telegramCommand, setTelegramCommand] = useState(
    agent.telegram_command ?? ""
  );
  const [isActive, setIsActive] = useState(agent.is_active);

  // Track attached skill/tool IDs locally
  const [attachedSkills, setAttachedSkills] = useState<Set<string>>(
    new Set(agent.skills.map((s) => s.id))
  );
  const [attachedTools, setAttachedTools] = useState<Set<string>>(
    new Set(agent.tools.map((t) => t.id))
  );

  async function saveCore() {
    setStatus("Saving...");
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        icon,
        system_prompt: systemPrompt,
        model_provider: modelProvider,
        model_id: modelId,
        telegram_command: telegramCommand || null,
        is_active: isActive,
      }),
    });
    if (res.ok) {
      setStatus("Saved ✓");
      startTransition(() => router.refresh());
    } else {
      const { error } = await res.json();
      setStatus(`Error: ${error}`);
    }
  }

  async function toggleSkill(skillId: string, currentlyAttached: boolean) {
    if (currentlyAttached) {
      await fetch(`/api/agents/${agent.id}/skills/${skillId}`, {
        method: "DELETE",
      });
      setAttachedSkills((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    } else {
      await fetch(`/api/agents/${agent.id}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_id: skillId }),
      });
      setAttachedSkills((prev) => new Set(prev).add(skillId));
    }
  }

  async function toggleTool(toolId: string, currentlyAttached: boolean) {
    if (currentlyAttached) {
      await fetch(`/api/agents/${agent.id}/tools/${toolId}`, {
        method: "DELETE",
      });
      setAttachedTools((prev) => {
        const next = new Set(prev);
        next.delete(toolId);
        return next;
      });
    } else {
      await fetch(`/api/agents/${agent.id}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_id: toolId }),
      });
      setAttachedTools((prev) => new Set(prev).add(toolId));
    }
  }

  async function deleteAgent() {
    // biome-ignore lint/suspicious/noAlert: browser confirm is fine for v1; AlertDialog later
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) {
      return;
    }
    const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/agents");
    } else {
      const { error } = await res.json();
      setStatus(`Delete failed: ${error}`);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/admin/agents"
        >
          ← Back to agents
        </Link>
        <h1 className="mt-2 font-bold text-3xl tracking-tight">
          {icon} {name || "Untitled agent"}
        </h1>
      </header>

      {/* ─── Core fields ─── */}
      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="font-semibold">Basics</h2>

        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <Label htmlFor="icon">Icon</Label>
            <Input
              id="icon"
              maxLength={2}
              onChange={(e) => setIcon(e.target.value)}
              value={icon}
            />
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              onChange={(e) => setName(e.target.value)}
              value={name}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One-line description shown in the agent picker"
            value={description}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="provider">Model provider</Label>
            <select
              className="mt-2 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              id="provider"
              onChange={(e) => setModelProvider(e.target.value)}
              value={modelProvider}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="model">Model ID</Label>
            <Input
              id="model"
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. gemini-2.5-flash"
              value={modelId}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="telegram">Telegram command</Label>
            <Input
              id="telegram"
              onChange={(e) => setTelegramCommand(e.target.value)}
              placeholder="/triage"
              value={telegramCommand}
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
              <input
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                type="checkbox"
              />
              Active
            </label>
          </div>
        </div>
      </section>

      {/* ─── System prompt ─── */}
      <section className="space-y-3 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">System prompt</h2>
          <span className="text-muted-foreground text-xs">
            {systemPrompt.length} chars
          </span>
        </div>
        <Textarea
          className="min-h-[240px] font-mono text-xs"
          onChange={(e) => setSystemPrompt(e.target.value)}
          value={systemPrompt}
        />
      </section>

      {/* ─── Skills ─── */}
      <section className="space-y-3 rounded-lg border bg-card p-6">
        <h2 className="font-semibold">
          Skills ({attachedSkills.size}/{allSkills.length} attached)
        </h2>
        <p className="text-muted-foreground text-sm">
          Skills are injected into the system prompt at request time.
        </p>
        <ul className="divide-y">
          {allSkills.map((skill) => {
            const checked = attachedSkills.has(skill.id);
            return (
              <li className="py-2" key={skill.id}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    checked={checked}
                    className="mt-1"
                    onChange={() => toggleSkill(skill.id, checked)}
                    type="checkbox"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{skill.name}</p>
                    {skill.description && (
                      <p className="text-muted-foreground text-xs">
                        {skill.description}
                      </p>
                    )}
                    <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
                      {skill.category}
                    </span>
                  </div>
                </label>
              </li>
            );
          })}
          {allSkills.length === 0 && (
            <li className="py-4 text-center text-muted-foreground text-sm">
              No skills yet.{" "}
              <Link className="underline" href="/admin/skills">
                Create one
              </Link>
            </li>
          )}
        </ul>
      </section>

      {/* ─── Tools ─── */}
      <section className="space-y-3 rounded-lg border bg-card p-6">
        <h2 className="font-semibold">
          Tools ({attachedTools.size}/{allTools.length} attached)
        </h2>
        <p className="text-muted-foreground text-sm">
          The LLM can call these during the conversation.
        </p>
        <ul className="divide-y">
          {allTools.map((tool) => {
            const checked = attachedTools.has(tool.id);
            return (
              <li className="py-2" key={tool.id}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    checked={checked}
                    className="mt-1"
                    onChange={() => toggleTool(tool.id, checked)}
                    type="checkbox"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{tool.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {tool.description}
                    </p>
                    <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
                      {tool.tool_type}
                    </span>
                  </div>
                </label>
              </li>
            );
          })}
          {allTools.length === 0 && (
            <li className="py-4 text-center text-muted-foreground text-sm">
              No tools yet.{" "}
              <Link className="underline" href="/admin/tools">
                Create one
              </Link>
            </li>
          )}
        </ul>
      </section>

      {/* ─── Actions ─── */}
      <div className="flex items-center justify-between border-t pt-6">
        <Button onClick={deleteAgent} variant="destructive">
          Delete agent
        </Button>
        <div className="flex items-center gap-3">
          {status && (
            <span className="text-muted-foreground text-sm">{status}</span>
          )}
          <Button disabled={pending} onClick={saveCore}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
