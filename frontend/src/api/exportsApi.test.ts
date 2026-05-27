import { afterEach, describe, expect, it, vi } from "vitest";
import { fillExcelTemplate } from "./exportsApi";
import type { ExcelFillTemplatePayload } from "./exportsApi";


const payload: ExcelFillTemplatePayload = {
  worksheetName: "Sheet1",
  month: "2026-06",
  writes: [
    {
      cellAddress: "AC6",
      value: 4,
      studentId: 1,
      studentName: "陳小明",
      birthday: "2012-03-08",
      reason: "direct_service_count",
    },
  ],
  options: {
    preserveTemplate: true,
  },
};


afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});


describe("exportsApi", () => {
  it("fills an Excel template successfully", async () => {
    const responseBlob = new Blob(["xlsx"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => responseBlob,
      }))
    );

    await expect(fillExcelTemplate(new Blob(["template"]), payload)).resolves.toBe(responseBlob);
  });

  it("uses multipart FormData with a JSON payload", async () => {
    const responseBlob = new Blob(["xlsx"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => responseBlob,
      }))
    );

    await fillExcelTemplate(new Blob(["template"]), payload);

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/exports/excel/fill-template",
      expect.objectContaining({
        method: "POST",
      })
    );
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    const formData = init.body as FormData;
    expect(formData.get("payload")).toBe(JSON.stringify(payload));
    expect(formData.get("file")).toBeInstanceOf(Blob);
  });

  it("throws on non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        blob: async () => new Blob(),
      }))
    );

    await expect(fillExcelTemplate(new Blob(["template"]), payload)).rejects.toThrow(
      "Failed to fill Excel template"
    );
  });

  it("returns the response blob", async () => {
    const responseBlob = new Blob(["backend-filled"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => responseBlob,
      }))
    );

    const result = await fillExcelTemplate(new Blob(["template"]), payload);

    expect(result).toBe(responseBlob);
  });
});
