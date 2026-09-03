"use client";

import styles from "./AccessRestrictedPanel.module.css";

type AccessRestrictedPanelProps = {
  email?: string | null;
  role?: string | null;
  displayName?: string | null;
  onSignOut: () => void;
  onRetry?: () => void;
};

export default function AccessRestrictedPanel({
  email,
  role,
  displayName,
  onSignOut,
  onRetry,
}: AccessRestrictedPanelProps) {
  const who = displayName?.trim() || email || "Signed in";

  return (
    <div className={styles.root}>
      <div className={styles.grid} aria-hidden />

      <div className={styles.panel}>
        <span className={styles.badge}>
          <span className={styles.badgeDot} aria-hidden />
          Access locked
        </span>

        <div className={styles.iconStage} aria-hidden>
          <div className={styles.iconRing} />
          <div className={styles.icon}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z"
              />
            </svg>
          </div>
        </div>

        <h2 className={styles.title}>Access Restricted</h2>
        <p className={styles.copy}>
          No tabs assigned yet. Ask a Controller to grant access, then refresh.
        </p>

        <div className={styles.identity}>
          <span className={styles.identityValue}>{who}</span>
          {role && (
            <span className={styles.pill}>{role.replace(/_/g, " ")}</span>
          )}
        </div>

        <div className={styles.actions}>
          {onRetry && (
            <button type="button" className={styles.primary} onClick={onRetry}>
              Refresh
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
