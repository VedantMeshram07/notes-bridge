const BASE_URL = "https://ttixfaajiwhtmylmcduc.functions.supabase.co";
const AUTH = "Bearer sb_publishable_7sn2F_9ASXQRdAvcN8r9rA_va0xWGVW";

export type Source = {
  note_id: string;
  similarity: number | null;
  excerpt: string;
};

export type RagResponse = {
  answer: string;
  sources: Source[];
};

export type EmailAgentResponse = {
  sessionId: string;
  draft: { subject: string; body: string };
  verification: { grounded: boolean; issues: string[]; summary: string };
  subQuestions: string[];
  revisionCount: number;
  needsHumanReview: boolean;
  recipientEmail: string | null;
  sources: Source[];
};

export type SendEmailResponse = { sent?: boolean; id?: string; error?: string };

export type AddNoteResponse = {
  saved: boolean;
  note: { id: string; title: string; path: string; links: string[]; tags: string[] };
  chunksCreated: number;
  error?: string;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTH,
    },
    body: JSON.stringify(body),
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ??
      `Request failed (${res.status} ${res.statusText})`;
    throw new Error(message);
  }

  return data as T;
}

export const ragQuery = (question: string) =>
  post<RagResponse>("/rag-query", { question });

export const emailAgent = (question: string, sessionId?: string) =>
  post<EmailAgentResponse>(
    "/email-agent",
    sessionId ? { question, sessionId } : { question },
  );

export const sendEmail = (to: string, subject: string, body: string) =>
  post<SendEmailResponse>("/send-email", { to, subject, body });

export const addNote = (title: string, content: string, folder?: string) =>
  post<AddNoteResponse>("/add-note", folder ? { title, content, folder } : { title, content });

export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
