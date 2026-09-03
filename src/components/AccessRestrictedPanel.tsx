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
  const who =
    displayName?.trim() ||
    email?.split("@")[0] ||
    "your account";

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
          Your FinderB console login works, but no tabs are assigned yet.
          Ask a Controller to grant Read or Edit access so you can start
          working.
        </p>

        <div className={styles.identity}>
          <span className={styles.identityLabel}>Signed in</span>
          <span className={styles.identityValue}>{who}</span>
          {email && (
            <span className={styles.identityValue} style={{ opacity: 0.7 }}>
              · {email}
            </span>
          )}
          {role && (
            <span className={styles.pill}>{role.replace(/_/g, " ")}</span>
          )}
        </div>

        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <div>
              <p className={styles.stepTitle}>Message your Controller</p>
              <p className={styles.stepCopy}>
                Share this email and ask them to open Manage Admins → set your
                tab permissions.
              </p>
            </div>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <div>
              <p className={styles.stepTitle}>Wait for tab access</p>
              <p className={styles.stepCopy}>
                Once permissions are saved, refresh this page — your console
                will unlock automatically.
              </p>
            </div>
          </li>
        </ol>

        <div className={styles.actions}>
          {onRetry && (
            <button type="button" className={styles.primary} onClick={onRetry}>
              Refresh access
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={onSignOut}>
            Sign out
          </button>
        </div>

        <p className={styles.footnote}>
          Need help fast? Contact the FinderB Controller or platform owner.
        </p>
      </div>
    </div>
  );
}
