import type { PushResultado } from "./push";

export function estadoPush(resultado: PushResultado): "ok" | "parcial" | "fallo" {
  if (resultado.enviadas === resultado.destinatarios && resultado.enviadas > 0) return "ok";
  if (resultado.enviadas > 0) return "parcial";
  return "fallo";
}

export function mensajePush(resultado: PushResultado): string {
  switch (resultado.motivo) {
    case "sin_configuracion":
      return "Las notificaciones no están configuradas en el servidor.";
    case "sin_destinatarios":
      return "No hay dispositivos suscritos para este aviso.";
    case "error_consulta":
      return "No se pudieron consultar las suscripciones.";
    case "fallos_envio":
      return resultado.enviadas > 0
        ? `Se enviaron ${resultado.enviadas} de ${resultado.destinatarios} notificaciones.`
        : "El proveedor rechazó todas las notificaciones.";
    default:
      return resultado.enviadas > 0
        ? `Se enviaron ${resultado.enviadas} notificaciones.`
        : "No se envió ninguna notificación.";
  }
}
