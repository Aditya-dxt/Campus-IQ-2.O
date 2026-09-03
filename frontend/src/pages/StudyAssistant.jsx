import { useState } from "react";
import * as chatApi from "../api/chat";
import ChatWindow from "../components/ChatWindow";
import LoadingState from "../components/LoadingState";
import { Upload } from "lucide-react";

export default function StudyAssistant() {
  const [docId, setDocId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setError("");
    try {
      const result = await chatApi.uploadDocument(file);
      setDocId(result.doc_id);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to upload document");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Study Assistant</h1>
        <p className="text-sm text-ink-muted mt-1">
          Upload a document (PDF, TXT, DOCX) to start chatting with your course materials.
        </p>
      </div>
      
      {!docId && !loading && (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-surface-elevated">
          <Upload className="w-12 h-12 text-ink-muted mb-4" />
          <h3 className="text-lg font-medium text-ink mb-2">Upload a Document</h3>
          <p className="text-sm text-ink-muted mb-6 text-center max-w-sm">
            Upload your lecture notes or syllabus to instantly generate a RAG-powered chatbot.
          </p>
          <label className="cursor-pointer bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary-hover transition-colors">
            Select File
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
            />
          </label>
          {error && <p className="text-risk-high text-sm mt-4">{error}</p>}
        </div>
      )}

      {loading && <LoadingState message="Ingesting document (this might take a moment)…" />}

      {docId && (
        <ChatWindow
          selectedDocId={docId}
        />
      )}
    </div>
  );
}
