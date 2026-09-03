import { apiClient } from "./client";

export async function uploadDocument(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post("/chat/ingest", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getSuggestedQuestions(docId) {
  const { data } = await apiClient.get(`/chat/questions?doc_id=${docId}`);
  return data; // returns { doc_id, suggested_questions: [...] }
}

export async function sendMessage({ docId, question }) {
  const { data } = await apiClient.post("/chat/ask", { doc_id: docId, question });
  return data; // returns { feedback_id, answer, snippets }
}

export async function submitFeedback({ messageId, thumbs }) {
  const { data } = await apiClient.post("/chat/feedback", {
    feedback_id: messageId,
    thumbs,
  });
  return data;
}
