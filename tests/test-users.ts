export const TEST_USERS = [
  { role: "Requestor", email: "carmensoftware.dev+requestor@gmail.com", password: "12345678" },
  { role: "HOD", email: "carmensoftware.dev+hod@gmail.com", password: "12345678" },
  { role: "Purchase", email: "carmensoftware.dev+purchase@gmail.com", password: "12345678" },
  { role: "FC", email: "carmensoftware.dev+fc@gmail.com", password: "12345678" },
  { role: "GM", email: "carmensoftware.dev+gm@gmail.com", password: "12345678" },
  { role: "Owner", email: "carmensoftware.dev+owner@gmail.com", password: "12345678" },
  { role: "StoreManager", email: "carmensoftware.dev+storemanager@gmail.com", password: "12345678" },
  { role: "Budget", email: "carmensoftware.dev+budget@gmail.com", password: "12345678" },
  { role: "Admin", email: "carmensoftware.dev+admin@gmail.com", password: "12345678" },
] as const;

/** Default password used by most test users — kept for backward compatibility. */
export const TEST_PASSWORD = "12345678";

/** Look up the password for a given test user email. */
export function getPasswordFor(email: string): string {
  return TEST_USERS.find((u) => u.email === email)?.password ?? TEST_PASSWORD;
}
export const BU_CODE = "BU-GR2VYNKQ";
