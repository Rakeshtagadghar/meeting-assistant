export { healthcheck } from "./healthcheck";
export type { HealthStatus } from "./healthcheck";

export type {
  CreateNoteRequest,
  CreateNoteResponse,
  ListNotesQuery,
  ListNotesResponse,
  GetNoteResponse,
  UpdateNoteRequest,
  OkResponse,
  GenerateMode,
  GenerateRequest,
  GenerateResponse,
  JobStatusResponse,
  CancelJobResponse,
  ExportRequest,
  ExportResponse,
  JobProgressEvent,
  JobDoneEvent,
  CreateShareLinkRequest,
  CreateShareLinkResponse,
  GetSharedNoteResponse,
  IntegrationConnection,
  ListIntegrationsResponse,
  DisconnectIntegrationRequest,
  DisconnectIntegrationResponse,
  ExportIntegrationRequest,
  ExportIntegrationResponse,
  StreamSummarizeRequest,
  StreamTokenEvent,
  StreamDoneEvent,
  StreamErrorEvent,
  ApiErrorResponse,
} from "./contracts";

export { createApiClient } from "./client";
export type { ApiClient, ApiClientConfig } from "./client";
