import { request } from "../client";
import type { AuthConfig, LoginResponse, MagicResponse, Me, TokenResponse } from "../types";

export const authApi = {
  config: () => request<AuthConfig>("/auth/config/"),
  login: (email: string, caseCode = "") =>
    request<LoginResponse>("/auth/login/", { method: "POST", body: { email, case_code: caseCode } }),
  verify: (email: string, code: string) =>
    request<TokenResponse>("/auth/verify/", { method: "POST", body: { email, code } }),
  magic: (token: string) => request<MagicResponse>("/auth/magic/", { method: "POST", body: { token } }),
  resendMagic: (token: string) =>
    request<{ message: string }>("/auth/magic/resend/", { method: "POST", body: { token } }),
  logout: (all: boolean) => request<{ revoked: number }>("/auth/logout/", { method: "POST", body: { all } }),
  me: () => request<Me>("/me/"),
  updateMe: (changes: Partial<Omit<Me, "id" | "email">>) =>
    request<Me>("/me/", { method: "PATCH", body: changes }),
};
