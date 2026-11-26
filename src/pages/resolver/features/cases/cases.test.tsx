import "@/pages/resolver/test/setup";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CaseDetail, CaseListItem } from "@/pages/resolver/api/types";
import { nextInterval } from "@/pages/resolver/hooks/usePolling";
import { API, http, HttpResponse, server } from "@/pages/resolver/test/server";
import { renderApp } from "@/pages/resolver/test/utils";
import { STATUS_TONE, StatusChip } from "./StatusChip";

const item: CaseListItem = {
  code: "CR-7K4P-9XQ2",
  summary: "A disagreement about a loan between friends.",
  my_role: "reporter",
  case_status: "gathering",
  my_status: "in_progress",
  action_needed: "wait",
  updated_at: new Date().toISOString(),
};

describe("My cases", () => {
  it("shows a skeleton then a friendly empty state with a start button", async () => {
    server.use(http.get(`${API}/cases/`, () => HttpResponse.json({ results: [], next_cursor: null })));
    renderApp("/");
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(await screen.findByText("No cases yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start a new case" })).toBeTruthy();
  });

  it("lists cases with status and summary", async () => {
    server.use(http.get(`${API}/cases/`, () => HttpResponse.json({ results: [item], next_cursor: null })));
    renderApp("/");
    expect(await screen.findByText(item.summary)).toBeTruthy();
    expect(screen.getByText("Hearing from others")).toBeTruthy();
    expect(screen.getByText("CR-7K4P-9XQ2")).toBeTruthy();
  });

  it("maps errors to friendly text with a retry", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/cases/`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: "internal_error", message: "boom", details: {} } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ results: [item], next_cursor: null });
      }),
    );
    renderApp("/");
    expect(await screen.findByText("Something went wrong on our side. Please try again.")).toBeTruthy();
    expect(screen.queryByText(/boom/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(item.summary)).toBeTruthy();
  });

  it("redirects to login when signed out, and signs in (email_only)", async () => {
    server.use(
      http.post(`${API}/auth/login/`, () =>
        HttpResponse.json({ mode: "email_only", development_mode: true, code_sent: false, message: "", token: "t1", expires_at: "x" }),
      ),
      http.get(`${API}/cases/`, () => HttpResponse.json({ results: [], next_cursor: null })),
    );
    renderApp("/", { signedIn: false });
    expect(await screen.findByRole("heading", { name: "Sign in to Resolver" })).toBeTruthy();
    expect(await screen.findByText("Development mode: sign-in is not verified")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "a@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("No cases yet")).toBeTruthy();
    expect(localStorage.getItem("resolver.token")).toBe("t1");
  });

  it("returns to the same screen after the session expires", async () => {
    server.use(
      http.get(`${API}/cases/CR-AAAA-BBBB/`, () =>
        HttpResponse.json({ error: { code: "not_authenticated", message: "", details: {} } }, { status: 401 }),
      ),
    );
    const { location } = renderApp("/cases/CR-AAAA-BBBB");
    expect(await screen.findByText("Your session ended. Please sign in again; your draft has been kept.")).toBeTruthy();
    expect(location().pathname).toBe("/resolver/login");
    expect(new URLSearchParams(location().search).get("next")).toBe("/resolver/cases/CR-AAAA-BBBB");
  });
});

describe("Case dashboard", () => {
  const detail: CaseDetail = {
    code: "CR-AAAA-BBBB",
    summary: "A loan between friends.",
    status: "gathering",
    progress_step: "others",
    risk_high: false,
    parties: [
      { id: "1", display_name: "Alice", role: "reporter", status: "info_gathered", status_label: "Info gathered", eta: null, is_me: true, can_fix_email: false, can_withdraw: false },
      { id: "2", display_name: "Invited party 2", role: "respondent", status: "invited", status_label: "Waiting for response", eta: "2026-11-30T12:00:00Z", is_me: false, can_fix_email: false, can_withdraw: true },
      { id: "3", display_name: "Cara", role: "witness", status: "bounced", status_label: "Email couldn't be delivered", eta: null, is_me: false, can_fix_email: true, can_withdraw: true },
    ],
    my_party: { id: "1", display_name: "Alice", role: "reporter", status: "info_gathered", status_label: "Info gathered", eta: null, is_me: true, can_fix_email: false, can_withdraw: false },
    my_action: "fix_email",
    can_proceed: false,
    proceed_available_at: "2026-12-01T09:00:00Z",
    can_close: true,
    others_involved: false,
    single_perspective: false,
    updated_at: "2026-11-25T09:00:00Z",
  };

  it("shows parties, statuses with text labels, ETAs and the stepper", async () => {
    server.use(http.get(`${API}/cases/CR-AAAA-BBBB/`, () => HttpResponse.json(detail)));
    renderApp("/cases/CR-AAAA-BBBB");
    expect(await screen.findByText("Waiting for response")).toBeTruthy();
    expect(screen.getByText("Email couldn't be delivered")).toBeTruthy();
    expect(screen.getByText(/by Mon 30 Nov/)).toBeTruthy();
    expect(screen.getByText("Hearing from others", { selector: "li *" }).closest("li")!.getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("button", { name: "Fix email" })).toBeTruthy();
    expect(screen.getByText("What happens next?")).toBeTruthy();
  });

  it("confirms before closing", async () => {
    let closed = false;
    server.use(
      http.get(`${API}/cases/CR-AAAA-BBBB/`, () => HttpResponse.json(detail)),
      http.post(`${API}/cases/CR-AAAA-BBBB/close/`, () => {
        closed = true;
        return HttpResponse.json({ ...detail, status: "closed", can_close: false });
      }),
    );
    renderApp("/cases/CR-AAAA-BBBB");
    fireEvent.click(await screen.findByRole("button", { name: "Close this case" }));
    expect(closed).toBe(false);
    expect(screen.getByText("Close this case?")).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Close this case" });
    await act(async () => fireEvent.click(buttons[buttons.length - 1]!));
    await waitFor(() => expect(closed).toBe(true));
  });
});

describe("Status chips", () => {
  it("use the specified colour groups and always show text", () => {
    expect(STATUS_TONE.not_invited).toBe("grey");
    expect(STATUS_TONE.expired).toBe("grey");
    expect(STATUS_TONE.withdrawn).toBe("grey");
    expect(STATUS_TONE.invited).toBe("blue");
    expect(STATUS_TONE.in_progress).toBe("blue");
    expect(STATUS_TONE.follow_up_requested).toBe("amber");
    expect(STATUS_TONE.bounced).toBe("amber");
    expect(STATUS_TONE.info_gathered).toBe("green");
    expect(STATUS_TONE.declined).toBe("red");
    render(<StatusChip status="declined" />);
    expect(screen.getByText("Declined")).toBeTruthy();
  });
});

describe("Polling backoff", () => {
  it("backs off to 60 s after 5 unchanged responses", () => {
    expect(nextInterval(15_000, 0)).toBe(15_000);
    expect(nextInterval(15_000, 4)).toBe(15_000);
    expect(nextInterval(15_000, 5)).toBe(60_000);
  });
});
