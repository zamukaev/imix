/** Response of `GET /health`. */
export type HealthResponse = {
  status: 'ok' | 'degraded';
  service: string;
  uptime: number;
  database: 'up' | 'down';
};
