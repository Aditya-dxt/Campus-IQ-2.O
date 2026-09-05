import { useEffect, useRef, useState } from "react";
import { Loader2, Send, ThumbsDown, ThumbsUp, Sparkles, User, Bot } from "lucide-react";
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
    chatApi.getSuggestedQuestions(selectedDocId).then(res=>setSuggestions(res.suggested_questions||[])).catch(()=>{}).finally(()=>setLoadingSuggestions(false));
  }, [selectedDocId]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,sending]);

  const handleSend = async (question) => {
    const text = (question || input).trim();
    if (!text || !selectedDocId || sending) return;
    setInput(""); setSending(true);
    setMessages(prev=>[...prev,{role:"user",content:text}]);
    try {
      const reply = await chatApi.sendMessage({ docId: selectedDocId, question: text });
      setMessages(prev=>[...prev,{role:"assistant",content:reply.answer,source:reply.snippets?.[0]||null,id:reply.feedback_id||`temp-${Date.now()}`,feedback:null}]);
    } catch {
      setMessages(prev=>[...prev,{role:"assistant",content:"Sorry, I encountered an error. Please try again.",id:`err-${Date.now()}`}]);
    } finally { setSending(false); }
  };
  const handleFeedback = async (messageId, thumbs) => {
    if(messageId.startsWith('temp-')||messageId.startsWith('err-')) return;
    try{ await chatApi.submitFeedback({messageId,thumbs}); setMessages(prev=>prev.map(m=>m.id===messageId?{...m,feedback:thumbs}:m)); }catch{}
  };

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[480px] flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {suggestions.length>0 && messages.length===0 && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Try asking</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0,4).map((q,i)=>(
              <button key={i} onClick={()=>handleSend(q)} className="rounded-full bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600 text-left max-w-full truncate">{q}</button>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#f8fafc]">
        {messages.length===0 && !sending && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow"><Bot className="h-6 w-6 text-white" /></div>
            <p className="mt-3 font-bold text-slate-900">Ask anything about your material</p><p className="text-sm text-slate-500 mt-1 max-w-sm">Answers are grounded strictly in your uploaded excerpts — no hallucination. Use suggested questions above or type your own.</p>
          </div>
        )}
        {messages.map((msg,i)=> msg.role==="user" ? (
          <div key={i} className="flex justify-end gap-2 animate-fade-in">
            <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm text-white shadow">{msg.content}</div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600"><User className="h-4 w-4" /></span>
          </div>
        ) : (
          <div key={msg.id||i} className="flex gap-2 animate-fade-in">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Bot className="h-4 w-4" /></span>
            <div className="flex-1 space-y-2">
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white border border-slate-200 px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed shadow-sm">{msg.content}</div>
              {msg.source && (
                <details className="max-w-[92%] text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
                  <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900">View source excerpt</summary>
                  <p className="mt-2 italic text-slate-500 pl-3 border-l-2 border-indigo-200 leading-relaxed">{msg.source}</p>
                </details>
              )}
              <div className="flex gap-1">
                <button onClick={()=>handleFeedback(msg.id,true)} className={`rounded-lg p-1.5 ${msg.feedback===true?"bg-emerald-50 text-emerald-600":"text-slate-400 hover:bg-white hover:text-slate-600"}`}><ThumbsUp className="h-4 w-4" /></button>
                <button onClick={()=>handleFeedback(msg.id,false)} className={`rounded-lg p-1.5 ${msg.feedback===false?"bg-red-50 text-red-600":"text-slate-400 hover:bg-white hover:text-slate-600"}`}><ThumbsDown className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {sending && <div className="flex gap-2 items-center text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Thinking… grounded in your notes</div>}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-200 bg-white p-3 flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder="Ask about your notes…" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
        <button onClick={()=>handleSend()} disabled={sending||!input.trim()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
