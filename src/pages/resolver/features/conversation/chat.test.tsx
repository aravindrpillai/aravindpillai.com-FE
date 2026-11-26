import "@/pages/resolver/test/setup";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessage, ConversationPage, SendMessageResponse } from "@/pages/resolver/api/types";
import { API, http, HttpResponse, server } from "@/pages/resolver/test/server";
import { renderApp } from "@/pages/resolver/test/utils";
import { PartyFormCard } from "./events/PartyFormCard";
import { SummaryApprovalCard } from "./events/SummaryApprovalCard";

const CODE = "CR-AAAA-BBBB";
const opening: ChatMessage = {
  id: "m0",
  sender: "ai",
  content: "Hello Alice. In your own words, what happened?",
  created_at: new Date().toISOString(),
  round: 1,
  client_message_id: null,
  ui_events: [],
  awaiting_reply: false,
};

function page(overrides: Partial<ConversationPage> = {}): ConversationPage {
  return {
    conversation_id: "c1",
    messages: [opening],
    rounds: [{ number: 1, status: "active", reason: "initial", requested_at: null, deadline_at: null }],
    round: { number: 1, status: "active", reason: "initial", requested_at: null, deadline_at: null },
    input_allowed: true,
    input_disabled_reason: null,
    can_complete: false,
    max_message_chars: 8000,
    older_cursor: null,
    pending_events: [],
    ...overrides,
  };
}

function base(p: ConversationPage = page()) {
  server.use(
    http.get(`${API}/cases/${CODE}/conversation/`, () => HttpResponse.json(p)),
    http.get(`${API}/me/`, () =>
      HttpResponse.json({ id: "p1", email: "alice@example.com", display_name: "Alice", phone: "", timezone: "", language: "en", notify_status_updates: true }),
    ),
    http.get(`${API}/cases/${CODE}/`, () => HttpResponse.json({ error: { code: "not_found", message: "", details: {} } }, { status: 404 })),
  );
}

function reply(body: { content: string; client_message_id: string }): SendMessageResponse {
  return {
    user_message: { ...opening, id: "u1", sender: "party", content: body.content, client_message_id: body.client_message_id },
    ai_message: { ...opening, id: "a1", content: "Thank you. When did this happen?" },
    ui_events: [],
    ai_error: null,
  };
}

const type = (text: string) =>
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: text } });

describe("Chat", () => {
  it("sends optimistically and shows the reply", async () => {
    base();
    let resolveSend: () => void = () => undefined;
    server.use(
      http.post(`${API}/cases/${CODE}/conversation/messages/`, async ({ request }) => {
        const body = (await request.json()) as { content: string; client_message_id: string };
        await new Promise<void>((r) => (resolveSend = r));
        return HttpResponse.json(reply(body), { status: 201 });
      }),
    );
    renderApp(`/cases/${CODE}/chat`);
    await screen.findByText(opening.content);
    type("Bob borrowed money");
    fireEvent.keyDown(screen.getByLabelText("Your message"), { key: "Enter" });
    expect(await screen.findByText("Bob borrowed money")).toBeTruthy();
    expect(screen.getAllByText("Sending…").length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Sending…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Your message") as HTMLTextAreaElement).value).toBe("");
    resolveSend();
    expect(await screen.findByText("Thank you. When did this happen?")).toBeTruthy();
  });

  it("keeps a failed message with Retry, reusing the same client id", async () => {
    base();
    const ids: string[] = [];
    let fail = true;
    server.use(
      http.post(`${API}/cases/${CODE}/conversation/messages/`, async ({ request }) => {
        const body = (await request.json()) as { content: string; client_message_id: string };
        ids.push(body.client_message_id);
        if (fail) return HttpResponse.error();
        return HttpResponse.json(reply(body), { status: 201 });
      }),
    );
    renderApp(`/cases/${CODE}/chat`);
    await screen.findByText(opening.content);
    type("Please keep this text");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Not sent")).toBeTruthy();
    expect(screen.getByText("Please keep this text")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(`resolver.pending.${CODE}`) ?? "[]")[0].content).toBe("Please keep this text");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Thank you. When did this happen?")).toBeTruthy();
    expect(ids[0]).toBe(ids[1]);
  });

  it("offers Retry when the AI fails but the message was saved", async () => {
    base();
    let calls = 0;
    server.use(
      http.post(`${API}/cases/${CODE}/conversation/messages/`, async ({ request }) => {
        const body = (await request.json()) as { content: string; client_message_id: string };
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { ...reply(body), ai_message: null, ai_error: "ai_unavailable", ui_events: [{ type: "ai_failed" }] },
            { status: 201 },
          );
        }
        return HttpResponse.json(reply(body), { status: 201 });
      }),
    );
    renderApp(`/cases/${CODE}/chat`);
    await screen.findByText(opening.content);
    type("hello");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("I'm having trouble responding right now.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Thank you. When did this happen?")).toBeTruthy();
  });

  it("restores a saved draft", async () => {
    localStorage.setItem(`resolver.draft.${CODE}`, "half-written thought");
    base();
    renderApp(`/cases/${CODE}/chat`);
    await screen.findByText(opening.content);
    expect((screen.getByLabelText("Your message") as HTMLTextAreaElement).value).toBe("half-written thought");
  });

  it("rejects empty messages on the client", async () => {
    base();
    renderApp(`/cases/${CODE}/chat`);
    await screen.findByText(opening.content);
    type("   ");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Please write something first.")).toBeTruthy();
  });

  it("replaces the composer with an explanation when input is closed", async () => {
    base(page({ input_allowed: false, input_disabled_reason: "round_complete" }));
    renderApp(`/cases/${CODE}/chat`);
    expect(
      await screen.findByText("Thanks, you've shared everything for now. We'll email you if we need anything else."),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Your message")).toBeNull();
  });

  it("shows the consent card from pending events and posts the answer", async () => {
    base(page({ pending_events: [{ type: "consent_request" }] }));
    let answer: unknown = null;
    server.use(
      http.post(`${API}/cases/${CODE}/consent/`, async ({ request }) => {
        answer = await request.json();
        return HttpResponse.json(page());
      }),
    );
    renderApp(`/cases/${CODE}/chat`);
    fireEvent.click(await screen.findByRole("button", { name: "Yes, contact them" }));
    await waitFor(() => expect(answer).toEqual({ consent: true }));
  });

  it("shows the safety notice once, as one line, and not dismissible when risk is high", async () => {
    const emergency = {
      type: "emergency_resources" as const,
      dismissible: false,
      resources: [{ name: "Emergency services", contact: "999" }, { name: "Samaritans", contact: "116 123" }],
    };
    base(page({
      pending_events: [emergency],
      messages: [opening, { ...opening, id: "m1", content: "Are you safe right now?", ui_events: [emergency] }],
    }));
    renderApp(`/cases/${CODE}/chat`);
    await screen.findByText("Are you safe right now?");
    const lines = screen.getAllByRole("alert").filter((el) => el.classList.contains("safety-line"));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.textContent).toMatch(/In danger\? Call now\..*999/);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("never shows a message twice after a reload (restored unsent items the server already has)", async () => {
    const saved = { ...opening, id: "u9", sender: "party" as const, content: "I already sent this", client_message_id: "cid-9" };
    localStorage.setItem(
      `resolver.pending.${CODE}`,
      JSON.stringify([{ clientId: "cid-9", content: "I already sent this", status: "failed", createdAt: new Date().toISOString() }]),
    );
    base(page({ messages: [opening, saved, { ...opening, id: "a9", content: "Thanks for that." }] }));
    renderApp(`/cases/${CODE}/chat`);
    await screen.findByText("Thanks for that.");
    expect(screen.getAllByText("I already sent this")).toHaveLength(1);
    expect(screen.queryByText("Not sent")).toBeNull();
  });
});

describe("Party form card", () => {
  it("validates email, rejects own email and duplicates", () => {
    let confirmed: unknown = null;
    render(<PartyFormCard initial={[]} ownEmail="alice@example.com" busy={false} onConfirm={(p) => (confirmed = p)} />);
    const fill = (name: string, email: string) => {
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
      fireEvent.click(screen.getByRole("button", { name: "Add this person" }));
    };
    fill("Bob", "not-an-email");
    expect(screen.getByText("Please enter a valid email address.")).toBeTruthy();
    fill("Me", "Alice@Example.com");
    expect(screen.getByText("That's your own email. Add the other people involved.")).toBeTruthy();
    fill("Bob", "bob@example.com");
    fill("Bob again", "BOB@example.com ");
    expect(screen.getByText("You've already added this email.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "That's everyone" }));
    expect(confirmed).toEqual([{ name: "Bob", email: "bob@example.com", phone: "", role: "respondent", relationship: "" }]);
  });
});

describe("Summary approval card", () => {
  it("counts words and blocks approval over the limit", () => {
    let approved = "";
    render(<SummaryApprovalCard summary="A short neutral summary." maxWords={5} busy={false} onApprove={(s) => (approved = s)} />);
    expect(screen.getByText("4 of 5 words")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "one two three four five six" } });
    expect(screen.getByText("6 of 5 words")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve and send invites" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "one two three" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve and send invites" }));
    expect(approved).toBe("one two three");
  });
});
