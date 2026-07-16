import { apiClient, delay, mockOrFetch } from "./client";
import {
  MOCK_CHAT_RESPONSES,
  MOCK_DOCUMENTS,
  MOCK_SUGGESTED_QUESTIONS,
} from "../mocks/mockData";

function pickResponse(question) {
  const q = question.toLowerCase();
  if (q.includes("normal") || q.includes("3nf")) return MOCK_CHAT_RESPONSES.normalization;
  if (q.includes("fcfs") || q.includes("round robin") || q.includes("scheduling"))
    return MOCK_CHAT_RESPONSES.scheduling;
  if (q.includes("bfs") || q.includes("dfs") || q.includes("graph"))
    return MOCK_CHAT_RESPONSES.bfs;
  if (q.includes("aptitude")) return MOCK_CHAT_RESPONSES.aptitude;
  return MOCK_CHAT_RESPONSES.default;
}

export async function getDocuments() {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      return [...MOCK_DOCUMENTS];
    },
    requestFn: async () => {
      const { data } = await apiClient.get("/chat/documents");
      return data;
    },
  });
}

export async function getSuggestedQuestions() {
  return mockOrFetch({
    mockFn: async () => {
      await delay(200);
      return [...MOCK_SUGGESTED_QUESTIONS];
    },
    requestFn: async () => {
      const { data } = await apiClient.get("/chat/suggestions");
      return data;
    },
  });
}

export async function sendMessage({ docId, question }) {
  return mockOrFetch({
    mockFn: async () => {
      await delay(700);
      const response = pickResponse(question);
      return {
        id: `msg-${Date.now()}`,
        docId,
        question,
        answer: response.answer,
        source: response.source,
        createdAt: new Date().toISOString(),
      };
    },
    requestFn: async () => {
      const { data } = await apiClient.post("/chat/message", { doc_id: docId, question });
      return data;
    },
  });
}

export async function submitFeedback({ messageId, thumbs }) {
  return mockOrFetch({
    mockFn: async () => {
      await delay(200);
      return { id: messageId, thumbs, status: "recorded" };
    },
    requestFn: async () => {
      const { data } = await apiClient.post("/chat/feedback", {
        message_id: messageId,
        thumbs,
      });
      return data;
    },
  });
}
