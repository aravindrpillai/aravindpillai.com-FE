import "@/pages/resolver/test/setup";
import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API, http, HttpResponse, server } from "@/pages/resolver/test/server";
import { renderApp } from "@/pages/resolver/test/utils";

describe("App shell", () => {
  it("shows an offline banner while offline", async () => {
    server.use(http.get(`${API}/cases/`, () => HttpResponse.json({ results: [], next_cursor: null })));
    renderApp("/");
    await screen.findByText("No cases yet");
    expect(screen.queryByText(/You're offline/)).toBeNull();
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/You're offline/)).toBeTruthy();
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/You're offline/)).toBeNull();
    if (original) Object.defineProperty(navigator, "onLine", original);
  });

  it("has a skip link and a main landmark", async () => {
    server.use(http.get(`${API}/cases/`, () => HttpResponse.json({ results: [], next_cursor: null })));
    renderApp("/");
    await screen.findByText("No cases yet");
    expect(screen.getByText("Skip to main content").getAttribute("href")).toBe("#main");
    expect(screen.getByRole("main")).toBeTruthy();
  });
});
