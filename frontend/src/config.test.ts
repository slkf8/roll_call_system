import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});


describe("config API_BASE_URL", () => {
  it("falls back to http://127.0.0.1:8000 when VITE_API_BASE_URL is empty", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const { API_BASE_URL } = await import("./config");
    expect(API_BASE_URL).toBe("http://127.0.0.1:8000");
  });

  it("uses VITE_API_BASE_URL when provided", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://staging.example.com");
    const { API_BASE_URL } = await import("./config");
    expect(API_BASE_URL).toBe("https://staging.example.com");
  });

  it("falls back to empty string in production when VITE_API_BASE_URL is empty", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    const { API_BASE_URL } = await import("./config");
    expect(API_BASE_URL).toBe("");
  });

  it("uses VITE_API_BASE_URL in production when provided", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://prod.example.com");
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    const { API_BASE_URL } = await import("./config");
    expect(API_BASE_URL).toBe("https://prod.example.com");
  });

  it("treats whitespace-only VITE_API_BASE_URL as unset (uses dev fallback)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "   ");
    const { API_BASE_URL } = await import("./config");
    expect(API_BASE_URL).toBe("http://127.0.0.1:8000");
  });
});
