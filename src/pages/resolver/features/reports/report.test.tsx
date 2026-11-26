import "@/pages/resolver/test/setup";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReportsResponse } from "@/pages/resolver/api/types";
import { API, http, HttpResponse, server } from "@/pages/resolver/test/server";
import { renderApp } from "@/pages/resolver/test/utils";

const report: ReportsResponse = {
  ready: true,
  status: "reports_ready",
  version: 1,
  released_at: "2026-11-25T10:00:00Z",
  shared: {
    situation_summary: "A loan between friends.",
    what_is_agreed: ["Money changed hands in September."],
    what_is_disputed: ["Whether it was a loan or a gift"],
    paths_to_resolution: ["Mediation"],
    recommended_next_steps: [],
    support_resources: [],
    missing_perspectives: ["Deepu"],
    disclaimer: "General information only.",
  },
  mine: {
    personal_note: "Aravind, thank you for being so open.",
    situation_summary: "You lent money and asked for it back.",
    what_is_agreed: [],
    what_is_disputed: [],
    your_options: [
      {
        title: "Talk it through",
        type: "informal",
        steps: ["Arrange a call"],
        timeframe: "1 week",
        cost: "Free",
        evidence_needed: [],
        pros: ["Quick"],
        cons: [],
      },
    ],
    legal_position: "A loan may be recoverable in small claims.",
    your_actions_and_consequences: [
      {
        what_you_did: "You sent angry messages.",
        possible_consequences: "They may harden positions.",
        how_to_make_it_right: "Apologise for the tone.",
      },
    ],
    emotional_wellbeing: ["Take a break before replying."],
    recommended_next_steps: ["Write down the dates", "Propose mediation"],
    support_resources: [{ name: "Citizens Advice", contact: "citizensadvice.org.uk" }],
    missing_perspectives: [],
    disclaimer: "General information only.",
  },
};

describe("Report page", () => {
  it("shows the personal conclusion, consequences, wellbeing and the shared summary", async () => {
    server.use(http.get(`${API}/cases/CR-AAAA-BBBB/reports/`, () => HttpResponse.json(report)));
    renderApp("/cases/CR-AAAA-BBBB/report");
    expect(await screen.findByText("Aravind, thank you for being so open.")).toBeTruthy();
    expect(screen.getByText("Talk it through")).toBeTruthy();
    expect(screen.getByText("What you did, and what it can lead to")).toBeTruthy();
    expect(screen.getByText("Apologise for the tone.")).toBeTruthy();
    expect(screen.getByText("Take a break before replying.")).toBeTruthy();
    expect(screen.getByText("Whether it was a loan or a gift")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Print or save as PDF" })).toBeTruthy();
  });

  it("explains when the report is not ready", async () => {
    server.use(
      http.get(`${API}/cases/CR-AAAA-BBBB/reports/`, () =>
        HttpResponse.json({ ready: false, status: "analysing", version: null, released_at: null, shared: null, mine: null }),
      ),
    );
    renderApp("/cases/CR-AAAA-BBBB/report");
    expect(await screen.findByText(/report isn.t ready yet/)).toBeTruthy();
  });
});
