import { describe, it, expect, vi, beforeEach } from "vitest";

const contactsCreateMock = vi.fn();
const emailsSendMock = vi.fn();

vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      contacts: { create: contactsCreateMock },
      emails: { send: emailsSendMock },
    })),
  };
});

describe("/api/subscribe route handler", () => {
  beforeEach(() => {
    contactsCreateMock.mockReset();
    emailsSendMock.mockReset();
    // Default: welcome email succeeds. Tests that care about failure override this.
    emailsSendMock.mockResolvedValue({ data: { id: "e_xyz" }, error: null });
    process.env.RESEND_API_KEY = "test-key";
    delete process.env.RESEND_AUDIENCE_ID;
    delete process.env.RESEND_FROM;
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

  it("returns pending_confirmation on success and sends welcome email", async () => {
    contactsCreateMock.mockResolvedValue({ data: { id: "c_123" }, error: null });
    const res = await callRoute({ email: "user@example.com", locale: "en" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending_confirmation");
    expect(contactsCreateMock).toHaveBeenCalledWith({
      email: "user@example.com",
      unsubscribed: false,
    });
    expect(emailsSendMock).toHaveBeenCalledTimes(1);
    const sendArgs = emailsSendMock.mock.calls[0][0];
    expect(sendArgs.to).toBe("user@example.com");
    expect(sendArgs.subject).toMatch(/Welcome to LiveMakers/);
    expect(sendArgs.text).toContain("livemakers.com");
  });

  it("sends a Japanese welcome email when locale=ja", async () => {
    contactsCreateMock.mockResolvedValue({ data: { id: "c_456" }, error: null });
    const res = await callRoute({ email: "tabira@example.jp", locale: "ja" });
    expect(res.status).toBe(200);
    expect(emailsSendMock).toHaveBeenCalledTimes(1);
    const sendArgs = emailsSendMock.mock.calls[0][0];
    expect(sendArgs.subject).toContain("購読登録");
    expect(sendArgs.text).toContain("毎週金曜");
  });

  it("still returns success when welcome email send fails", async () => {
    contactsCreateMock.mockResolvedValue({ data: { id: "c_789" }, error: null });
    emailsSendMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "domain not verified" },
    });
    const res = await callRoute({ email: "user@example.com", locale: "en" });
    expect(res.status).toBe(200);
    const body = await res.json();
    // Subscription succeeds even if the welcome email cannot be delivered.
    expect(body.status).toBe("pending_confirmation");
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
