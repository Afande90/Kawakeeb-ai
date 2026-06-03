"use client";

/**
 * Cron job manager — create/toggle/delete scheduled agent tasks.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Agent, CronJob } from "@/lib/db/agent-types";

const SCHEDULE_PRESETS = [
  { label: "Every day 9am", value: "0 9 * * *" },
  { label: "Every Monday 9am", value: "0 9 * * 1" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 15 min", value: "*/15 * * * *" },
];

interface Props {
  agents: Agent[];
  initialJobs: CronJob[];
}

export function CronManager({ initialJobs, agents }: Props) {
  const [jobs, setJobs] = useState<CronJob[]>(initialJobs);
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  async function toggle(job: CronJob) {
    const res = await fetch(`/api/cron-jobs/${job.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_enabled: !job.is_enabled }),
    });
    if (res.ok) {
      const { job: updated } = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)));
    }
  }

  async function remove(job: CronJob) {
    // biome-ignore lint/suspicious/noAlert: browser confirm is fine for v1
    if (!confirm(`Delete job "${job.name}"?`)) {
      return;
    }
    const res = await fetch(`/api/cron-jobs/${job.id}`, { method: "DELETE" });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    }
  }

  async function runNow(job: CronJob) {
    setRunning(job.id);
    try {
      const res = await fetch(`/api/cron-jobs/run?force=${job.id}`, {
        method: "POST",
      });
      const data = await res.json();
      const r = data.results?.[0];
      // biome-ignore lint/suspicious/noAlert: simple result feedback for v1
      alert(
        r
          ? `${job.name}: ${r.status}${r.detail ? ` — ${r.detail}` : ""}`
          : "No result returned."
      );
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Unknown error";
      // biome-ignore lint/suspicious/noAlert: simple result feedback for v1
      alert(`Run failed: ${m}`);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Scheduled tasks</h1>
          <p className="mt-1 text-muted-foreground">
            {jobs.length} jobs · recurring agent runs
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancel" : "+ New job"}
        </Button>
      </header>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        ⚠️ Jobs are stored and toggleable. Automatic execution (GitHub Actions)
        is a follow-up step — see BACKLOG.md.
      </div>

      {creating && (
        <CronEditor
          agents={agents}
          onCreated={(j) => {
            setJobs((prev) => [...prev, j]);
            setCreating(false);
          }}
        />
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Schedule</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Enabled</th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((job) => {
              const ag = agents.find((a) => a.id === job.agent_id);
              return (
                <tr key={job.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{job.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {job.instructions}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {job.schedule}
                  </td>
                  <td className="px-4 py-3">
                    {ag ? `${ag.icon ?? "🤖"} ${ag.name}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        job.is_enabled
                          ? "bg-emerald-500/20 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                      onClick={() => toggle(job)}
                      type="button"
                    >
                      {job.is_enabled ? "On" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        className="text-xs hover:underline disabled:opacity-50"
                        disabled={running === job.id || !job.agent_id}
                        onClick={() => runNow(job)}
                        type="button"
                      >
                        {running === job.id ? "Running…" : "Run now"}
                      </button>
                      <button
                        className="text-destructive text-xs hover:underline"
                        onClick={() => remove(job)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 && (
              <tr>
                <td
                  className="px-4 py-12 text-center text-muted-foreground"
                  colSpan={5}
                >
                  No scheduled jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CronEditor({
  agents,
  onCreated,
}: {
  agents: Agent[];
  onCreated: (j: CronJob) => void;
}) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("0 9 * * *");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setStatus("Saving...");
    const res = await fetch("/api/cron-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        schedule,
        agent_id: agentId || null,
        instructions,
        is_enabled: false,
      }),
    });
    if (res.ok) {
      const { job } = await res.json();
      onCreated(job);
    } else {
      const { error } = await res.json();
      setStatus(`Error: ${error}`);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cron-name">Name</Label>
          <Input
            id="cron-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Daily job scan"
            value={name}
          />
        </div>
        <div>
          <Label htmlFor="cron-agent">Agent</Label>
          <select
            className="mt-2 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            id="cron-agent"
            onChange={(e) => setAgentId(e.target.value)}
            value={agentId}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="cron-schedule">Schedule (cron expression)</Label>
        <Input
          className="font-mono"
          id="cron-schedule"
          onChange={(e) => setSchedule(e.target.value)}
          value={schedule}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {SCHEDULE_PRESETS.map((p) => (
            <button
              className="rounded bg-muted px-2 py-1 text-xs hover:bg-muted/70"
              key={p.value}
              onClick={() => setSchedule(p.value)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="cron-instr">Instructions</Label>
        <Textarea
          className="min-h-[100px]"
          id="cron-instr"
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Search UAE job boards for new Patient Care Coordinator roles and summarize the top 5."
          value={instructions}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {status && (
          <span className="text-muted-foreground text-sm">{status}</span>
        )}
        <Button onClick={save}>Create job</Button>
      </div>
    </div>
  );
}
