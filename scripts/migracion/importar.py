"""Importa el AppSheet v5 ("Dra. Fedra v.5") a la base del POS.

Reglas de la operación:
  - Los registros entran tal cual vienen. No se juzga si están vigentes.
  - Todo lo importado queda marcado es_historico = true y con su origen_datos.
  - Nada se descarta en silencio: lo que no puede conservar su relación se guarda
    completo, en crudo, en importacion_pendientes.
  - Nunca se inventa un vínculo entre paciente, receta, venta o producto.
  - Idempotente: se re-corre sin duplicar, casando por id_legacy.

Uso:
    python importar.py              # ensayo: lee, resuelve y reporta. No escribe.
    python importar.py --ejecutar   # escribe en la base.
"""

import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import conexion as cx
import excel_v5 as ex

ORIGEN = cx.LOTE_ORIGEN
USUARIO_IMPORT = "importacion-historica@sistema.local"

# Hojas con datos del negocio que este esquema no tiene dónde guardar.
# Se conservan en crudo para que alguien decida después.
HOJAS_SIN_DESTINO = [
    "RegistroAsistencia", "DETALLEVENTA", "PacientesConsentimientos", "Imagenes",
    "InBody", "Consentimiento", "Medicamentos", "SesionesTerapia", "Egresos",
    "Form", "Respuestas de formulario 4",
]

# Columnas de la hoja Pacientes que son control de AppSheet, no datos clínicos.
# No entran a la historia clínica para no ensuciar el documento que se imprime.
CONTROL_APPSHEET = {
    "", "Id", "IdClinica", "Nombres", "Apellidos", "Celular", "Email", "Direccion",
    "Sexo", "Nacio", "Peso", "Estatura", "Cintura", "fechAlta", "Timestamp",
    "Foto", "Ver detalles", "Usuario", "Estado", "FirmaDra", "CountRecetas",
    "Edad", "Cumple",
}

orden_de_tabla = [
    "categorias", "proveedores", "servicios", "pacientes", "historias_clinicas",
    "productos", "lotes", "recetas", "receta_items", "cobros", "cobro_items",
    "cobro_pagos", "ventas", "venta_items", "cortes_caja", "citas",
]


class Acumulador:
    """Junta las filas a escribir y los renglones que quedaron sin relación."""

    def __init__(self):
        self.filas = {t: [] for t in orden_de_tabla}
        self.pendientes = []
        self.notas = []

    def add(self, tabla, fila):
        self.filas[tabla].append(fila)

    def pendiente(self, hoja, id_legacy, motivo, datos):
        self.pendientes.append(
            {
                "origen_datos": ORIGEN,
                "hoja": hoja,
                "id_legacy": id_legacy,
                "motivo": motivo,
                "datos": {k: (v if isinstance(v, (str, int, float, bool, type(None))) else str(v))
                          for k, v in datos.items() if k},
            }
        )

    def nota(self, t):
        self.notas.append(t)


def uid():
    return str(uuid.uuid4())


def nota_paciente(r):
    """Lo que no cabe en una columna del paciente pero no se puede perder."""
    bruto = r.get("Celular")
    # Excel devuelve los números como float: 4487363.0 no es un teléfono legible.
    if isinstance(bruto, float) and bruto.is_integer():
        bruto = int(bruto)
    crudo = ex.txt(bruto)
    if crudo and not ex.telefono(r.get("Celular")):
        return f"Teléfono del sistema anterior, no utilizable para WhatsApp: {crudo}"
    return None


# --- escritura ---------------------------------------------------------------

def existentes(tabla):
    """Mapa id_legacy -> id ya presente en la base, para poder re-correr."""
    filas = cx.sql(
        f"select id, id_legacy from public.{tabla} where id_legacy is not null"
    )
    return {f["id_legacy"]: f["id"] for f in filas}


def escribir(tabla, filas, tam=250):
    """Inserta en lotes. Las filas ya traen su id resuelto."""
    if not filas:
        return 0
    cols = sorted({c for f in filas for c in f})
    total = 0
    for i in range(0, len(filas), tam):
        trozo = filas[i : i + tam]
        listado = ", ".join(f'"{c}"' for c in cols)
        valores = ",\n".join(
            "(" + ", ".join(cx.lit(f.get(c)) for c in cols) + ")" for f in trozo
        )
        cx.sql(f'insert into public.{tabla} ({listado}) values\n{valores};')
        total += len(trozo)
        print(f"    {tabla}: {total}/{len(filas)}")
    return total


def usuario_marcador():
    """Usuario inactivo al que se atribuyen las ventas y cortes importados.

    Las tablas de dinero exigen un usuario y no queremos atribuirle a una persona
    real movimientos que no capturó. Este usuario no tiene cuenta en auth, así
    que nadie puede entrar con él.
    """
    filas = cx.sql(
        f"select id from public.usuarios where email = {cx.lit(USUARIO_IMPORT)}"
    )
    if filas:
        return filas[0]["id"]
    nuevo = uid()
    cx.sql(
        "insert into public.usuarios (id, nombre, email, rol, activo) values ("
        f"{cx.lit(nuevo)}, 'Importación histórica (AppSheet v5)', "
        f"{cx.lit(USUARIO_IMPORT)}, 'asistente', false);"
    )
    return nuevo


# --- construcción ------------------------------------------------------------

def construir(wb, ctx):
    ac = Acumulador()
    t, n, e, f, m, b = ex.txt, ex.num, ex.ent, ex.fecha, ex.marca, ex.booleano
    marca_hist = {"origen_datos": ORIGEN, "es_historico": True}

    # --- catálogos ----------------------------------------------------------
    id_categoria = {}
    for r in ex.hoja(wb, "CATEGORIAS"):
        leg = t(r.get("IDcategoria"))
        nombre = t(r.get("Nombre"))
        if not nombre:
            ac.pendiente("CATEGORIAS", leg, "la categoría no trae nombre", r)
            continue
        if not leg:
            continue
        nuevo = ctx["previos"]["categorias"].get(leg, uid())
        id_categoria[leg] = nuevo
        ac.add("categorias", {"id": nuevo, "nombre": nombre, "id_legacy": leg, **marca_hist})

    id_proveedor = {}
    for r in ex.hoja(wb, "Proveedores"):
        leg = t(r.get("IDProveedor"))
        nombre = t(r.get("NombreProveedor"))
        if not nombre:
            ac.pendiente("Proveedores", leg, "el proveedor no trae nombre", r)
            continue
        if not leg:
            continue
        nuevo = ctx["previos"]["proveedores"].get(leg, uid())
        id_proveedor[leg] = nuevo
        ac.add("proveedores", {
            "id": nuevo, "nombre": nombre, "contacto": ex.telefono(r.get("Celular")),
            "id_legacy": leg, **marca_hist,
        })

    id_servicio = {}
    for r in ex.hoja(wb, "Aranceles"):
        leg = t(r.get("Id"))
        nombre = t(r.get("Arancel"))
        if not nombre:
            ac.pendiente("Aranceles", leg, "el arancel no trae nombre", r)
            continue
        if not leg:
            continue
        nuevo = ctx["previos"]["servicios"].get(leg, uid())
        id_servicio[leg] = nuevo
        ac.add("servicios", {
            "id": nuevo, "nombre": nombre, "precio": n(r.get("PU")) or 0,
            "categoria": t(r.get("Descripción")), "activo": True,
            "id_legacy": leg, **marca_hist,
        })

    # --- pacientes y su historia clínica ------------------------------------
    id_paciente = {}
    for r in ex.hoja(wb, "Pacientes"):
        leg = t(r.get("Id"))
        if not leg:
            continue
        nuevo = ctx["previos"]["pacientes"].get(leg, uid())
        id_paciente[leg] = nuevo
        nombre = t(r.get("Nombres")) or t(r.get("Apellidos")) or "(sin nombre)"
        ac.add("pacientes", {
            "id": nuevo, "nombre": nombre, "apellidos": t(r.get("Apellidos")),
            "fecha_nac": f(r.get("Nacio")), "sexo": t(r.get("Sexo")),
            "telefono_wpp": ex.telefono(r.get("Celular")), "email": t(r.get("Email")),
            "notas": nota_paciente(r),
            "peso_inicial": n(r.get("Peso")), "cintura_inicial": n(r.get("Cintura")),
            "direccion": t(r.get("Direccion")),
            "creado_en": m(r.get("fechAlta")) or m(r.get("Timestamp")),
            "id_legacy": leg, **marca_hist,
        })

        # El formulario clínico del sistema viejo se vuelve una historia clínica.
        datos = {}
        for col, val in r.items():
            if col in CONTROL_APPSHEET:
                continue
            # Un "No" explícito es dato clínico (la negativa pertinente de la
            # NOM-004), así que los booleanos se guardan aunque sean falsos.
            if isinstance(val, bool):
                v = val
            elif isinstance(val, (int, float)):
                v = val
            else:
                v = t(val)
            if v is None:
                continue
            clave = ctx["campos"].get(ex.normaliza_etiqueta(col)) or col
            datos[clave] = v
        if datos:
            hid = ctx["previos"]["historias_clinicas"].get(f"HC-{leg}", uid())
            ac.add("historias_clinicas", {
                "id": hid, "paciente_id": nuevo,
                "tipo_historia_id": ctx["tipo_historia"],
                "fecha": m(r.get("fechAlta")) or m(r.get("Timestamp")),
                "datos": datos, "id_legacy": f"HC-{leg}", **marca_hist,
            })

    # --- inventario ---------------------------------------------------------
    id_producto = {}
    vistos = set()
    for r in ex.hoja(wb, "PRODUCTOS_LISTA"):
        leg = t(r.get("iD"))
        if not leg:
            continue
        if leg in vistos:
            # El catálogo viejo repite el mismo producto. Guardamos la copia
            # para que quede constancia, pero no duplicamos la ficha.
            ac.pendiente("PRODUCTOS_LISTA", leg, "renglón repetido en el catálogo viejo", r)
            continue
        vistos.add(leg)
        nuevo = ctx["previos"]["productos"].get(leg, uid())
        id_producto[leg] = nuevo
        ac.add("productos", {
            "id": nuevo, "nombre": t(r.get("Producto")) or leg,
            "categoria_id": id_categoria.get(t(r.get("Categoria"))),
            "precio_venta": 0, "stock_minimo": 0, "activo": True,
            "id_legacy": leg, **marca_hist,
        })

    # Existencias por lote. De aquí sale también el precio de venta del producto.
    id_lote = {}
    producto_de_lote = {}
    precio_por_producto = {}
    for r in ex.hoja(wb, "PRODUCTOS"):
        leg = t(r.get("UniqueID"))
        if not leg:
            continue
        ref = t(r.get("IdProductoLista"))
        pid = id_producto.get(ref)
        if pid is None and ref:
            # El renglón declara de qué producto es, pero ese producto no viene
            # en el catálogo. Levantamos la ficha con el nombre que él mismo trae
            # (no es adivinar un vínculo: el nombre es su identificador).
            pid = ctx["previos"]["productos"].get(ref, uid())
            id_producto[ref] = pid
            ac.add("productos", {
                "id": pid, "nombre": ref,
                "categoria_id": id_categoria.get(t(r.get("Categoria"))),
                "precio_venta": 0, "stock_minimo": 0, "activo": True,
                "id_legacy": ref, **marca_hist,
            })
            ac.pendiente("PRODUCTOS", leg,
                         "producto sin ficha en el catálogo; se reconstruyó desde la existencia", r)
        if pid is None:
            ac.pendiente("PRODUCTOS", leg, "no dice de qué producto es", r)
            continue
        nuevo = ctx["previos"]["lotes"].get(leg, uid())
        id_lote[leg] = nuevo
        producto_de_lote[leg] = pid
        ac.add("lotes", {
            "id": nuevo, "producto_id": pid, "lote": t(r.get("LoteNo.")),
            "caducidad": f(r.get("fecha de vencimiento")),
            "cantidad_actual": n(r.get("Cantidad")) or 0,
            "id_legacy": leg, **marca_hist,
        })
        precio = n(r.get("Precio Unitario"))
        entrada = m(r.get("PrimerasEntradas")) or ""
        if precio is not None:
            previo = precio_por_producto.get(pid)
            if previo is None or entrada >= previo[0]:
                precio_por_producto[pid] = (entrada, precio, n(r.get("StockMinimo")) or 0)

    for fila in ac.filas["productos"]:
        dato = precio_por_producto.get(fila["id"])
        if dato:
            fila["precio_venta"] = dato[1]
            fila["stock_minimo"] = dato[2]

    # --- recetas ------------------------------------------------------------
    id_receta = {}
    for r in ex.hoja(wb, "Receta"):
        leg = t(r.get("UniqueID"))
        ref = t(r.get("IDPaciente"))
        if not leg:
            continue
        pac = id_paciente.get(ref)
        if pac is None:
            ac.pendiente("Receta", leg, "el paciente de la receta no viene en el archivo", r)
            continue
        nuevo = ctx["previos"]["recetas"].get(leg, uid())
        id_receta[leg] = nuevo
        ac.add("recetas", {
            "id": nuevo, "paciente_id": pac, "fase": e(r.get("Fase")),
            "fecha": m(r.get("Fecha")), "pdf_url": t(r.get("File")),
            "estado": "emitida", "id_legacy": leg, **marca_hist,
        })

    for r in ex.hoja(wb, "RecetaMedicamentos"):
        leg = t(r.get("UniqueID"))
        ref = t(r.get("RecetaID"))
        if not leg:
            continue
        rec = id_receta.get(ref)
        if rec is None:
            motivo = ("el renglon no dice a que receta pertenece" if not ref
                      else "la receta a la que pertenece no viene en el archivo")
            ac.pendiente("RecetaMedicamentos", leg, motivo, r)
            continue
        ac.add("receta_items", {
            "id": ctx["previos"]["receta_items"].get(leg, uid()), "receta_id": rec,
            "medicamento": t(r.get("Tipo de medicamento")) or "(sin nombre)",
            "dosis": t(r.get("Dosis")),
            "duracion_dias": e(r.get("Duración")),
            "cantidad": n(r.get("Cantidad de medicamentos")),
            "indicaciones": t(r.get("Indicaciones")),
            "id_legacy": leg, **marca_hist,
        })

    # --- cobros clinicos ----------------------------------------------------
    id_cobro = {}
    for r in ex.hoja(wb, "Historial"):
        leg = t(r.get("IdHist"))
        ref = t(r.get("Paciente"))
        if not leg:
            continue
        pac = id_paciente.get(ref)
        if pac is None:
            ac.pendiente("Historial", leg, "el paciente del cobro no viene en el archivo", r)
            continue
        nuevo = ctx["previos"]["cobros"].get(leg, uid())
        id_cobro[leg] = nuevo
        ac.add("cobros", {
            "id": nuevo, "paciente_id": pac, "fecha": m(r.get("fechAlta")),
            "total": 0, "id_legacy": leg, **marca_hist,
        })

    total_cobro = {}
    for r in ex.hoja(wb, "DetalleHistorial"):
        leg = t(r.get("Id"))
        ref = t(r.get("Historial"))
        if not leg:
            continue
        cob = id_cobro.get(ref)
        if cob is None:
            ac.pendiente("DetalleHistorial", leg,
                         "el cobro al que pertenece no viene en el archivo", r)
            continue
        sub = n(r.get("SubTotal")) or n(r.get("Total")) or 0
        total_cobro[cob] = total_cobro.get(cob, 0) + sub
        ac.add("cobro_items", {
            "id": ctx["previos"]["cobro_items"].get(leg, uid()), "cobro_id": cob,
            "servicio_id": id_servicio.get(t(r.get("Tratamiento"))),
            "descripcion": t(r.get("Observacion")), "afeccion": t(r.get("Afeccion")),
            "cantidad": n(r.get("Cant")) or 1, "precio_unit": n(r.get("PU")) or 0,
            "descuento": n(r.get("Desc")) or 0, "subtotal": sub,
            "id_legacy": leg, **marca_hist,
        })

    for fila in ac.filas["cobros"]:
        fila["total"] = total_cobro.get(fila["id"], 0)

    METODO = {"efectivo": "efectivo", "tarjeta": "tarjeta",
              "transferencia": "transferencia", "deposito": "transferencia"}
    for r in ex.hoja(wb, "Pagos"):
        leg = t(r.get("IdPag"))
        ref = t(r.get("IdHistorial"))
        if not leg:
            continue
        cob = id_cobro.get(ref)
        if cob is None:
            ac.pendiente("Pagos", leg, "el cobro que se pago no viene en el archivo", r)
            continue
        metodo = METODO.get((t(r.get("MetodoPago")) or "").lower(), "otro")
        ac.add("cobro_pagos", {
            "id": ctx["previos"]["cobro_pagos"].get(leg, uid()), "cobro_id": cob,
            "monto": n(r.get("Monto")) or 0, "metodo": metodo,
            "fecha": m(r.get("Fecha")), "id_legacy": leg, **marca_hist,
        })

    # --- ventas de mostrador ------------------------------------------------
    ESTADO_VENTA = {"pagado": "pagada", "pagada": "pagada",
                    "cancelado": "cancelada", "cancelada": "cancelada",
                    "cotizacion": "cotizacion"}
    id_venta = {}
    for r in ex.hoja(wb, "VENTAS"):
        leg = t(r.get("IDventas"))
        if not leg:
            continue
        nuevo = ctx["previos"]["ventas"].get(leg, uid())
        id_venta[leg] = nuevo
        total = n(r.get("TOTAL INPUT")) or 0
        ac.add("ventas", {
            "id": nuevo, "usuario_id": ctx["usuario"],
            "fecha": m(r.get("FECHA"), r.get("HORA")) or m(r.get("Timestamp")),
            "subtotal": total, "total": total,
            "metodo_pago": METODO.get((t(r.get("Medio de pago")) or "").lower(), "otro"),
            "estado": ESTADO_VENTA.get((t(r.get("Estado")) or "").lower(), "pagada"),
            "id_legacy": leg, **marca_hist,
        })

    for r in ex.hoja(wb, "ORDERVENTAS"):
        leg = t(r.get("IDorderventas"))
        ref = t(r.get("IDventas"))
        if not leg:
            continue
        ven = id_venta.get(ref)
        if ven is None:
            ac.pendiente("ORDERVENTAS", leg,
                         "la venta a la que pertenece no viene en el archivo", r)
            continue
        lote_ref = t(r.get("Nombre"))
        pid = producto_de_lote.get(lote_ref)
        if pid is None:
            ac.pendiente("ORDERVENTAS", leg, "el producto vendido no viene en el archivo", r)
            continue
        ac.add("venta_items", {
            "id": ctx["previos"]["venta_items"].get(leg, uid()), "venta_id": ven,
            "producto_id": pid, "lote_id": id_lote.get(lote_ref),
            "cantidad": n(r.get("Cantidad")) or 1,
            "precio_unit": n(r.get("Precio")) or 0,
            "id_legacy": leg, **marca_hist,
        })

    for r in ex.hoja(wb, "VENTAS_CORTE"):
        leg = t(r.get("Id"))
        if not leg:
            continue
        ac.add("cortes_caja", {
            "id": ctx["previos"]["cortes_caja"].get(leg, uid()),
            "usuario_id": ctx["usuario"],
            "apertura": m(r.get("FechaHora Inicio")) or m(r.get("FechaHora Fin")),
            "cierre": m(r.get("FechaHora Fin")),
            "fondo": n(r.get("Monto Inicial")) or 0,
            "total_efectivo": n(r.get("Monto Efectivo Final")),
            "total_ventas": n(r.get("Total")),
            "id_legacy": leg, **marca_hist,
        })

    # --- agenda -------------------------------------------------------------
    ESTADO_CITA = {"programada": "agendada", "confirmada": "confirmada",
                   "cancelada": "cancelada", "cedida": "cedida",
                   "atendida": "atendida"}
    for r in ex.hoja(wb, "Agenda"):
        leg = t(r.get("Id"))
        if not leg:
            continue
        pac = id_paciente.get(t(r.get("Paciente")))
        if pac is None:
            ac.pendiente("Agenda", leg, "el paciente de la cita no viene en el archivo", r)
            continue
        cuando = ex.marca(r.get("FechaCita"), r.get("HoraInicio")) or m(r.get("Fecha"))
        if not cuando:
            ac.pendiente("Agenda", leg, "la cita no trae fecha utilizable", r)
            continue
        # El sistema viejo permitia hasta tres pacientes en una cita; aqui solo
        # cabe uno. Los demas se anotan, no se inventan citas nuevas.
        otros = [t(r.get("Paciente2")), t(r.get("Paciente3"))]
        otros = [o for o in otros if o]
        nota = t(r.get("Nota")) or ""
        if otros:
            nota = (nota + "\n" if nota else "") + "Otros pacientes en la cita: " + ", ".join(otros)
        ac.add("citas", {
            "id": ctx["previos"]["citas"].get(leg, uid()), "paciente_id": pac,
            "fecha_hora": cuando,
            "estado": ESTADO_CITA.get((t(r.get("Estado")) or "").lower(), "agendada"),
            "notas": nota or None, "id_legacy": leg, **marca_hist,
        })

    # --- hojas que este esquema no tiene donde guardar ----------------------
    for nombre in HOJAS_SIN_DESTINO:
        try:
            filas = ex.hoja(wb, nombre)
        except KeyError:
            continue
        for r in filas:
            primera = list(r)[0] if r else None
            clave = t(r.get(primera)) if primera else None
            ac.pendiente(nombre, clave, "el POS no tiene donde guardar esta hoja", r)

    return ac


# --- preparación del contexto ------------------------------------------------

TABLAS_CON_LEGACY = [
    "categorias", "proveedores", "servicios", "pacientes", "historias_clinicas",
    "productos", "lotes", "recetas", "receta_items", "cobros", "cobro_items",
    "cobro_pagos", "ventas", "venta_items", "cortes_caja", "citas",
]


def plantilla_historia():
    """Plantilla a la que se cuelgan las historias importadas, y sus campos.

    Casamos por etiqueta para que las respuestas del sistema viejo caigan en el
    campo correcto de la plantilla y se vean en su sección. Lo que no case entra
    igual, con su etiqueta original: la pantalla lo muestra bajo 'Datos'.
    """
    tipos = cx.sql("select id, nombre from public.tipos_historia order by nombre")
    if not tipos:
        raise SystemExit(
            "No hay ninguna plantilla de historia clínica en la base. "
            "Las migraciones de plantillas deben estar aplicadas antes de importar."
        )
    preferidas = ["Historia Clínica (NOM-004)", "General"]
    elegido = next(
        (t["id"] for p in preferidas for t in tipos if t["nombre"] == p), tipos[0]["id"]
    )
    campos = cx.sql(
        f"select id, etiqueta from public.campos_historia "
        f"where tipo_historia_id = {cx.lit(elegido)}"
    )
    return elegido, {ex.normaliza_etiqueta(c["etiqueta"]): c["id"] for c in campos}


def contexto(escribe):
    previos = {t: (existentes(t) if escribe else {}) for t in TABLAS_CON_LEGACY}
    if escribe:
        tipo, campos = plantilla_historia()
    else:
        # El ensayo debe poder correrse sin llegar a la base, para revisar el
        # mapeo antes de tener acceso. Sin plantilla, las respuestas se quedan
        # con su etiqueta original, que es como se guardan las que no casan.
        try:
            tipo, campos = plantilla_historia()
        except (Exception, SystemExit) as err:
            print(f"  (sin base: {str(err).splitlines()[0][:70]})")
            tipo, campos = "00000000-0000-0000-0000-000000000000", {}
    return {
        "previos": previos,
        "campos": campos,
        "tipo_historia": tipo,
        "usuario": usuario_marcador() if escribe else "00000000-0000-0000-0000-000000000000",
    }


def reportar(ac):
    print("\nA IMPORTAR")
    total = 0
    for t in orden_de_tabla:
        n = len(ac.filas[t])
        total += n
        print(f"  {t:22s} {n:6d}")
    print(f"  {'TOTAL':22s} {total:6d}")

    print(f"\nSIN RELACIÓN (van a importacion_pendientes): {len(ac.pendientes)}")
    resumen = {}
    for p in ac.pendientes:
        clave = (p["hoja"], p["motivo"])
        resumen[clave] = resumen.get(clave, 0) + 1
    for (hoja, motivo), n in sorted(resumen.items(), key=lambda x: -x[1]):
        print(f"  {n:5d}  {hoja} — {motivo}")
    return total


def main():
    escribe = "--ejecutar" in sys.argv
    print("Importación del AppSheet v5 —", "EJECUTANDO" if escribe else "ENSAYO (no escribe)")
    print(f"Archivo : {ex.RUTA}")
    print(f"SHA-256 : {ex.verificar_archivo()}  (coincide con el autorizado)")

    if escribe:
        p = cx.proyecto()
        print(f"Proyecto: {p.get('name')} / {cx.PROYECTO} ({p.get('region')})")

    wb = ex.abrir()
    ctx = contexto(escribe)
    print(f"Plantilla de historia: {ctx['tipo_historia']} con {len(ctx['campos'])} campos")

    ac = construir(wb, ctx)
    total = reportar(ac)

    if not escribe:
        print("\nEnsayo terminado. Nada se escribió. Corre con --ejecutar para aplicar.")
        return ac

    print("\nEscribiendo...")
    for t in orden_de_tabla:
        nuevas = [f for f in ac.filas[t] if f["id"] not in set(ctx["previos"][t].values())]
        escribir(t, nuevas)
    if ac.pendientes:
        # Se rehacen enteros: son el retrato de esta corrida, no un histórico.
        cx.sql(
            "delete from public.importacion_pendientes "
            f"where origen_datos = {cx.lit(ORIGEN)};"
        )
        escribir("importacion_pendientes",
                 [{**p, "id": uid()} for p in ac.pendientes])

    print("\nConteos en la base:")
    for t in orden_de_tabla + ["importacion_pendientes"]:
        n = cx.sql(f"select count(*) as n from public.{t}")[0]["n"]
        print(f"  {t:26s} {n:6d}")
    print(f"\nListo. {total} registros importados.")
    return ac


if __name__ == "__main__":
    main()
