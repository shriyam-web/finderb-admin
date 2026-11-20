import { resolveTabAccess, type AdminAccessSession } from "./adminTabAccess";

export type AccessReportTab = {
  name: string;
  label: string;
};

function rightsLabel(mode: "read" | "edit"): string {
  return mode === "edit" ? "Edit rights" : "View rights";
}

/** Plain text an admin can paste when someone asks for their tab access. */
export function buildAccessReport(input: {
  email: string;
  generatedAt: Date;
  session: AdminAccessSession;
  tabs: AccessReportTab[];
}): string {
  const when = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(input.generatedAt);

  const lines = [
    `For email id ${input.email.trim() || "unknown"}`,
    `Report generated on ${when} IST`,
    "",
  ];

  const granted = input.tabs.flatMap((tab) => {
    const mode = resolveTabAccess(input.session, tab.name);
    if (mode === "none") return [];
    return [`${tab.label} - ${rightsLabel(mode)}`];
  });

  if (!granted.length) {
    lines.push("No tabs assigned.");
  } else {
    lines.push(...granted);
  }
  return lines.join("\n");
}
