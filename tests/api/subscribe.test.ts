import { describe, it, expect, vi, beforeEach } from "vitest";

const contactsCreateMock = vi.fn();

vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      contacts: { create: contactsCreateMock },
    })),
  };
});

describe("/api/subscribe route handler", () => {
  beforeEach(() => {
    contactsCreateMock.mockReset();
    process.env.RESEND_API_KEY = "test-key";
    delete process.env.RESEND_AUDIENCE_ID;
    vi.resetModules();
  });

  async function callRoute(body: Record<string, unknown>) {
    const { POST } = await import("@/app/api/subscribe/route");
    return POST(
      new Request("http://localhost/api/subscribe", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      })
    );
  }

  it("rejects invalid email", async () => {
    const res = await callRoute({ email: "not-an-email", locale: "en" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("invalid_email");
    expect(contactsCreateMock).not.toHaveBeenCalled();
  });

  it("returns pending_confirmation on success", async () => {
    contactsCreateMock.mockResolvedValue({ data: { id: "c_123" }, error: null });
    const res = await callRoute({ email: "user@example.com", locale: "en" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending_confirmation");
    expect(contactsCreateMock).toHaveBeenCalledWith({
      email: "user@example.com",
      unsubscribed: false,
    });
  });

  it("returns already_subscribed when Resend reports duplicate", async () => {
    contactsCreateMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Contact already exists." },
    });
    const res = await callRoute({ email: "user@example.com", locale: "en" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("already_subscribed");
  });

  it("returns error on unexpected failure", async () => {
    contactsCreateMock.mockRejectedValue(new Error("boom"));
    const res = await callRoute({ email: "user@example.com", locale: "en" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe("error");
  });
});
