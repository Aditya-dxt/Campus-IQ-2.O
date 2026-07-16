import { useEffect, useState } from "react";
import * as chatApi from "../api/chat";
import ChatWindow from "../components/ChatWindow";
import LoadingState from "../components/LoadingState";

export default function StudyAssistant() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    chatApi
      .getDocuments()
      .then((docs) => {
        setDocuments(docs);
        if (docs.length) setSelectedDocId(docs[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading study materials…" />;
  if (error) return <p className="text-risk-high text-sm">{error}</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Study Assistant</h1>
        <p className="text-sm text-ink-muted mt-1">
          Chat with your course materials — answers include source snippets from your docs.
        </p>
      </div>
      <ChatWindow
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDoc={setSelectedDocId}
      />
    </div>
  );
}
