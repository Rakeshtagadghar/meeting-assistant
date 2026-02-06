export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  timestamp: string;
}

export function healthcheck(): HealthStatus {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
}
