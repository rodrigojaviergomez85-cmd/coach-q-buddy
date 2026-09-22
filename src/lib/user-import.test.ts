import { describe, expect, it } from "vitest";

import { normalizeRole, parseUsersCsv, isValidEmail } from "./user-import";

describe("parseUsersCsv", () => {
  it("parses a valid file", () => {
    const { rows, errors } = parseUsersCsv(
      "\uFEFFname,email,role\nEmanuel Ramirez,Emanuel@e4k.com,senior\nCarlos Lopez,carlos@e4k.com,coordinator\n",
    );
    expect(errors).toHaveLength(0);
    expect(rows).toEqual([
      { name: "Emanuel Ramirez", email: "emanuel@e4k.com", role: "senior" },
      { name: "Carlos Lopez", email: "carlos@e4k.com", role: "coordinador" },
    ]);
  });

  it("reports invalid email, bad role and duplicates", () => {
    const { rows, errors } = parseUsersCsv(
      "name,email,role\nA,no-email,coach\nB,b@e4k.com,jefe\nC,c@e4k.com,qa\nD,c@e4k.com,coach\n",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.role).toBe("qa");
    expect(errors).toHaveLength(3);
  });

  it("maps role aliases", () => {
    expect(normalizeRole(" Coordinator ")).toBe("coordinador");
    expect(normalizeRole("QA")).toBe("qa");
    expect(normalizeRole("otro")).toBeNull();
    expect(isValidEmail("a@b.co")).toBe(true);
  });
});
