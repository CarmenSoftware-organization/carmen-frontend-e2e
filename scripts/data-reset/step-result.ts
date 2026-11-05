// scripts/data-reset/step-result.ts
export interface StepResult {
  step: string;
  created: number;
  skipped: number;
  failed: string[];
}

/** List rows of a standard `{ data: [...] }` envelope. / แถวจาก envelope มาตรฐาน */
export function rowsOf<T>(body: unknown): T[] {
  const data = (body as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}
