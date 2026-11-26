import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { API_BASE } from "@/pages/resolver/api/client";

export const API = API_BASE;

export const server = setupServer(
  http.get(`${API}/auth/config/`, () => HttpResponse.json({ mode: "email_only", development_mode: true })),
);

export { http, HttpResponse };
