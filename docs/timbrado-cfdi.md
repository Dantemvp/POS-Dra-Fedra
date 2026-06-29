# Timbrado CFDI 4.0 en el POS — investigación y recomendación

> Tarea ⑬ del meet 24-jun-2026. Estado: **investigación cerrada, pendiente decisión de Dra. Fedra para cotizar e implementar.** Nada de esto está construido aún; el POS hoy imprime un **ticket** con datos fiscales y leyenda, pero **no timbra** ante el SAT.

## Contexto fiscal de la farmacia

- **Razón social:** Fedra Yarissa Aldama Castro — **persona física**, RFC `AACF921225L23`.
- **Régimen:** RESICO (clave **626**). Tope para permanecer: $3.5 M MXN de ingresos anuales.
- **Operación:** farmacia (muchos tickets chicos) + consultorio (consultas/servicios). La mayoría de los tickets **no se facturan**; solo el cliente que lo pide.

Esto define el flujo correcto para una farmacia (no facturar venta por venta):

1. **Autofactura:** el cliente que quiere factura entra a un portal, captura el folio de su ticket + su RFC + uso de CFDI, y obtiene su CFDI solo.
2. **Factura global:** al cierre del día/mes, un CFDI global agrupa todos los tickets de "público en general" que nadie facturó.
3. **Factura directa:** desde el POS, para el cliente que pide factura en el momento.

## Qué se necesita para poder timbrar (requisito previo, sin código)

- **CSD (Certificado de Sello Digital)** de Fedra: lo tramita ella en el SAT (archivos `.cer` + `.key` + contraseña). Sin esto **nadie** puede timbrar a su nombre. Es el primer paso y depende 100% de ella.
- Validación en tiempo real del SAT: la clave de **uso de CFDI** debe ser compatible con RESICO o el PAC rechaza el timbre (ej. las deducciones personales D01–D10 **no** aplican para emitir desde 626; el cliente las usa como receptor).
- Cada producto necesita su **ClaveProdServ** y **ClaveUnidad** del catálogo SAT (medicamentos suelen ir en 5141xxxx; consulta médica 85121800). Hoy el inventario no las guarda.

## PAC recomendado: **FacturAPI**

Es el más limpio para nuestro stack (Next.js + Supabase): API REST moderna, SDK JS, **modo de pruebas gratis 14 días sin tarjeta** para desarrollar sin riesgo, y pago por uso (ideal porque la farmacia factura pocos tickets de los que vende — no desperdiciamos folios de un paquete fijo).

### Costos reales (2026)

| Concepto | FacturAPI | Facturama (alternativa) |
|---|---|---|
| Renta API base | **$299/mes** | desde $490/mes |
| Por timbre | **$0.60 c/u** | incluido en folios del plan |
| Autofactura + factura global | producto aparte **"E-Receipts"** $599/mes | varía por plan |
| Sandbox para desarrollar | **Gratis 14 días** | sí |

**Dos escenarios para Fedra:**

- **Mínimo viable (factura directa + global desde el POS, sin portal público):** solo Licencia API → **$299/mes + $0.60 × facturas emitidas**. Para ~50 facturas/mes ≈ **$329/mes**. La factura global se genera con la misma API.
- **Completo (con portal de autofactura para que el cliente se facture solo):** $299 + $599 = **$898/mes**. Solo se justifica si hay volumen real de clientes pidiendo factura.

> Recomendación: arrancar con el **mínimo viable** (timbrar la venta directa + global diaria desde el POS). El portal de autofactura es Fase posterior, cuando se vea demanda.

## Plan de implementación (para cotizar)

| Fase | Qué incluye | Riesgo |
|---|---|---|
| **A. Config (sin código)** | Fedra tramita CSD en el SAT; alta en FacturAPI; subir CSD al PAC | Depende de Fedra |
| **B. Catálogo SAT** | Migración aditiva: `clave_prod_serv` + `clave_unidad` en `productos`; default genérico para no bloquear | Bajo |
| **C. Timbrar venta** | Server action `timbrarVenta(ventaId, receptor)` → FacturAPI → guardar UUID/PDF/XML ligado a la venta; botón en detalle de venta/caja | Medio |
| **D. Factura global** | Job diario que agrupa tickets no facturados en un CFDI global | Medio |
| **E. Autofactura (opcional)** | Página pública `/factura`: cliente captura folio + RFC + uso | Medio |

Lo que **ya está listo** y se reutiliza: los datos fiscales del emisor (`src/lib/fiscal.ts`), el folio de venta, y el ticket impreso.

## Decisiones que necesita tomar Dante / Dra. Fedra

1. ¿Arrancamos **mínimo viable** ($299/mes) o **completo con autofactura** ($898/mes)?
2. ¿Fedra ya tiene su **CSD** del SAT? (bloquea todo lo demás).
3. ¿Confirmamos **FacturAPI** o se prefiere otro PAC con el que ya trabaje su contador?
4. Costo mensual del PAC: ¿lo absorbe la farmacia como gasto operativo? (entra al presupuesto del proyecto).

---

### Fuentes
- FacturAPI — precios: https://www.facturapi.io/pricing
- Facturama — planes: https://facturama.mx/planes-facturacion
- CFDI 4.0 según régimen fiscal (RESICO): https://www.fiscalify.com/blog/uso-cfdi-segun-regimen-fiscal
- Cómo facturar en RESICO (CFDI 4.0): https://resicocalc.com/blog/como-facturar-resico-cfdi
- Anexo 20 SAT 2026 (llenado CFDI 4.0): https://siemprealdia.co/mexico/fiscal/anexo-20-sat-cfdi-4-0/
