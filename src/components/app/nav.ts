export const NAV = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/documents", label: "My Documents", exact: false },
  { href: "/dashboard/assistant", label: "AI Assistant", exact: false },
  { href: "/dashboard/history", label: "Chat History", exact: false },
  { href: "/dashboard/settings", label: "Settings", exact: false },
] as const;

export function isActivePath(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
