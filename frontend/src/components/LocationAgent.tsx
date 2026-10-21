import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Bot, LoaderCircle, Send, Sparkles, UserRound } from "lucide-react";

import { askLocationAgent } from "../api/client";
import type {
  AgentHistoryMessage,
  LocationDashboardResponse,
} from "../types";

interface LocationAgentProps {
  onLocationData: (data: LocationDashboardResponse) => void;
}

interface ChatMessage extends AgentHistoryMessage {
  id: number;
  error?: boolean;
  assistantMode?: "openai" | "guided";
}

const STARTER_PROMPTS = [
  "Get the current AQI and forecast for Bengaluru, India",
  "How is the air quality in London, UK?",
];

const LocationAgent: React.FC<LocationAgentProps> = ({ onLocationData }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      content: "Ask about any city or place. I’ll find the location, fetch its latest air-quality data, and update the dashboard.",
      assistantMode: "guided",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const messageSequence = useRef(1);
  const endOfMessages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending]);

  const sendMessage = async (rawMessage: string) => {
    const content = rawMessage.trim();
    if (!content || pending) return;

    const history: AgentHistoryMessage[] = messages
      .slice(-12)
      .map(({ role, content: text }) => ({
        role,
        content: text,
      }));
    setMessages((current) => [
      ...current,
      { id: messageSequence.current++, role: "user", content },
    ]);
    setDraft("");
    setPending(true);

    try {
      const response = await askLocationAgent(content, history);
      if (response.location_data) onLocationData(response.location_data);
      setMessages((current) => [
        ...current,
        {
          id: messageSequence.current++,
          role: "assistant",
          content: response.message,
          assistantMode: response.assistant_mode,
        },
      ]);
    } catch (error: unknown) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : undefined;
      const errorText =
        typeof detail === "string"
          ? detail
          : axios.isAxiosError(error) && !error.response
            ? "Could not reach the backend. Check that the API is running and try again."
            : error instanceof Error
              ? error.message
              : "The AI agent request failed. Please try again.";
      setMessages((current) => [
        ...current,
        { id: messageSequence.current++, role: "assistant", content: errorText, error: true },
      ]);
    } finally {
      setPending(false);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  return (
    <section className="glass-card overflow-hidden" aria-label="Location assistant">
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3.5 sm:px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-400/10">
          <Sparkles className="h-4 w-4 text-indigo-300" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Location assistant</h3>
          <p className="text-xs text-slate-500">Ask naturally; location lookup works without an AI key</p>
        </div>
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  isUser ? "bg-sky-400/10 text-sky-300" : "bg-indigo-400/10 text-indigo-300"
                }`}
              >
                {isUser ? <UserRound className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.error
                    ? "border border-amber-400/20 bg-amber-400/5 text-amber-100"
                    : isUser
                      ? "bg-sky-500/10 text-sky-50"
                      : "border border-slate-800 bg-slate-950/60 text-slate-200"
                }`}
              >
                {!isUser && message.assistantMode && (
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {message.assistantMode === "openai" ? "OpenAI assistant" : "Location lookup"}
                  </span>
                )}
                {message.content}
              </div>
            </div>
          );
        })}
        {pending && (
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-400/10 text-indigo-300">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="flex items-center gap-2">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Finding the place and fetching its latest data…
            </span>
          </div>
        )}
        <div ref={endOfMessages} />
      </div>

      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-5">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={pending}
              onClick={() => void sendMessage(prompt)}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-500/40 hover:text-white disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2 border-t border-slate-800 p-3 sm:p-4">
        <label htmlFor="location-agent-prompt" className="sr-only">Ask about a location</label>
        <input
          id="location-agent-prompt"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1200}
          disabled={pending}
          placeholder="e.g. What’s the AQI in Tokyo?"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/15 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white transition hover:from-sky-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </section>
  );
};

export default LocationAgent;
