/**
 * Node test runner for admin tab access (no vitest dependency).
 * Run: npx tsx src/lib/adminTabAccess.test.ts
 */
import assert from "node:assert/strict";
import {
  canAccessTab,
  canEditTab,
  normalizeAccessFields,
  resolveTabAccess,
  sanitizeTabModes,
  allowedTabsFromModes,
  modesFromAllowedTabs,
  effectiveTabModes,
  type AdminAccessSession,
} from "./adminTabAccess";

const ALL_TABS = [
  "Dashboard",
  "Users",
  "Merchants",
  "Business Onboarding",
  "Quick Onboard",
  "Leads",
  "Categories",
  "Movies",
  "Tourist Places",
  "Payments & Subscriptions",
  "Broadcasts",
  "Blogs",
  "YouTube Playlists",
  "FinderB Jobs",
  "Settings",
  "News",
  "FinderB E-commerce",
  "Manage Admins",
] as const;

const COMING_SOON = new Set(["News", "FinderB E-commerce"]);

function accessible(session: Parameters<typeof canAccessTab>[0]) {
  return ALL_TABS.filter((t) => canAccessTab(session, t));
}

function menuFor(session: AdminAccessSession) {
  return ALL_TABS.filter((name) => {
    if (session.role === "controller") return true;
    if (name === "Manage Admins" || COMING_SOON.has(name)) return false;
    return canAccessTab(session, name);
  });
}

// Controllers see everything including Manage Admins / coming soon via role check
assert.equal(resolveTabAccess({ role: "controller" }, "Manage Admins"), "edit");
assert.equal(resolveTabAccess({ role: "controller" }, "News"), "edit");
assert.equal(resolveTabAccess({ role: "controller" }, "Blogs"), "edit");

// Exactly 2 granted tabs — nothing else
{
  const session = {
    role: "admin",
    allowed_tabs: ["Merchants", "Blogs"],
    allowed_tab_modes: { Merchants: "read", Blogs: "edit" } as const,
  };
  assert.deepEqual(accessible(session).sort(), ["Blogs", "Merchants"]);
  assert.equal(canEditTab(session, "Blogs"), true);
  assert.equal(canEditTab(session, "Merchants"), false);
  assert.equal(canAccessTab(session, "Dashboard"), false);
  assert.equal(canAccessTab(session, "Users"), false);
  assert.equal(canAccessTab(session, "Quick Onboard"), false);
  assert.equal(canAccessTab(session, "Business Onboarding"), false);
  assert.equal(canAccessTab(session, "News"), false);
  assert.equal(canAccessTab(session, "Manage Admins"), false);
}

// Empty modes object + fat legacy tabs must DENY (modes column is authoritative)
{
  const session = {
    role: "super_admin",
    allowed_tabs: [
      "Dashboard",
      "Users",
      "Merchants",
      "Leads",
      "Movies",
      "Categories",
      "Tourist Places",
      "Broadcasts",
      "News",
      "Blogs",
      "FinderB Jobs",
      "Settings",
      "Business Onboarding",
      "YouTube Playlists",
      "Quick Onboard",
    ],
    allowed_tab_modes: {},
  };
  assert.deepEqual(accessible(session), []);
}

// null modes + legacy tabs still works for pre-migration accounts
{
  const session = {
    role: "super_admin",
    allowed_tabs: ["Merchants", "Blogs"],
    allowed_tab_modes: null,
  };
  assert.deepEqual(accessible(session).sort(), ["Blogs", "Merchants"]);
}

// Modes win over fat allowed_tabs — the original bug case
{
  const session = {
    role: "admin",
    allowed_tabs: [
      "Dashboard",
      "Users",
      "Merchants",
      "Leads",
      "Movies",
      "Categories",
      "Blogs",
      "Settings",
    ],
    allowed_tab_modes: { Merchants: "read", Blogs: "read" } as const,
  };
  assert.deepEqual(accessible(session).sort(), ["Blogs", "Merchants"]);
}

// Menu filter + normalize: fat tabs in DB but only 2 modes
{
  const raw = {
    role: "admin",
    allowed_tabs: [...ALL_TABS.filter((n) => n !== "Manage Admins")],
    allowed_tab_modes: { Merchants: "edit", Blogs: "read" },
  };
  const access = normalizeAccessFields(raw.allowed_tabs, raw.allowed_tab_modes);
  const session = { role: raw.role, ...access };
  assert.deepEqual(menuFor(session).sort(), ["Blogs", "Merchants"]);
  assert.deepEqual(access.allowed_tabs.sort(), ["Blogs", "Merchants"]);
}

// Business Onboarding must NOT auto-grant Quick Onboard
{
  const session = {
    role: "admin",
    allowed_tabs: ["Business Onboarding"],
    allowed_tab_modes: { "Business Onboarding": "edit" } as const,
  };
  assert.equal(canAccessTab(session, "Business Onboarding"), true);
  assert.equal(canAccessTab(session, "Quick Onboard"), false);
  assert.equal(canAccessTab(session, "Merchants"), false);
}

// Merchants alone does not open onboarding tabs
{
  const session = {
    role: "admin",
    allowed_tabs: ["Merchants"],
    allowed_tab_modes: { Merchants: "edit" } as const,
  };
  assert.deepEqual(accessible(session), ["Merchants"]);
}

// Zero grants → locked
{
  const session = {
    role: "admin",
    allowed_tabs: [] as string[],
    allowed_tab_modes: {},
  };
  assert.deepEqual(accessible(session), []);
}

// normalizeAccessFields keeps tabs synced with modes
{
  const saved = normalizeAccessFields(
    ["Dashboard", "Users", "Merchants", "Blogs", "News"],
    { Merchants: "read", Blogs: "edit", Users: "none" },
  );
  assert.deepEqual(saved.allowed_tabs.sort(), ["Blogs", "Merchants"]);
  assert.deepEqual(saved.allowed_tab_modes, {
    Merchants: "read",
    Blogs: "edit",
  });
}

// sanitize drops none / junk
assert.deepEqual(
  sanitizeTabModes({ A: "edit", B: "none", C: "nope", D: "read" }),
  { A: "edit", D: "read" },
);

// Merchant Registration alias
assert.equal(
  resolveTabAccess(
    {
      role: "admin",
      allowed_tab_modes: { "Merchant Registration": "read" },
    },
    "Business Onboarding",
  ),
  "read",
);

assert.deepEqual(
  allowedTabsFromModes({ X: "edit", Y: "read", Z: "none" as never }),
  ["X", "Y"],
);

assert.deepEqual(modesFromAllowedTabs(["News", "Merchants"]), {
  Merchants: "edit",
});

assert.deepEqual(
  Object.keys(
    effectiveTabModes({
      allowed_tabs: ["Users"],
      allowed_tab_modes: null,
    }),
  ),
  ["Users"],
);

// Read vs edit: view allowed, mutate denied
{
  const session = {
    role: "admin",
    allowed_tabs: ["Blogs", "Merchants", "Broadcasts", "Settings"],
    allowed_tab_modes: {
      Blogs: "read",
      Merchants: "read",
      Broadcasts: "read",
      Settings: "edit",
    } as const,
  };
  assert.equal(canAccessTab(session, "Blogs"), true);
  assert.equal(canEditTab(session, "Blogs"), false);
  assert.equal(canAccessTab(session, "Merchants"), true);
  assert.equal(canEditTab(session, "Merchants"), false);
  assert.equal(canEditTab(session, "Broadcasts"), false);
  assert.equal(canEditTab(session, "Settings"), true);
  assert.equal(canAccessTab(session, "Users"), false);
}

// Edit grant allows both access + edit
{
  const session = {
    role: "super_admin",
    allowed_tab_modes: { Categories: "edit", Movies: "read" } as const,
  };
  assert.equal(canAccessTab(session, "Categories"), true);
  assert.equal(canEditTab(session, "Categories"), true);
  assert.equal(canAccessTab(session, "Movies"), true);
  assert.equal(canEditTab(session, "Movies"), false);
}

console.log("adminTabAccess tests: all passed");
