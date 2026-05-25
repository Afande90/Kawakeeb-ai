"use client";

/**
 * Skills CRUD UI. Inline edit panel; "+ New" button creates a blank skill.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Skill } from "@/lib/db/agent-types";

const CATEGORIES = [
  "general",
  "tactical_analysis",
  "coding",
  "content",
  "research",
  "automation",
];

interface Props {
  initialSkills: Skill[];
}

export function SkillsManager({ initialSkills }: Props) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSkills[0]?.id ?? null
  );
  const [creating, setCreating] = useState(false);
  const selected = skills.find((s) => s.id === selectedId) ?? null;

  function onCreated(s: Skill) {
    setSkills((prev) =>
      [...prev, s].sort((a, b) => a.name.localeCompare(b.name))
    );
    setSelectedId(s.id);
    setCreating(false);
  }

  function onUpdated(s: Skill) {
    setSkills((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }

  function onDeleted(id: string) {
    setSkills((prev) => prev.filter((s) => s.id !== id));
    setSelectedId(skills[0]?.id ?? null);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Skills</h1>
          <p className="mt-1 text-muted-foreground">
            {skills.length} skills · markdown instructions you attach to agents
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setSelectedId(null);
          }}
        >
          + New skill
        </Button>
      </header>

      <div className="grid grid-cols-[260px_1fr] gap-6">
        {/* Sidebar list */}
        <aside className="space-y-1 rounded-lg border bg-card p-2">
          {skills.map((skill) => (
            <button
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                selectedId === skill.id
                  ? "bg-muted font-medium"
                  : "hover:bg-muted/50"
              }`}
              key={skill.id}
              onClick={() => {
                setSelectedId(skill.id);
                setCreating(false);
              }}
              type="button"
            >
              <p>{skill.name}</p>
              <p className="text-muted-foreground text-xs">{skill.category}</p>
            </button>
          ))}
          {skills.length === 0 && (
            <p className="px-3 py-2 text-muted-foreground text-sm">
              No skills yet.
            </p>
          )}
        </aside>

        {/* Editor */}
        <div>
          {creating ? (
            <SkillEditor
              initial={{
                name: "",
                description: "",
                content: "",
                category: "general",
              }}
              key="new"
              mode="create"
              onSaved={onCreated}
            />
          ) : selected ? (
            <SkillEditor
              initial={selected}
              key={selected.id}
              mode="edit"
              onDeleted={onDeleted}
              onSaved={onUpdated}
            />
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              Select a skill to edit, or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EditorProps {
  initial: Partial<Skill> & {
    name: string;
    description: string | null;
    content: string;
    category: string;
  };
  mode: "create" | "edit";
  onDeleted?: (id: string) => void;
  onSaved: (s: Skill) => void;
}

function SkillEditor({ initial, mode, onSaved, onDeleted }: EditorProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [category, setCategory] = useState(initial.category);
  const [content, setContent] = useState(initial.content);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setStatus("Saving...");
    const url = mode === "create" ? "/api/skills" : `/api/skills/${initial.id}`;
    const method = mode === "create" ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        category,
        content,
      }),
    });
    if (res.ok) {
      const { skill } = await res.json();
      onSaved(skill);
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
    if (!confirm(`Delete skill "${initial.name}"?`)) {
      return;
    }
    const res = await fetch(`/api/skills/${initial.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted(initial.id);
    } else {
      const { error } = await res.json();
      setStatus(`Delete failed: ${error}`);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="grid grid-cols-[1fr_200px] gap-3">
        <div>
          <Label htmlFor="skill-name">Name</Label>
          <Input
            id="skill-name"
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </div>
        <div>
          <Label htmlFor="skill-cat">Category</Label>
          <select
            className="mt-2 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            id="skill-cat"
            onChange={(e) => setCategory(e.target.value)}
            value={category}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="skill-desc">Description</Label>
        <Input
          id="skill-desc"
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One-line summary"
          value={description}
        />
      </div>

      <div>
        <Label htmlFor="skill-content">Content (markdown)</Label>
        <Textarea
          className="min-h-[360px] font-mono text-xs"
          id="skill-content"
          onChange={(e) => setContent(e.target.value)}
          placeholder="# Skill instructions...\n\nMarkdown supported."
          value={content}
        />
      </div>

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
            {mode === "create" ? "Create skill" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
