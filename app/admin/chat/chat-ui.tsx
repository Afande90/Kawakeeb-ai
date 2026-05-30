"use client";

/**
 * Chat playground: sidebar of agents + a streaming chat window.
 * Talks to POST /api/agent-chat via the AI SDK UI-message protocol.
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/lib/db/agent-types";

interface Props {
  agents: Agent[];
}

const STORAGE_PREFIX = "kawakeeb-chat:";

function loadHistory(agentId: string): UIMessage[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + agentId);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(agentId: string, messages: UIMessage[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_PREFIX + agentId, JSON.stringify(messages));
  } catch {
    // storage full or unavailable — ignore
  }
}

export function ChatPlayground({ agents }: Props) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    agents[0]?.id ?? null
  );
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep the current agent id available to the transport without
  // re-instantiating it on every selection change.
  const agentIdRef = useRef(selectedAgentId);
  agentIdRef.current = selectedAgentId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent-chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { agentId: agentIdRef.current, messages, source: "chat" },
        }),
      }),
    []
  );

  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport,
  });

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;
  const isStreaming = status === "submitted" || status === "streaming";

  // Load this agent's saved history on mount / when the agent changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: setMessages is stable; we only want to reload on agent switch
  useEffect(() => {
    if (selectedAgentId) {
      setMessages(loadHistory(selectedAgentId));
    }
  }, [selectedAgentId]);

  // Persist history whenever it changes and we're idle (not mid-stream).
  useEffect(() => {
    if (selectedAgentId && !isStreaming) {
      saveHistory(selectedAgentId, messages);
    }
  }, [messages, selectedAgentId, isStreaming]);

  function switchAgent(id: string) {
    // Persist the current agent's chat before switching away.
    if (selectedAgentId) {
      saveHistory(selectedAgentId, messages);
    }
    setSelectedAgentId(id);
    // The load effect will restore the new agent's history.
  }

  function clearCurrent() {
    setMessages([]);
    if (selectedAgentId) {
      saveHistory(selectedAgentId, []);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    const hasFiles = files && files.length > 0;
    if (!(selectedAgentId && (text || hasFiles)) || isStreaming) {
      return;
    }
    sendMessage({ text, files });
    setInput("");
    setFiles(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Agent sidebar */}
      <aside className="w-60 shrink-0 space-y-1 overflow-y-auto rounded-lg border bg-card p-2">
        <p className="px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Agents
        </p>
        {agents.map((agent) => (
          <button
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
              selectedAgentId === agent.id
                ? "bg-muted font-medium"
                : "hover:bg-muted/50"
            }`}
            key={agent.id}
            onClick={() => switchAgent(agent.id)}
            type="button"
          >
            <span className="mr-2">{agent.icon ?? "🤖"}</span>
            {agent.name}
          </button>
        ))}
      </aside>

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{selectedAgent?.icon ?? "🤖"}</span>
            <div>
              <p className="font-medium text-sm">
                {selectedAgent?.name ?? "Select an agent"}
              </p>
              <p className="text-muted-foreground text-xs">
                {selectedAgent?.model_provider}/{selectedAgent?.model_id}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button onClick={clearCurrent} size="sm" variant="ghost">
              Clear
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-center text-muted-foreground text-sm">
              <div>
                <p className="text-2xl">{selectedAgent?.icon ?? "💬"}</p>
                <p className="mt-2">
                  Start chatting with {selectedAgent?.name ?? "your agent"}.
                </p>
                {selectedAgent?.description && (
                  <p className="mt-1 text-xs">{selectedAgent.description}</p>
                )}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
              key={message.id}
            >
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.parts.map((part, i) => {
                  // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only and stable per message
                  const partKey = `${message.id}-${i}`;
                  if (part.type === "text") {
                    return <span key={partKey}>{part.text}</span>;
                  }
                  if (part.type === "file") {
                    const filePart = part as {
                      type: "file";
                      mediaType?: string;
                      url?: string;
                      filename?: string;
                    };
                    if (filePart.mediaType?.startsWith("image/")) {
                      return (
                        // biome-ignore lint/performance/noImgElement: data-url preview in chat
                        <img
                          alt={filePart.filename ?? "attachment"}
                          className="mt-1 max-h-48 rounded"
                          key={partKey}
                          src={filePart.url}
                        />
                      );
                    }
                    return (
                      <span
                        className="my-1 block rounded bg-background/50 px-2 py-1 text-xs"
                        key={partKey}
                      >
                        📎 {filePart.filename ?? "attachment"}
                      </span>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    return (
                      <span
                        className="my-1 block rounded bg-background/50 px-2 py-1 font-mono text-xs opacity-70"
                        key={partKey}
                      >
                        → {part.type.replace("tool-", "")}
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted px-4 py-2 text-muted-foreground text-sm">
                <span className="animate-pulse">●●●</span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-destructive text-sm">
              {error.message}
            </div>
          )}
        </div>

        {/* Input */}
        <form className="border-t p-3" onSubmit={onSubmit}>
          {files && files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {Array.from(files).map((f) => (
                <span
                  className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
                  key={f.name}
                >
                  📎 {f.name}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              accept="image/*,application/pdf,text/plain,.md,.csv"
              className="hidden"
              multiple
              onChange={(e) => setFiles(e.target.files ?? undefined)}
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={!selectedAgentId}
              onClick={() => fileInputRef.current?.click()}
              size="icon"
              type="button"
              variant="outline"
            >
              📎
            </Button>
            <input
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={!selectedAgentId}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message ${selectedAgent?.name ?? "agent"}...`}
              value={input}
            />
            <Button
              disabled={isStreaming || !(input.trim() || files?.length)}
              type="submit"
            >
              {isStreaming ? "..." : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
