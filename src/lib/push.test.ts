import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `push.ts` concentra la entrega de notificaciones y hasta ahora no tenia
// ninguna prueba, porque `vitest.config.mts` no declaraba el alias `@`. Los
// escenarios de abajo son los que se habian verificado a mano en worktrees
// desechables durante la revision de FED-017; aqui quedan en el repositorio,
// donde pueden ponerse rojos.

const enviadasPorEndpoint = new Map<string, number | null>();
const borradas: string[][] = [];
let subsDeLaBase: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];
let usuariosDeLaBase: Array<{ auth_uid: string | null }> = [];
let errorUsuarios: unknown = null;
let errorSubs: unknown = null;
let vapidRevienta = false;

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {
      if (vapidRevienta) throw new Error("llaves VAPID invalidas");
    },
    sendNotification: async (sub: { endpoint: string }) => {
      const code = enviadasPorEndpoint.get(sub.endpoint);
      if (code == null) return;
      const err = new Error(`fallo ${code}`) as Error & { statusCode: number };
      err.statusCode = code;
      throw err;
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(tabla: string) {
      const api = {
        select: () => api,
        eq: () => api,
        in: (columna: string, valores: string[]) => {
          if (tabla === "push_subscriptions" && columna === "id") {
            borradas.push(valores);
            return Promise.resolve({ error: null });
          }
          return api;
        },
        delete: () => api,
        then: (resolve: (v: unknown) => void) =>
          resolve(
            tabla === "usuarios"
              ? { data: usuariosDeLaBase, error: errorUsuarios }
              : { data: subsDeLaBase, error: errorSubs },
          ),
      };
      return api;
    },
  }),
}));

const sub = (id: string) => ({ id, endpoint: `https://push.test/${id}`, p256dh: "p", auth: "a" });
const AVISO = { title: "t", body: "b" };

async function cargar() {
  vi.resetModules();
  return await import("./push");
}

beforeEach(() => {
  enviadasPorEndpoint.clear();
  borradas.length = 0;
  subsDeLaBase = [];
  usuariosDeLaBase = [];
  errorUsuarios = null;
  errorSubs = null;
  vapidRevienta = false;
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

describe("push · configuracion ausente se distingue de lista vacia", () => {
  it("sin llaves VAPID no consulta la base y reporta sin_configuracion", async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const { enviarARoles } = await cargar();
    const r = await enviarARoles(["admin"], AVISO);
    expect(r.configurado).toBe(false);
    expect(r.motivo).toBe("sin_configuracion");
    expect(r.destinatarios).toBe(0);
  });

  it("VAPID que revienta cae en sin_configuracion, no en un fallo de envio", async () => {
    vapidRevienta = true;
    const { enviarAUsuario } = await cargar();
    const r = await enviarAUsuario("u1", AVISO);
    expect(r.configurado).toBe(false);
    expect(r.motivo).toBe("sin_configuracion");
  });

  it("con llaves puestas y cero suscriptores dice sin_destinatarios y configurado", async () => {
    usuariosDeLaBase = [{ auth_uid: "u1" }];
    subsDeLaBase = [];
    const { enviarARoles } = await cargar();
    const r = await enviarARoles(["admin"], AVISO);
    expect(r.configurado).toBe(true);
    expect(r.motivo).toBe("sin_destinatarios");
  });

  it("un error al consultar no se disfraza de lista vacia", async () => {
    errorUsuarios = { message: "se cayo la base" };
    const { enviarARoles } = await cargar();
    const r = await enviarARoles(["admin"], AVISO);
    expect(r.configurado).toBe(true);
    expect(r.motivo).toBe("error_consulta");
  });
});

describe("push · conteo de entregas", () => {
  it("entrega parcial conserva los dos numeros", async () => {
    subsDeLaBase = [sub("s1"), sub("s2"), sub("s3")];
    enviadasPorEndpoint.set("https://push.test/s3", 500);
    const { enviarAUsuario } = await cargar();
    const r = await enviarAUsuario("u1", AVISO);
    expect(r).toMatchObject({ destinatarios: 3, enviadas: 2, expiradas: 0, fallidas: 1, motivo: "fallos_envio" });
  });

  it("un 410 limpia la suscripcion y NO cuenta como fallo", async () => {
    subsDeLaBase = [sub("s1"), sub("s2")];
    enviadasPorEndpoint.set("https://push.test/s1", 410);
    const { enviarAUsuario } = await cargar();
    const r = await enviarAUsuario("u1", AVISO);
    expect(r).toMatchObject({ destinatarios: 2, enviadas: 1, expiradas: 1, fallidas: 0 });
    expect(borradas).toEqual([["s1"]]);
  });

  it("un 404 tambien limpia", async () => {
    subsDeLaBase = [sub("s1")];
    enviadasPorEndpoint.set("https://push.test/s1", 404);
    const { enviarAUsuario } = await cargar();
    const r = await enviarAUsuario("u1", AVISO);
    expect(r.expiradas).toBe(1);
    expect(borradas).toEqual([["s1"]]);
  });

  it("un 500 transitorio NO borra ninguna suscripcion", async () => {
    subsDeLaBase = [sub("s1"), sub("s2")];
    enviadasPorEndpoint.set("https://push.test/s1", 500);
    enviadasPorEndpoint.set("https://push.test/s2", 503);
    const { enviarAUsuario } = await cargar();
    const r = await enviarAUsuario("u1", AVISO);
    expect(r).toMatchObject({ enviadas: 0, expiradas: 0, fallidas: 2 });
    expect(borradas, "un mal dia del proveedor no debe dejar a Fedra sin dispositivos").toEqual([]);
  });

  it("INVARIANTE: enviadas + expiradas + fallidas = destinatarios", async () => {
    subsDeLaBase = [sub("s1"), sub("s2"), sub("s3"), sub("s4")];
    enviadasPorEndpoint.set("https://push.test/s2", 410);
    enviadasPorEndpoint.set("https://push.test/s4", 500);
    const { enviarAUsuario } = await cargar();
    const r = await enviarAUsuario("u1", AVISO);
    expect(r.enviadas + r.expiradas + r.fallidas).toBe(r.destinatarios);
  });
});

describe("push · a quien se le manda", () => {
  it("un perfil sin auth_uid no cuenta como destinatario", async () => {
    // La base SI tiene suscripciones. Si el filtro de `auth_uid` nulo no
    // funcionara, la consulta seguiria adelante y les enviaria a todas. Sin
    // estas suscripciones cargadas los dos caminos terminan igual y la prueba
    // pasa sin haber medido nada.
    usuariosDeLaBase = [{ auth_uid: null }, { auth_uid: null }];
    subsDeLaBase = [sub("s1"), sub("s2")];
    const { enviarARoles } = await cargar();
    const r = await enviarARoles(["admin", "doctora"], AVISO);
    expect(r.motivo).toBe("sin_destinatarios");
    expect(r.destinatarios).toBe(0);
    expect(r.enviadas, "no debe enviarse nada a un perfil sin identidad").toBe(0);
  });
});
