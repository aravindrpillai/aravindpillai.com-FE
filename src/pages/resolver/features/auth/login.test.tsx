import "@/pages/resolver/test/setup";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API, http, HttpResponse, server } from "@/pages/resolver/test/server";
import { renderApp } from "@/pages/resolver/test/utils";

const otpConfig = () =>
  http.get(`${API}/auth/config/`, () =>
    HttpResponse.json({ mode: "email_otp", development_mode: false, code_length: 4 }),
  );

describe("Sign in with an emailed code", () => {
  it("shows four boxes and fills in the code in development", async () => {
    let verified: unknown = null;
    server.use(
      otpConfig(),
      http.post(`${API}/auth/login/`, () =>
        HttpResponse.json({
          mode: "email_otp",
          development_mode: false,
          code_length: 4,
          code_sent: true,
          message: "sent",
          dev_code: "4821",
        }),
      ),
      http.post(`${API}/auth/verify/`, async ({ request }) => {
        verified = await request.json();
        return HttpResponse.json({ token: "t-otp", expires_at: "x" });
      }),
      http.get(`${API}/cases/`, () => HttpResponse.json({ results: [], next_cursor: null })),
    );
    renderApp("/", { signedIn: false });
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "a@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Development mode: the code was filled in for you.")).toBeTruthy();
    const boxes = screen.getAllByLabelText(/Sign-in code digit/);
    expect(boxes).toHaveLength(4);
    expect(boxes.map((b) => (b as HTMLInputElement).value).join("")).toBe("4821");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(verified).toEqual({ email: "a@example.com", code: "4821" }));
    expect(await screen.findByText("No cases yet")).toBeTruthy();
  });

  it("accepts a pasted code and keeps the button disabled until complete", async () => {
    server.use(
      otpConfig(),
      http.post(`${API}/auth/login/`, () =>
        HttpResponse.json({ mode: "email_otp", development_mode: false, code_length: 4, code_sent: true, message: "sent" }),
      ),
    );
    renderApp("/", { signedIn: false });
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "a@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const boxes = await screen.findAllByLabelText(/Sign-in code digit/);
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.paste(boxes[0]!, { clipboardData: { getData: () => "12 34" } });
    expect(boxes.map((b) => (b as HTMLInputElement).value).join("")).toBe("1234");
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
