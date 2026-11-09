/**
 * Node test runner for admin tab access (no vitest dependency).
 * Run: npx tsx src/lib/adminTabAccess.test.ts
 */
import assert from "node:assert/strict";
import {
  canAccessTab,
  canEditTab,
  canManageAdmins,
  isConsoleLoginUnlocked,
  isPremiumConsoleRole,
  normalizeAccessFields,
  resolveTabAccess,
  sanitizeTabModes,
  allowedTabsFromModes,
  modesFromAllowedTabs,
  effectiveTabModes,
  type AdminAccessSession,
} from "./adminTabAccess";
import {
  clampLockoutSeconds,
  formatLockModalBody,
  DEFAULT_LOCKOUT_SECONDS,
} from "./lockModal";

const ALL_TABS = [
  "Dashboard",
  "Users",
  "Merchants",
  "Merchant Support Login",
  "Business Onboarding",
  "Quick Onboard",
  "Leads",
  "Categories",
  "Movies",
  "Tourist Places",
  "Payments & Subscriptions",
  "Broadcasts",
  "Broadcast Email",
  "Blogs",
  "YouTube Playlists",
  "FinderB Jobs",
  "Settings",
  "Site Configurations",
  "Reviews",
  "Change Requests",
  "Ownership Requests",
  "Ads Request",
  "Job Reports",
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
    if (session.role === "developer") return true;
    if (session.role === "controller") {
      return (
        name !== "Manage Admins" &&
        name !== "Merchant Support Login" &&
        name !== "Reviews" &&
        name !== "Change Requests" &&
        name !== "Ownership Requests" &&
        name !== "Job Reports" &&
        name !== "Site Configurations"
      );
    }
    if (name === "Manage Admins" || COMING_SOON.has(name)) return false;
    return canAccessTab(session, name);
  });
}

// Developer owns every tab, including Manage Admins (taken from controller)
assert.equal(resolveTabAccess({ role: "developer" }, "Manage Admins"), "edit");
assert.equal(resolveTabAccess({ role: "developer" }, "News"), "edit");
assert.equal(resolveTabAccess({ role: "developer" }, "Blogs"), "edit");
assert.equal(canManageAdmins("developer"), true);
assert.deepEqual(menuFor({ role: "developer" }).includes("Manage Admins"), true);

// Controller keeps operational tabs but not Manage Admins / Support Login
assert.equal(resolveTabAccess({ role: "controller" }, "Manage Admins"), "none");
assert.equal(
  resolveTabAccess({ role: "controller" }, "Merchant Support Login"),
  "none",
);
assert.equal(resolveTabAccess({ role: "controller" }, "News"), "edit");
assert.equal(resolveTabAccess({ role: "controller" }, "Blogs"), "edit");
assert.equal(canManageAdmins("controller"), false);
assert.equal(menuFor({ role: "controller" }).includes("Manage Admins"), false);
assert.equal(
  resolveTabAccess(
    { role: "controller", allowed_tab_modes: { Blogs: "read" } },
    "Blogs",
  ),
  "read",
);
assert.equal(
  resolveTabAccess(
    { role: "controller", allowed_tab_modes: { Blogs: "read" } },
    "Merchants",
  ),
  "none",
);
assert.equal(
  menuFor({ role: "controller" }).includes("Merchant Support Login"),
  false,
);
assert.equal(menuFor({ role: "controller" }).includes("Reviews"), false);
assert.equal(menuFor({ role: "controller" }).includes("Change Requests"), false);
assert.equal(
  resolveTabAccess({ role: "controller" }, "Reviews"),
  "none",
);
assert.equal(
  resolveTabAccess({ role: "controller" }, "Change Requests"),
  "none",
);
assert.equal(
  resolveTabAccess({ role: "controller" }, "Ownership Requests"),
  "none",
);
assert.equal(menuFor({ role: "controller" }).includes("Ownership Requests"), false);
assert.equal(resolveTabAccess({ role: "controller" }, "Job Reports"), "none");
assert.equal(menuFor({ role: "controller" }).includes("Job Reports"), false);
assert.equal(
  resolveTabAccess(
    { role: "admin", allowed_tab_modes: { "Payments & Subscriptions": "edit" } },
    "Business Promotions",
  ),
  "edit",
);
assert.equal(
  resolveTabAccess(
    { role: "admin", allowed_tab_modes: { "Payments & Subscriptions": "edit" } },
    "Ads Request",
  ),
  "edit",
);
assert.equal(
  resolveTabAccess(
    { role: "admin", allowed_tab_modes: { Merchants: "edit" } },
    "Ads Request",
  ),
  "none",
);
assert.equal(resolveTabAccess({ role: "developer" }, "Site Configurations"), "edit");
assert.equal(resolveTabAccess({ role: "controller" }, "Site Configurations"), "none");
assert.equal(menuFor({ role: "controller" }).includes("Site Configurations"), false);
assert.equal(
  resolveTabAccess(
    { role: "admin", allowed_tab_modes: { "Site Configurations": "edit" } },
    "Site Configurations",
  ),
  "edit",
);
assert.equal(
  resolveTabAccess(
    { role: "admin", allowed_tab_modes: { "Ownership Requests": "edit" } },
    "Ownership Requests",
  ),
  "edit",
);
assert.equal(
  resolveTabAccess(
    { role: "controller", allowed_tab_modes: { Reviews: "edit" } },
    "Reviews",
  ),
  "edit",
);
assert.equal(resolveTabAccess({ role: "developer" }, "Reviews"), "edit");
assert.equal(isPremiumConsoleRole("developer"), true);
assert.equal(isPremiumConsoleRole("controller"), false);
assert.equal(isPremiumConsoleRole("super_admin"), false);

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
  assert.equal(canAccessTab(session, "Broadcast Email"), false);
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

assert.equal(isConsoleLoginUnlocked("developer", false), true);
assert.equal(isConsoleLoginUnlocked("developer", null), true);
assert.equal(isConsoleLoginUnlocked("super_admin", false), false);
assert.equal(isConsoleLoginUnlocked("super_admin", true), true);
assert.equal(isConsoleLoginUnlocked("admin", undefined), false);
assert.equal(isConsoleLoginUnlocked("controller", false), false);

assert.equal(DEFAULT_LOCKOUT_SECONDS, 60);
assert.equal(clampLockoutSeconds(60), 60);
assert.equal(clampLockoutSeconds(5), 10);
assert.equal(
  formatLockModalBody("You'll be auto logged out in {countdown}.", 60),
  "You'll be auto logged out in 60 seconds.",
);

console.log("adminTabAccess tests: all passed");
