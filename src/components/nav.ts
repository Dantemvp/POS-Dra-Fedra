import type { Rol } from "@/lib/auth";

export type AreaTrabajo = "farmacia" | "consultorio";
export type GrupoNav = AreaTrabajo | "general" | "gestion";

export type NavItem = {
  href: string;
  label: string;
  roles: Rol[];
  grupo: GrupoNav;
  ready: boolean;
};

// Las rutas y sus permisos no cambian: el grupo solo organiza su presentación.
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", roles: ["admin", "farmacia", "doctora", "asistente", "gerente"], grupo: "general", ready: true },
  { href: "/ventas", label: "Punto de venta", roles: ["admin", "farmacia", "gerente"], grupo: "farmacia", ready: true },
  { href: "/inventario", label: "Inventario", roles: ["admin", "farmacia", "gerente"], grupo: "farmacia", ready: true },
  { href: "/compras", label: "Compras", roles: ["admin", "farmacia", "gerente"], grupo: "farmacia", ready: true },
  { href: "/caja", label: "Caja y reportes", roles: ["admin", "farmacia", "gerente"], grupo: "farmacia", ready: true },
  { href: "/pacientes", label: "Pacientes", roles: ["admin", "doctora", "asistente", "gerente"], grupo: "consultorio", ready: true },
  { href: "/agenda", label: "Agenda", roles: ["admin", "doctora", "asistente", "gerente"], grupo: "consultorio", ready: true },
  { href: "/recetas", label: "Recetas", roles: ["admin", "doctora", "gerente"], grupo: "consultorio", ready: true },
  { href: "/cobros", label: "Cobros", roles: ["admin", "doctora", "asistente", "gerente"], grupo: "consultorio", ready: true },
  { href: "/servicios", label: "Servicios", roles: ["admin", "doctora", "gerente"], grupo: "consultorio", ready: true },
  { href: "/cortes", label: "Cortes", roles: ["admin", "doctora", "gerente"], grupo: "gestion", ready: true },
  { href: "/movimientos", label: "Movimientos", roles: ["admin", "doctora"], grupo: "gestion", ready: true },
  { href: "/usuarios", label: "Usuarios", roles: ["admin"], grupo: "gestion", ready: true },
  { href: "/notificaciones", label: "Notificaciones", roles: ["admin", "farmacia", "doctora", "asistente", "gerente"], grupo: "general", ready: true },
];

export function navParaRol(rol: Rol): NavItem[] {
  return NAV.filter((item) => item.roles.includes(rol));
}

export function areasParaRol(rol: Rol): AreaTrabajo[] {
  const items = navParaRol(rol);
  return (["farmacia", "consultorio"] as const).filter((area) =>
    items.some((item) => item.grupo === area),
  );
}

export function areaInicialParaRol(rol: Rol): AreaTrabajo {
  return rol === "farmacia" ? "farmacia" : "consultorio";
}
