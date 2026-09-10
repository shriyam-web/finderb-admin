"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_LOCK_MODAL_COPY,
  formatLockModalBody,
  type LockModalCopy,
} from "../lib/lockModal";

type Props = {
  copy?: LockModalCopy;
  onLogout: () => void;
};

export default function SuspiciousLoginModal({
  copy = DEFAULT_LOCK_MODAL_COPY,
  onLogout,
}: Props) {
  const seconds = copy.logoutSeconds;
  const [left, setLeft] = useState(seconds);
  const [mounted, setMounted] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLeft(seconds);
    done.current = false;
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    const id = window.setInterval(() => {
      setLeft((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => {
      window.clearInterval(id);
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, [seconds]);

  useEffect(() => {
    if (left > 0 || done.current) return;
    done.current = true;
    onLogout();
  }, [left, onLogout]);

  if (!mounted) return null;

  const body = formatLockModalBody(copy.body, left);

  return createPortal(
    <div
      className="admin-lock-modal-root"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="suspicious-login-title"
      aria-describedby="suspicious-login-copy"
    >
      <div className="admin-lock-modal-backdrop" />
      <div className="admin-lock-modal-frame">
        <div className="admin-lock-modal-card">
          <div className="admin-lock-modal-accent" />
          <div className="admin-lock-modal-body">
            <div className="admin-lock-modal-icon" aria-hidden>
              <svg
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            {copy.eyebrow ? (
              <p className="admin-lock-modal-kicker">{copy.eyebrow}</p>
            ) : null}
            <h2 id="suspicious-login-title" className="admin-lock-modal-title">
              {copy.title}
            </h2>
            <p id="suspicious-login-copy" className="admin-lock-modal-text">
              {body}
            </p>
            <div className="admin-lock-modal-track">
              <div
                className="admin-lock-modal-bar"
                style={{ width: `${(left / seconds) * 100}%` }}
              />
            </div>
            {copy.footer ? (
              <p className="admin-lock-modal-footer">{copy.footer}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
