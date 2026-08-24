import { beforeAll, describe, expect, it } from "vitest";
import { clienteAnonimo, filasVisibles, sesion, type Rol } from "./helpers.mjs";
import type { SupabaseClient } from "@supabase/supabase-js";

const clientes = {} as Record<Rol, SupabaseClient>;

beforeAll(async () => {
  for (const rol of ["admin", "doctora", "farmacia", "asistente", "gerente"] as const) {
    clientes[rol] = await sesion(rol);
  }
}, 60_000);

describe("la semilla está puesta", () => {
  it("existe un perfil por rol y cada uno tiene identidad", async () => {
    const { data, error } = await clientes.admin
      .from("usuarios")
      .select("email, rol, auth_uid, activo")
      .in("email", ["admin@fedra.test", "doctora@fedra.test", "farmacia@fedra.test", "asistente@fedra.test", "gerente@fedra.test"]);
    expect(error).toBeNull();
    expect(data).toHaveLength(5);
    const porRol = Object.fromEntries((data ?? []).map((u) => [u.rol, u.email]));
    expect(porRol).toEqual({
      admin: "admin@fedra.test",
      doctora: "doctora@fedra.test",
      farmacia: "farmacia@fedra.test",
      asistente: "asistente@fedra.test",
      gerente: "gerente@fedra.test",
    });
    expect((data ?? []).every((u) => u.auth_uid && u.activo)).toBe(true);
  });

  it("hay inventario, pacientes y expedientes sintéticos", async () => {
    expect(await filasVisibles(clientes.farmacia, "productos")).toBeGreaterThanOrEqual(4);
    expect(await filasVisibles(clientes.farmacia, "lotes")).toBeGreaterThanOrEqual(5);
    expect(await filasVisibles(clientes.doctora, "pacientes")).toBeGreaterThanOrEqual(3);
    expect(await filasVisibles(clientes.doctora, "historias_clinicas")).toBeGreaterThanOrEqual(2);
    expect(await filasVisibles(clientes.doctora, "recetas")).toBeGreaterThanOrEqual(1);
    expect(await filasVisibles(clientes.doctora, "citas")).toBeGreaterThanOrEqual(3);
    expect(await filasVisibles(clientes.farmacia, "ventas")).toBeGreaterThanOrEqual(2);
    expect(await filasVisibles(clientes.gerente, "cobros")).toBeGreaterThanOrEqual(2);
  });

  it("las 40 migraciones aplicaron: existen las tablas tardías y sus columnas", async () => {
    // google_calendar_conexion viene de la migración 40, `desglose` de la 36
    // y `direccion` de la 33. Si el reset se quedó corto, esto no responde.
    const { error: e1 } = await clientes.admin.from("google_calendar_conexion").select("*").limit(1);
    expect(e1).toBeNull();
    const { error: e2 } = await clientes.admin.from("cortes_caja").select("desglose").limit(1);
    expect(e2).toBeNull();
    const { error: e3 } = await clientes.admin.from("pacientes").select("direccion").limit(1);
    expect(e3).toBeNull();
  });
});

describe("sin sesión no se ve nada", () => {
  const tablas = ["pacientes", "historias_clinicas", "recetas", "ventas", "cobros", "usuarios"];
  for (const tabla of tablas) {
    it(`anónimo no lee ${tabla}`, async () => {
      expect(await filasVisibles(clienteAnonimo(), tabla)).toBe(0);
    });
  }
});

describe("farmacia no alcanza el expediente clínico", () => {
  for (const tabla of ["historias_clinicas", "consultas", "recetas", "receta_items", "citas"]) {
    it(`farmacia no lee ${tabla}`, async () => {
      expect(await filasVisibles(clientes.farmacia, tabla)).toBe(0);
    });
  }

  it("farmacia sí lee pacientes, porque el contrato lo permite, pero no los escribe", async () => {
    expect(await filasVisibles(clientes.farmacia, "pacientes")).toBeGreaterThan(0);
    const { error } = await clientes.farmacia
      .from("pacientes")
      .insert({ nombre: "PRUEBA Intruso Farmacia" });
    expect(error, "farmacia no debe poder dar de alta pacientes").not.toBeNull();
  });
});

describe("la clínica no alcanza el dinero de la farmacia", () => {
  for (const tabla of ["ventas", "venta_items", "pagos", "movimientos_inv", "compras", "cortes_caja"]) {
    it(`asistente no lee ${tabla}`, async () => {
      expect(await filasVisibles(clientes.asistente, tabla)).toBe(0);
    });
  }

  // La migración 37 concede a la doctora, como dueña, LECTURA de cortes,
  // ventas, renglones y pagos, y nada más. No es un hueco: es el contrato.
  it("doctora lee el dinero de farmacia porque es la dueña, pero no lo escribe", async () => {
    for (const tabla of ["ventas", "venta_items", "pagos", "cortes_caja"]) {
      expect(
        await filasVisibles(clientes.doctora, tabla),
        `la doctora debe poder auditar ${tabla}`,
      ).toBeGreaterThan(0);
    }
    const { data } = await clientes.doctora
      .from("pagos")
      .update({ monto: 1 })
      .gt("monto", 0)
      .select();
    expect(data ?? [], "la doctora no debe poder modificar un pago").toHaveLength(0);
  });

  it("ni la doctora ni la asistente ven el movimiento de inventario", async () => {
    expect(await filasVisibles(clientes.doctora, "movimientos_inv")).toBe(0);
    expect(await filasVisibles(clientes.doctora, "compras")).toBe(0);
    expect(await filasVisibles(clientes.asistente, "movimientos_inv")).toBe(0);
  });
});

describe("cada quien ve la lista de personal que le toca", () => {
  it("farmacia solo se ve a sí misma", async () => {
    const { data } = await clientes.farmacia.from("usuarios").select("email");
    expect(data?.map((u) => u.email)).toEqual(["farmacia@fedra.test"]);
  });

  it("asistente solo se ve a sí misma", async () => {
    const { data } = await clientes.asistente.from("usuarios").select("email");
    expect(data?.map((u) => u.email)).toEqual(["asistente@fedra.test"]);
  });

  it("doctora y gerente leen todo el personal, para trazar quién hizo cada corte", async () => {
    expect(await filasVisibles(clientes.doctora, "usuarios")).toBeGreaterThanOrEqual(5);
    expect(await filasVisibles(clientes.gerente, "usuarios")).toBeGreaterThanOrEqual(5);
  });

  it("nadie que no sea admin cambia el rol de otra persona", async () => {
    for (const rol of ["doctora", "farmacia", "asistente", "gerente"] as const) {
      const { data } = await clientes[rol]
        .from("usuarios")
        .update({ rol: "admin" })
        .eq("email", "asistente@fedra.test")
        .select();
      expect(data ?? [], `${rol} no debe poder promover a nadie`).toHaveLength(0);
    }
    const { data } = await clientes.admin.from("usuarios").select("rol").eq("email", "asistente@fedra.test");
    expect(data?.[0]?.rol).toBe("asistente");
  });
});

describe("una venta cerrada no cambia en silencio", () => {
  it("la clínica no puede borrar ni modificar una venta", async () => {
    const { data: antes } = await clientes.farmacia.from("ventas").select("id, total").limit(1);
    const venta = antes?.[0];
    expect(venta, "la semilla debe traer al menos una venta").toBeTruthy();

    const { data: tocada } = await clientes.doctora
      .from("ventas")
      .update({ total: 1 })
      .eq("id", venta!.id)
      .select();
    expect(tocada ?? []).toHaveLength(0);

    const { data: despues } = await clientes.farmacia.from("ventas").select("total").eq("id", venta!.id);
    expect(Number(despues?.[0]?.total)).toBe(Number(venta!.total));
  });
});

describe("la RPC de ventas cobra el precio del catálogo", () => {
  it("un precio enviado por el cliente no cambia lo que se cobra", async () => {
    const { data: prod } = await clientes.farmacia
      .from("productos")
      .select("id, precio_venta")
      .eq("nombre", "PRUEBA Vitamina D3 5000UI")
      .single();
    expect(prod).toBeTruthy();

    const { data, error } = await clientes.farmacia.rpc("registrar_venta", {
      p_items: [{ producto_id: prod!.id, cantidad: 1, precio_unit: 0.01 }],
      p_metodo: "efectivo",
    });
    expect(error).toBeNull();
    const ventaId = (data as { venta_id: string }[] | null)?.[0]?.venta_id;
    expect(ventaId).toBeTruthy();

    const { data: venta } = await clientes.farmacia.from("ventas").select("total").eq("id", ventaId!).single();
    expect(Number(venta?.total)).toBe(Number(prod!.precio_venta));
  });

  it("no deja vender más de lo que hay en los lotes", async () => {
    const { data: prod } = await clientes.farmacia
      .from("productos")
      .select("id")
      .eq("nombre", "PRUEBA Proteína en polvo")
      .single();
    const { error } = await clientes.farmacia.rpc("registrar_venta", {
      p_items: [{ producto_id: prod!.id, cantidad: 100000, precio_unit: 890 }],
      p_metodo: "efectivo",
    });
    expect(error, "vender sin existencia debe fallar").not.toBeNull();
    expect(error?.message ?? "").toMatch(/[Ss]tock/);
  });
});
