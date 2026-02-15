import type {
  CreateNoteRequest,
  CreateNoteResponse,
  ListNotesQuery,
  ListNotesResponse,
  GetNoteResponse,
  UpdateNoteRequest,
  OkResponse,
  GenerateRequest,
  GenerateResponse,
  JobStatusResponse,
  CancelJobResponse,
  ExportRequest,
  ExportResponse,
  CreateShareLinkRequest,
  CreateShareLinkResponse,
  GetSharedNoteResponse,
  ListIntegrationsResponse,
  DisconnectIntegrationRequest,
  DisconnectIntegrationResponse,
  ExportIntegrationRequest,
  ExportIntegrationResponse,
  CreateMeetingSessionRequest,
  MeetingSessionResponse,
  MeetingSessionWithChunksResponse,
  UpdateMeetingSessionRequest,
  ConfirmConsentRequest,
  SaveChunksRequest,
  SaveChunksResponse,
  GetChunksQuery,
  GetChunksResponse,
  ApiErrorResponse,
} from "../contracts";

// ─── Config & Public Interface ───

export interface ApiClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

export interface ApiClient {
  notes: {
    create(body: CreateNoteRequest): Promise<CreateNoteResponse>;
    list(query?: ListNotesQuery): Promise<ListNotesResponse>;
    get(id: string): Promise<GetNoteResponse>;
    update(id: string, body: UpdateNoteRequest): Promise<OkResponse>;
    delete(id: string): Promise<OkResponse>;
  };
  ai: {
    generate(body: GenerateRequest): Promise<GenerateResponse>;
  };
  jobs: {
    getStatus(jobId: string): Promise<JobStatusResponse>;
    cancel(jobId: string): Promise<CancelJobResponse>;
  };
  exports: {
    pdf(body: ExportRequest): Promise<ExportResponse>;
    docx(body: ExportRequest): Promise<ExportResponse>;
  };
  share: {
    createLink(body: CreateShareLinkRequest): Promise<CreateShareLinkResponse>;
    getShared(token: string): Promise<GetSharedNoteResponse>;
  };
  integrations: {
    list(): Promise<ListIntegrationsResponse>;
    disconnect(
      body: DisconnectIntegrationRequest,
    ): Promise<DisconnectIntegrationResponse>;
    exportSummary(
      body: ExportIntegrationRequest,
    ): Promise<ExportIntegrationResponse>;
  };
  meetings: {
    create(body: CreateMeetingSessionRequest): Promise<MeetingSessionResponse>;
    get(sessionId: string): Promise<MeetingSessionWithChunksResponse>;
    update(
      sessionId: string,
      body: UpdateMeetingSessionRequest,
    ): Promise<MeetingSessionResponse>;
    confirmConsent(
      sessionId: string,
      body: ConfirmConsentRequest,
    ): Promise<MeetingSessionResponse>;
    stop(sessionId: string): Promise<MeetingSessionResponse>;
    saveChunks(
      sessionId: string,
      body: SaveChunksRequest,
    ): Promise<SaveChunksResponse>;
    getChunks(
      sessionId: string,
      query?: GetChunksQuery,
    ): Promise<GetChunksResponse>;
  };
}

// ─── Helpers ───

type ParamValue = string | boolean | undefined;

interface RequestOptions {
  body?: unknown;
  params?: Record<string, ParamValue>;
}

function buildQueryString(params: Record<string, ParamValue>): string {
  const entries = Object.entries(params).filter(
    (pair): pair is [string, string | boolean] => pair[1] !== undefined,
  );

  if (entries.length === 0) return "";

  const tuples: [string, string][] = entries.map(([key, value]) => [
    key,
    String(value),
  ]);
  const search = new URLSearchParams(tuples);
  return `?${search.toString()}`;
}

async function request<T>(
  baseUrl: string,
  headers: Record<string, string>,
  method: string,
  path: string,
  options?: RequestOptions,
): Promise<T> {
  const queryString = options?.params ? buildQueryString(options.params) : "";

  const url = `${baseUrl}${path}${queryString}`;

  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (options?.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const errorBody = (await response.json()) as ApiErrorResponse;
    throw new Error(errorBody.error.message);
  }

  return (await response.json()) as T;
}

// ─── Factory ───

export function createApiClient(config: ApiClientConfig): ApiClient {
  const { baseUrl } = config;
  const headers = config.headers ?? {};

  const req = <T>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<T> => request<T>(baseUrl, headers, method, path, options);

  return {
    notes: {
      create: (body) => req<CreateNoteResponse>("POST", "/api/notes", { body }),

      list: (query) =>
        req<ListNotesResponse>("GET", "/api/notes", {
          params: query as Record<string, ParamValue>,
        }),

      get: (id) => req<GetNoteResponse>("GET", `/api/notes/${id}`),

      update: (id, body) =>
        req<OkResponse>("PATCH", `/api/notes/${id}`, { body }),

      delete: (id) => req<OkResponse>("DELETE", `/api/notes/${id}`),
    },

    ai: {
      generate: (body) =>
        req<GenerateResponse>("POST", "/api/ai/generate", { body }),
    },

    jobs: {
      getStatus: (jobId) => req<JobStatusResponse>("GET", `/api/jobs/${jobId}`),

      cancel: (jobId) =>
        req<CancelJobResponse>("POST", `/api/jobs/${jobId}/cancel`),
    },

    exports: {
      pdf: (body) => req<ExportResponse>("POST", "/api/exports/pdf", { body }),

      docx: (body) =>
        req<ExportResponse>("POST", "/api/exports/docx", { body }),
    },

    share: {
      createLink: (body) =>
        req<CreateShareLinkResponse>("POST", "/api/share-links", { body }),

      getShared: (token) =>
        req<GetSharedNoteResponse>("GET", `/api/shared/${token}`),
    },

    integrations: {
      list: () => req<ListIntegrationsResponse>("GET", "/api/integrations"),

      disconnect: (body) =>
        req<DisconnectIntegrationResponse>("DELETE", "/api/integrations", {
          body,
        }),

      exportSummary: (body) =>
        req<ExportIntegrationResponse>("POST", "/api/integrations/export", {
          body,
        }),
    },

    meetings: {
      create: (body) =>
        req<MeetingSessionResponse>("POST", "/api/meetings", { body }),

      get: (sessionId) =>
        req<MeetingSessionWithChunksResponse>(
          "GET",
          `/api/meetings/${sessionId}`,
        ),

      update: (sessionId, body) =>
        req<MeetingSessionResponse>("PATCH", `/api/meetings/${sessionId}`, {
          body,
        }),

      confirmConsent: (sessionId, body) =>
        req<MeetingSessionResponse>(
          "POST",
          `/api/meetings/${sessionId}/consent`,
          { body },
        ),

      stop: (sessionId) =>
        req<MeetingSessionResponse>("POST", `/api/meetings/${sessionId}/stop`),

      saveChunks: (sessionId, body) =>
        req<SaveChunksResponse>("POST", `/api/meetings/${sessionId}/chunks`, {
          body,
        }),

      getChunks: (sessionId, query) =>
        req<GetChunksResponse>("GET", `/api/meetings/${sessionId}/chunks`, {
          params: query as unknown as Record<string, ParamValue>,
        }),
    },
  };
}
