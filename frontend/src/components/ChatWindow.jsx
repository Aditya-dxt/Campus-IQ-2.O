import { useEffect, useRef, useState } from "react";
import { Loader2, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import * as chatApi from "../api/chat";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";

export default function ChatWindow({ selectedDocId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!selectedDocId) return;
    chatApi
      .getSuggestedQuestions(selectedDocId)
      .then((res) => setSuggestions(res.suggested_questions || []))
      .catch((err) => console.error(err))
      .finally(() => setLoadingSuggestions(false));
  }, [selectedDocId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (question) => {
    const text = (question || input).trim();
    if (!text || !selectedDocId || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const reply = await chatApi.sendMessage({ docId: selectedDocId, question: text });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply.answer,
          source: (reply.snippets && reply.snippets.length > 0) ? reply.snippets[0] : null,
          id: reply.feedback_id || `temp-${Date.now()}`,
          feedback: null,
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          id: `err-${Date.now()}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleFeedback = async (messageId, thumbs) => {
    if (messageId.startsWith('temp-') || messageId.startsWith('err-')) return;
    try {
      await chatApi.submitFeedback({ messageId, thumbs });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: thumbs } : m)),
      );
    } catch (err) {
      console.error("Failed to submit feedback", err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[480px] flex-col rounded-2xl border border-border bg-surface-elevated overflow-hidden">

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !sending && (
          <EmptyState
            title="Ask anything about your materials"
            description="Pick a document above, tap a suggested question, or type your own."
          />
        )}
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex justify-end animate-fade-in">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={msg.id || i} className="animate-fade-in space-y-2">
              <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>
              {msg.source && (
                <details className="max-w-[90%] text-xs text-ink-muted bg-surface/60 border border-border/70 rounded-xl px-3 py-2">
                  <summary className="cursor-pointer font-medium text-ink/70 hover:text-ink select-none">
                    View source notes excerpt
                  </summary>
                  <p className="mt-2 text-xs italic text-ink-muted/90 pl-2 border-l-2 border-primary/40 leading-normal">
                    {msg.source}
                  </p>
                </details>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleFeedback(msg.id, true)}
                  className={`rounded-lg p-1.5 transition-colors ${
                    msg.feedback === true
                      ? "bg-risk-low-bg text-risk-low"
                      : "text-ink-muted hover:bg-surface"
                  }`}
                  aria-label="Helpful"
                >
                  <ThumbsUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback(msg.id, false)}
                  className={`rounded-lg p-1.5 transition-colors ${
                    msg.feedback === false
                      ? "bg-risk-high-bg text-risk-high"
                      : "text-ink-muted hover:bg-surface"
                  }`}
                  aria-label="Not helpful"
                >
                  <ThumbsDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          ),
        )}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border px-4 py-3 space-y-3 bg-surface/50">
        {!loadingSuggestions && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                disabled={!selectedDocId || sending}
                className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-muted hover:border-primary/30 hover:text-primary disabled:opacity-50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {loadingSuggestions && <LoadingState message="Loading suggestions…" />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={!selectedDocId || sending}
            className="flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || !selectedDocId || sending}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
