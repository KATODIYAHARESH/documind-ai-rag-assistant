import type {
  ChatMessage,
  ConversationSummary,
  DashboardStats,
  DocumentDto,
  PublicConfig,
  SafeUser,
} from "@/lib/types";
import { authHeaders, storeToken } from "./session-token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Options = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit | null };

/** Centralised fetch wrapper: same-origin cookies, JSON handling, normalised errors. */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...(headers as Record<string, string> | undefined),
    },
  };
  if (json !== undefined) init.body = JSON.stringify(json);
  else if (rest.body !== undefined) init.body = rest.body;

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, "Network error. Check your connection and try again.", "network_error");
  }

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message: string | undefined = data?.error?.message;
    throw new ApiError(res.status, message ?? `Request failed (${res.status}).`, data?.error?.code, data?.errors);
  }
  return data as T;
}

export interface UploadResult {
  documents: DocumentDto[];
  errors?: { filename: string; message: string }[];
}

type SessionResponse = { user: SafeUser; token: string };

export const authApi = {
  me: () => api<{ user: SafeUser }>("/api/auth/me"),
  login: async (input: { email: string; password: string }): Promise<SessionResponse> => {
    const res = await api<SessionResponse>("/api/auth/login", { method: "POST", json: input });
    storeToken(res.token);
    return res;
  },
  register: async (input: { name: string; email: string; password: string }): Promise<SessionResponse> => {
    const res = await api<SessionResponse>("/api/auth/register", { method: "POST", json: input });
    storeToken(res.token);
    return res;
  },
  logout: async (): Promise<{ ok: boolean }> => {
    try {
      return await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      storeToken(null);
    }
  },
  updateProfile: (input: { name: string }) =>
    api<{ user: SafeUser }>("/api/auth/me", { method: "PATCH", json: input }),
};

export const documentsApi = {
  list: (query = "") => api<{ documents: DocumentDto[] }>(`/api/documents?q=${encodeURIComponent(query)}`),
  upload: (files: File[], onProgress?: (percent: number) => void) => uploadDocuments(files, onProgress),
  remove: (id: string) => api<{ ok: boolean }>(`/api/documents/${id}`, { method: "DELETE" }),
  reprocess: (id: string) => api<{ document: DocumentDto }>(`/api/documents/${id}/reprocess`, { method: "POST" }),
  addSamples: () =>
    api<{ created: number; skipped: string[]; message: string }>("/api/documents/samples", { method: "POST" }),
  fileUrl: (id: string) => `/api/documents/${id}/file`,
};

function uploadDocuments(files: File[], onProgress?: (percent: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file, file.name));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents");
    xhr.withCredentials = true;
    for (const [name, value] of Object.entries(authHeaders())) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data: (UploadResult & { error?: { message?: string; code?: string } }) | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 400) {
        reject(new ApiError(xhr.status, data?.error?.message ?? "Upload failed. Please try again.", data?.error?.code, data?.errors));
      } else {
        resolve({ documents: data?.documents ?? [], errors: data?.errors });
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error during upload.", "network_error"));
    xhr.send(form);
  });
}

export const chatApi = {
  listConversations: () => api<{ conversations: ConversationSummary[] }>("/api/chat"),
  getConversation: (id: string) => api<{ conversation: ConversationSummary; messages: ChatMessage[] }>(`/api/chat/${id}`),
  deleteConversation: (id: string) => api<{ ok: boolean }>(`/api/chat/${id}`, { method: "DELETE" }),
  deleteAll: () => api<{ ok: boolean; deleted: number }>("/api/chat", { method: "DELETE" }),
};

export const dashboardApi = {
  stats: () => api<DashboardStats>("/api/dashboard/stats"),
};

export const configApi = {
  get: () => api<PublicConfig>("/api/config"),
};
