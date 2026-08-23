import { describe, expect, it } from "vitest";
import { estadoPush, mensajePush } from "./push-resultado";
import type { PushResultado } from "./push";

const base: PushResultado = {
  configurado: true,
  destinatarios: 2,
  enviadas: 2,
  expiradas: 0,
  fallidas: 0,
};

describe("resultado de notificaciones push", () => {
  it("distingue éxito, resultado parcial y fallo", () => {
    expect(estadoPush(base)).toBe("ok");
    expect(estadoPush({ ...base, enviadas: 1, fallidas: 1 })).toBe("parcial");
    expect(estadoPush({ ...base, enviadas: 0, fallidas: 2 })).toBe("fallo");
  });

  it("explica configuración y destinatarios ausentes", () => {
    expect(mensajePush({ ...base, configurado: false, enviadas: 0, motivo: "sin_configuracion" }))
      .toContain("no están configuradas");
    expect(mensajePush({ ...base, destinatarios: 0, enviadas: 0, motivo: "sin_destinatarios" }))
      .toContain("No hay dispositivos");
  });

  it("reporta envíos parciales sin afirmar éxito completo", () => {
    expect(mensajePush({ ...base, enviadas: 1, fallidas: 1, motivo: "fallos_envio" }))
      .toBe("Se enviaron 1 de 2 notificaciones.");
  });

  it("explica c�mo recuperar una suscripci�n caducada", () => {
    expect(
      mensajePush({
        ...base,
        destinatarios: 1,
        enviadas: 0,
        expiradas: 1,
        fallidas: 0,
        motivo: "fallos_envio",
      }),
    ).toBe(
      "La suscripci�n de este dispositivo caduc�. Desactiva y vuelve a activar las notificaciones.",
    );
  });
});
