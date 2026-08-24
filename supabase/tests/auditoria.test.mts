import { beforeAll, describe, expect, it } from "vitest";
import { sesion, type Rol } from "./helpers.mjs";
import type { SupabaseClient } from "@supabase/supabase-js";

// La bitácora se mide por su efecto, no por el catálogo. Cada sonda hace un
// cambio real por la API, con la sesión del rol que de verdad puede hacerlo, y
// después pregunta si quedó rastro. Leer `pg_trigger` diría qué disparadores
// existen; esto dice si el expediente queda trazado, que es lo que exige la
// NOM-004 y lo que promete el `comment on table audit_log`.
//
// Cada sonda se afirma en DOS pruebas: una normal que exige que la escritura
// haya ocurrido, y una `it.fails` sobre el rastro. Sin esa separación, una
// escritura negada por RLS haría fallar la prueba y `it.fails` la daría por
// buena, dejando un hallazgo "confirmado" sin haber medido nada. Es el mismo
// error que ya escondió H-024 detrás de un helper que devolvía cero.

const clientes = {} as Record<Rol, SupabaseClient>;

// Filas de la semilla.
const CONSULTA = "7ca07e7c-461f-4421-9847-3f56c79f5a7b";
const HISTORIA = "7e3fb0c8-862a-41cd-a70d-277e61dbfb8d";
const PACIENTE = "27e8af7e-5565-4791-b714-70ed415e0242";
const CORTE = "6137a2f2-da97-4c58-9c9a-b2714e8daae4";

type Sonda = { escrituraOk: boolean; errorEscritura: string | null; rastro: number };
const sondas = new Map<string, Sonda>();

async function renglonesDeBitacora(tabla: string): Promise<number> {
  const { count, error } = await clientes.admin
    .from("audit_log")
    .select("*", { count: "exact", head: true })
    .eq("tabla", tabla);
  if (error) {
    throw new Error(
      `Contar la bitácora de "${tabla}" falló con "${error.message}". ` +
        `Eso no es ausencia de rastro, es una consulta rota.`,
    );
  }
  return count ?? 0;
}

async function sondear(
  nombre: string,
  tabla: string,
  cambio: () => PromiseLike<{ error: unknown }>,
): Promise<void> {
  const antes = await renglonesDeBitacora(tabla);
  const { error } = await cambio();
  const despues = await renglonesDeBitacora(tabla);
  sondas.set(nombre, {
    escrituraOk: !error,
    errorEscritura: error ? JSON.stringify(error) : null,
    rastro: despues - antes,
  });
}

function sonda(nombre: string): Sonda {
  const s = sondas.get(nombre);
  if (!s) throw new Error(`La sonda "${nombre}" no corrió.`);
  return s;
}

beforeAll(async () => {
  for (const rol of ["admin", "doctora", "farmacia", "asistente", "gerente"] as const) {
    clientes[rol] = await sesion(rol);
  }

  const { data: cita } = await clientes.doctora.from("citas").select("id").limit(1).single();
  const { data: gerente } = await clientes.admin
    .from("usuarios")
    .select("id")
    .eq("email", "gerente@fedra.test")
    .single();

  await sondear("historia", "historias_clinicas", () =>
    clientes.doctora
      .from("historias_clinicas")
      .update({ datos: { "¿Toma algún medicamento?": "Metformina (dato sintético)" } })
      .eq("id", HISTORIA),
  );
  await sondear("paciente", "pacientes", () =>
    clientes.doctora.from("pacientes").update({ notas: "nota sintética" }).eq("id", PACIENTE),
  );
  await sondear("consulta", "consultas", () =>
    clientes.doctora
      .from("consultas")
      .update({ motivo: "Control de peso, motivo corregido" })
      .eq("id", CONSULTA),
  );
  await sondear("cita", "citas", () =>
    clientes.asistente.from("citas").update({ notas: "reagendada" }).eq("id", cita!.id),
  );
  await sondear("corte", "cortes_caja", () =>
    clientes.admin.from("cortes_caja").update({ diferencia: 1.0 }).eq("id", CORTE),
  );
  // Mismo rol que ya tiene: interesa el rastro del cambio de perfil, no dejar
  // a nadie con permisos distintos de los que traía.
  await sondear("rol", "usuarios", () =>
    clientes.admin.from("usuarios").update({ rol: "gerente" }).eq("id", gerente!.id),
  );
}, 120_000);

describe("las sondas de verdad escribieron", () => {
  for (const nombre of ["historia", "paciente", "consulta", "cita", "corte", "rol"]) {
    it(`el cambio de la sonda "${nombre}" sí se aplicó`, () => {
      const s = sonda(nombre);
      expect(s.errorEscritura).toBeNull();
      expect(s.escrituraOk).toBe(true);
    });
  }
});

describe("la bitácora registra donde tiene disparador", () => {
  it("editar una historia clínica deja rastro", () => {
    expect(sonda("historia").rastro).toBeGreaterThan(0);
  });

  it("editar una paciente deja rastro", () => {
    expect(sonda("paciente").rastro).toBeGreaterThan(0);
  });

  it("el renglón dice quién lo hizo, no solo qué cambió", async () => {
    const { data, error } = await clientes.admin
      .from("audit_log")
      .select("usuario_id, accion, tabla, registro_id, datos")
      .eq("tabla", "pacientes")
      .eq("registro_id", PACIENTE)
      .order("id", { ascending: false })
      .limit(1);
    expect(error).toBeNull();
    expect(data?.[0]?.accion).toBe("UPDATE");
    // Sin autor la bitácora dice que algo cambió pero no quién, y entonces no
    // sirve para trazar responsabilidad, que es para lo que existe.
    expect(data?.[0]?.usuario_id).not.toBeNull();
    // La migración 28 promete guardar anterior y nuevo para poder ver el cambio.
    expect(Object.keys((data?.[0]?.datos ?? {}) as object).sort()).toEqual(["anterior", "nuevo"]);
  });
});

describe("H-025 · el expediente clínico y la caja tienen huecos sin rastro", () => {
  // Ninguna de estas tablas aparece en los tres arreglos que reparten
  // disparadores (migraciones 2, 19 y 28), y las cuatro las puede editar por la
  // API el rol que se indica.
  it.fails("editar una consulta DEBERÍA dejar rastro", () => {
    expect(sonda("consulta").rastro).toBeGreaterThan(0);
  });

  it.fails("mover una cita DEBERÍA dejar rastro", () => {
    expect(sonda("cita").rastro).toBeGreaterThan(0);
  });

  it.fails("editar un corte de caja DEBERÍA dejar rastro", () => {
    expect(sonda("corte").rastro).toBeGreaterThan(0);
  });

  it.fails("cambiar el rol de alguien DEBERÍA dejar rastro", () => {
    expect(sonda("rol").rastro).toBeGreaterThan(0);
  });
});

describe("H-026 · la bitácora se puede reescribir desde el navegador", () => {
  // `20260529000002_rls_y_roles.sql` crea `admin_all_<tabla>` recorriendo
  // `pg_tables`, así que `audit_log` recibió una política `for all` como
  // cualquier otra tabla. Un admin con la llave anónima edita y borra los
  // renglones que lo señalan. Una bitácora que el auditado reescribe no es
  // una bitácora.
  it.fails("nadie DEBERÍA poder borrar un renglón de la bitácora", async () => {
    await clientes.doctora.from("pacientes").update({ notas: "nota a borrar" }).eq("id", PACIENTE);
    const { data } = await clientes.admin
      .from("audit_log")
      .select("id")
      .eq("tabla", "pacientes")
      .order("id", { ascending: false })
      .limit(1);
    const id = data![0].id;
    await clientes.admin.from("audit_log").delete().eq("id", id);
    const { count } = await clientes.admin
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("id", id);
    expect(count).toBe(1);
  });

  it.fails("nadie DEBERÍA poder alterar un renglón de la bitácora", async () => {
    await clientes.doctora.from("pacientes").update({ notas: "nota a alterar" }).eq("id", PACIENTE);
    const { data } = await clientes.admin
      .from("audit_log")
      .select("id")
      .eq("tabla", "pacientes")
      .order("id", { ascending: false })
      .limit(1);
    const id = data![0].id;
    await clientes.admin.from("audit_log").update({ accion: "INSERT" }).eq("id", id);
    const { data: despues } = await clientes.admin
      .from("audit_log")
      .select("accion")
      .eq("id", id)
      .single();
    expect(despues?.accion).toBe("UPDATE");
  });
});
