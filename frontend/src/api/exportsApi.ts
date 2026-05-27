export const API_BASE_URL = "http://127.0.0.1:8000";

export type ExcelFillWrite = {
  cellAddress: string;
  value: number;
  studentId?: number | null;
  studentName?: string | null;
  birthday?: string | null;
  reason?: string | null;
};

export type ExcelFillOptions = {
  preserveTemplate?: boolean;
};

export type ExcelFillTemplatePayload = {
  worksheetName: string;
  month: string;
  writes: ExcelFillWrite[];
  options?: ExcelFillOptions;
};

export async function fillExcelTemplate(
  file: Blob | File,
  payload: ExcelFillTemplatePayload
): Promise<Blob> {
  const formData = new FormData();
  if (file instanceof File) {
    formData.append("file", file);
  } else {
    formData.append("file", file, "template.xlsx");
  }
  formData.append("payload", JSON.stringify(payload));

  const response = await fetch(`${API_BASE_URL}/api/exports/excel/fill-template`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to fill Excel template: ${response.status}`);
  }

  return response.blob();
}
