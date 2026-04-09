"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useBranding, splitServerName } from "@/hooks/useBranding";
import {
  HiveIconSmall,
  DashboardIcon,
  GlobeIcon,
  SwordIcon,
  BookIcon,
  AdminShieldIcon,
  AccountIcon,
  UsersIcon,
  GuildIcon,
  SettingsIcon,
  BuildIcon,
  ManifestIcon,
} from "./Icons";

interface User {
  username: string;
  gmlevel: number;
}

interface NavBarProps {
  user: User;
}

const GM_LABELS: Record<number, string> = {
  0: "Player",
  1: "Moderator",
  2: "Game Master",
  3: "Administrator",
  4: "Console",
};

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ComponentType<IconProps>;
  pathname: string;
}

function NavLink({ href, label, icon: Icon, pathname }: NavLinkProps) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 16px",
        marginBottom: -1,
        borderBottom: active
          ? "2px solid var(--accent)"
          : "2px solid transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        textDecoration: "none",
        transition: "all 0.15s",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <Icon active={active} />
      {label}
    </Link>
  );
}

interface IconProps {
  active?: boolean;
  size?: number;
}

interface NavDropdownItem {
  href: string;
  label: string;
  icon: React.ComponentType<IconProps>;
}

interface NavDropdownProps {
  label: string;
  icon: React.ComponentType<IconProps>;
  items: NavDropdownItem[];
  pathname: string;
}

function NavDropdown({ label, icon: Icon, items, pathname }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActiveGroup = items.some((i) => pathname.startsWith(i.href));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          marginBottom: -1,
          background: "none",
          border: "none",
          borderBottom: isActiveGroup
            ? "2px solid var(--accent)"
            : "2px solid transparent",
          color: isActiveGroup ? "var(--text-primary)" : "var(--text-secondary)",
          fontSize: 14,
          fontWeight: isActiveGroup ? 600 : 500,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        <Icon active={isActiveGroup} />
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginLeft: 2,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 1px)",
            left: 0,
            minWidth: 200,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 0",
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            animation: "slideIn 0.15s ease",
          }}
        >
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  textDecoration: "none",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = active
                    ? "#f59e0b"
                    : "var(--text-secondary)";
                }}
              >
                <ItemIcon active={active} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NavBar({ user }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const branding = useBranding();
  const brandName = splitServerName(branding);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [realms, setRealms] = useState<Array<{ id: number; name: string }>>([]);
  const isAdmin = user.gmlevel >= 3;

  useEffect(() => {
    fetch("/api/realms")
      .then((r) => r.json())
      .then((data) => { if (data.realms) setRealms(data.realms); })
      .catch(() => {});
  }, []);

  const adminItems: NavDropdownItem[] = [
    { href: "/accounts", label: "Accounts", icon: AccountIcon },
    { href: "/realms", label: "Realms", icon: GlobeIcon },
    { href: "/builds", label: "Builds", icon: BuildIcon },
    { href: "/manifests", label: "Manifests", icon: ManifestIcon },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  const onlineItems: NavDropdownItem[] = realms.map((r) => ({
    href: `/online/${r.id}`,
    label: r.name,
    icon: UsersIcon,
  }));

  const guildItems: NavDropdownItem[] = realms.map((r) => ({
    href: `/guilds/${r.id}`,
    label: r.name,
    icon: GuildIcon,
  }));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 28,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Brand */}
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginRight: 32,
            paddingBottom: 12,
            textDecoration: "none",
          }}
        >
          <HiveIconSmall />
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>
            <span style={{ color: "var(--text-primary)" }}>{brandName.base}</span>
            {brandName.accent && (
              <span style={{ color: "var(--accent)" }}>{brandName.accent}</span>
            )}
          </span>
        </Link>

        {/* Nav links */}
        <NavLink
          href="/dashboard"
          label="Dashboard"
          icon={DashboardIcon}
          pathname={pathname}
        />
        <NavLink
          href="/armory"
          label="Armory"
          icon={SwordIcon}
          pathname={pathname}
        />
        {realms.length === 1 ? (
          <NavLink
            href={`/online/${realms[0].id}`}
            label="Who's Online"
            icon={UsersIcon}
            pathname={pathname}
          />
        ) : realms.length > 1 ? (
          <NavDropdown
            label="Who's Online"
            icon={UsersIcon}
            items={onlineItems}
            pathname={pathname}
          />
        ) : null}
        {realms.length === 1 ? (
          <NavLink
            href={`/guilds/${realms[0].id}`}
            label="Guilds"
            icon={GuildIcon}
            pathname={pathname}
          />
        ) : realms.length > 1 ? (
          <NavDropdown
            label="Guilds"
            icon={GuildIcon}
            items={guildItems}
            pathname={pathname}
          />
        ) : null}
        <NavLink
          href="/getting-started"
          label="Getting Started"
          icon={BookIcon}
          pathname={pathname}
        />
        {isAdmin && (
          <NavDropdown
            label="Admin"
            icon={AdminShieldIcon}
            items={adminItems}
            pathname={pathname}
          />
        )}

        {/* Right side: user dropdown */}
        <div
          ref={userMenuRef}
          style={{
            marginLeft: "auto",
            position: "relative",
            paddingBottom: 12,
          }}
        >
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {user.username}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {GM_LABELS[user.gmlevel] ?? `GM Level ${user.gmlevel}`}
              </div>
            </div>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-secondary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: userMenuOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {userMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                minWidth: 180,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 0",
                zIndex: 100,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                animation: "slideIn 0.15s ease",
              }}
            >
              <Link
                href="/my/settings"
                onClick={() => setUserMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px",
                  color: pathname.startsWith("/my/settings") ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = pathname.startsWith("/my/settings") ? "var(--accent)" : "var(--text-secondary)";
                }}
              >
                <SettingsIcon active={pathname.startsWith("/my/settings")} />
                My Settings
              </Link>
              <Link
                href="/my/characters"
                onClick={() => setUserMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px",
                  color: pathname.startsWith("/my/characters") ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = pathname.startsWith("/my/characters") ? "var(--accent)" : "var(--text-secondary)";
                }}
              >
                <SwordIcon active={pathname.startsWith("/my/characters")} />
                My Characters
              </Link>
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  handleLogout();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px",
                  width: "100%",
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.1s",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--red)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
