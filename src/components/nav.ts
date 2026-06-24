import type { Rol } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  roles: Rol[];
  ready: boolean; // false = aún no construido (se muestra deshabilitado)
};

// Navegación compartida por el sidebar de escritorio y el menú móvil.
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", roles: ["admin", "farmacia", "doctora", "asistente", "gerente"], ready: true },
  { href: "/inventario", label: "Inventario", roles: ["admin", "farmacia", "gerente"], ready: true },
  { href: "/compras", label: "Compras", roles: ["admin", "farmacia", "gerente"], ready: true },
  { href: "/ventas", label: "Punto de venta", roles: ["admin", "farmacia", "gerente"], ready: true },
  { href: "/caja", label: "Caja y reportes", roles: ["admin", "farmacia", "gerente"], ready: true },
  { href: "/pacientes", label: "Pacientes", roles: ["admin", "doctora", "asistente", "gerente"], ready: true },
  { href: "/agenda", label: "Agenda", roles: ["admin", "doctora", "asistente", "gerente"], ready: true },
  { href: "/recetas", label: "Recetas", roles: ["admin", "doctora", "gerente"], ready: true },
  { href: "/cobros", label: "Cobros", roles: ["admin", "doctora", "asistente", "gerente"], ready: true },
  { href: "/servicios", label: "Servicios", roles: ["admin", "doctora", "gerente"], ready: true },
  { href: "/movimientos", label: "Movimientos", roles: ["admin", "doctora"], ready: true },
  { href: "/usuarios", label: "Usuarios", roles: ["admin"], ready: true },
  { href: "/notificaciones", label: "Notificaciones", roles: ["admin", "farmacia", "doctora", "asistente", "gerente"], ready: true },
];

export function navParaRol(rol: Rol): NavItem[] {
  return NAV.filter((i) => i.roles.includes(rol));
}
