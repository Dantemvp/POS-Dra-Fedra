import { describe, expect, it } from "vitest";
import { inicioDiaSinaloa, ymdSinaloa } from "./tz";

describe("zona horaria de Sinaloa", () => {
  it("cambia de día a las 07:00 UTC", () => {
    expect(ymdSinaloa("2026-01-01T06:59:59.999Z")).toBe("2025-12-31");
    expect(ymdSinaloa("2026-01-01T07:00:00.000Z")).toBe("2026-01-01");
  });

  it("calcula la medianoche local como un instante UTC exacto", () => {
    expect(inicioDiaSinaloa(new Date("2026-06-28T18:00:00Z")).toISOString()).toBe(
      "2026-06-28T07:00:00.000Z",
    );
  });
});
