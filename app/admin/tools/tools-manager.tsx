"use client";

/**
 * Tools CRUD UI. Sidebar list + inline editor.
 * Parameters and headers are edited as raw JSON (good enough for v1).
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tool, ToolType } from "@/lib/db/agent-types";

const TOOL_TYPES: ToolType[] = ["webhook", "cli", "internal"];

interface Props {
  initialTools: Tool[];
}

export function ToolsManager({ initialTools }: Props) {
  const [tools, setTools] = useState<Tool[]>(initialTools);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTools[0]?.id ?? null
  );
  const [creating, setCreating] = useState(false);
  const selected = tools.find((t) => t.id === selectedId) ?? null;

  function onCreated(t: Tool) {
    setTools((prev) =>
      [...prev, t].sort((a, b) => a.name.localeCompare(b.name))
    );
    setSelectedId(t.id);
    setCreating(false);
  }

  function onUpdated(t: Tool) {
    setTools((prev) => prev.map((x) => (x.id === t.id ? t : x)));
  }

  function onDeleted(id: string) {
    setTools((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(tools[0]?.id ?? null);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Tools</h1>
          <p className="mt-1 text-muted-foreground">
            {tools.length} tools · webhook, CLI, or internal handlers
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setSelectedId(null);
          }}
        >
          + New tool
        </Button>
      </header>

      <div className="grid grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-1 rounded-lg border bg-card p-2">
          {tools.map((tool) => (
            <button
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                selectedId === tool.id
                  ? "bg-muted font-medium"
                  : "hover:bg-muted/50"
              }`}
              key={tool.id}
              onClick={() => {
                setSelectedId(tool.id);
                setCreating(false);
              }}
              type="button"
            >
              <p>{tool.name}</p>
              <p className="text-muted-foreground text-xs">{tool.tool_type}</p>
            </button>
          ))}
          {tools.length === 0 && (
            <p className="px-3 py-2 text-muted-foreground text-sm">
              No tools yet.
            </p>
          )}
        </aside>

        <div>
          {creating ? (
            <ToolEditor
              initial={{
                name: "",
                description: "",
                tool_type: "webhook",
                webhook_url: null,
                cli_command: null,
                http_method: "POST",
                headers: {},
                parameters: [],
                is_active: true,
              }}
              key="new"
              mode="create"
              onSaved={onCreated}
            />
          ) : selected ? (
            <ToolEditor
              initial={selected}
              key={selected.id}
              mode="edit"
              onDeleted={onDeleted}
              onSaved={onUpdated}
            />
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              Select a tool to edit, or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EditorProps {
  initial: Partial<Tool> & {
    name: string;
    description: string;
    tool_type: ToolType;
    webhook_url: string | null;
    cli_command: string | null;
    http_method: string;
    headers: Record<string, string>;
    parameters: Tool["parameters"];
    is_active: boolean;
  };
  mode: "create" | "edit";
  onDeleted?: (id: string) => void;
  onSaved: (t: Tool) => void;
}

function ToolEditor({ initial, mode, onSaved, onDeleted }: EditorProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [toolType, setToolType] = useState<ToolType>(initial.tool_type);
  const [webhookUrl, setWebhookUrl] = useState(initial.webhook_url ?? "");
  const [cliCommand, setCliCommand] = useState(initial.cli_command ?? "");
  const [httpMethod, setHttpMethod] = useState(initial.http_method);
  const [headersJson, setHeadersJson] = useState(
    JSON.stringify(initial.headers ?? {}, null, 2)
  );
  const [parametersJson, setParametersJson] = useState(
    JSON.stringify(initial.parameters ?? [], null, 2)
  );
  const [isActive, setIsActive] = useState(initial.is_active);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setStatus("Saving...");

    let headers: Record<string, string>;
    let parameters: Tool["parameters"];
    try {
      headers = JSON.parse(headersJson);
      parameters = JSON.parse(parametersJson);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "JSON parse error";
      setStatus(`Invalid JSON: ${msg}`);
      return;
    }

    const url = mode === "create" ? "/api/tools" : `/api/tools/${initial.id}`;
    const method = mode === "create" ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        tool_type: toolType,
        webhook_url: toolType === "webhook" ? webhookUrl || null : null,
        cli_command: toolType === "cli" ? cliCommand || null : null,
        http_method: httpMethod,
        headers,
        parameters,
        is_active: isActive,
      }),
    });
    if (res.ok) {
      const { tool } = await res.json();
      onSaved(tool);
      setStatus("Saved ✓");
    } else {
      const { error } = await res.json();
      setStatus(`Error: ${error}`);
    }
  }

  async function del() {
    if (!(initial.id && onDeleted)) {
      return;
    }
    // biome-ignore lint/suspicious/noAlert: browser confirm is fine for v1
    if (!confirm(`Delete tool "${initial.name}"?`)) {
      return;
    }
    const res = await fetch(`/api/tools/${initial.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted(initial.id);
    } else {
      const { error } = await res.json();
      setStatus(`Delete failed: ${error}`);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div>
          <Label htmlFor="tool-name">Name</Label>
          <Input
            id="tool-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="brave_search"
            value={name}
          />
        </div>
        <div>
          <Label htmlFor="tool-type">Type</Label>
          <select
            className="mt-2 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            id="tool-type"
            onChange={(e) => setToolType(e.target.value as ToolType)}
            value={toolType}
          >
            {TOOL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="tool-desc">Description (what the LLM sees)</Label>
        <Textarea
          className="min-h-[60px]"
          id="tool-desc"
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Search the web with Brave..."
          value={description}
        />
      </div>

      {toolType === "webhook" && (
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div>
            <Label htmlFor="tool-url">Webhook URL</Label>
            <Input
              id="tool-url"
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint"
              value={webhookUrl}
            />
          </div>
          <div>
            <Label htmlFor="tool-method">HTTP method</Label>
            <select
              className="mt-2 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              id="tool-method"
              onChange={(e) => setHttpMethod(e.target.value)}
              value={httpMethod}
            >
              {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {toolType === "cli" && (
        <div>
          <Label htmlFor="tool-cli">
            CLI command (placeholders: {"{{arg_name}}"})
          </Label>
          <Input
            className="font-mono"
            id="tool-cli"
            onChange={(e) => setCliCommand(e.target.value)}
            placeholder={"manim render {{code}} --quality {{quality}}"}
            value={cliCommand}
          />
        </div>
      )}

      <div>
        <Label htmlFor="tool-headers">Headers (JSON)</Label>
        <Textarea
          className="min-h-[80px] font-mono text-xs"
          id="tool-headers"
          onChange={(e) => setHeadersJson(e.target.value)}
          value={headersJson}
        />
      </div>

      <div>
        <Label htmlFor="tool-params">
          Parameters (JSON array of {"{name, type, required, description}"})
        </Label>
        <Textarea
          className="min-h-[140px] font-mono text-xs"
          id="tool-params"
          onChange={(e) => setParametersJson(e.target.value)}
          value={parametersJson}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          type="checkbox"
        />
        Active (callable by agents)
      </label>

      <div className="flex items-center justify-between border-t pt-4">
        {mode === "edit" && (
          <Button onClick={del} variant="destructive">
            Delete
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {status && (
            <span className="text-muted-foreground text-sm">{status}</span>
          )}
          <Button onClick={save}>
            {mode === "create" ? "Create tool" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
