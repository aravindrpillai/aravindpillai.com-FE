import { request } from "../client";
import type { ReportsResponse } from "../types";

export const reportsApi = {
  get: (code: string) => request<ReportsResponse>(`/cases/${encodeURIComponent(code)}/reports/`),
};
