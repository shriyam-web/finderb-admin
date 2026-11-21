"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Momo from "./Momo";

const MOMO_INTRO_UNTIL = Date.parse("2026-11-24T23:59:59+05:30");
const MOMO_INTRO_SEEN = "momo_intro_seen";

export default function MomoIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Date.now() > MOMO_INTRO_UNTIL) return;
    try {
      if (sessionStorage.getItem(MOMO_INTRO_SEEN) === "1") return;
    } catch {
      return;
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      try {
        sessionStorage.setItem(MOMO_INTRO_SEEN, "1");
      } catch {
        /* ignore */
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const button = document.getElementById("momo-intro-close");
    button?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const close = () => {
    try {
      sessionStorage.setItem(MOMO_INTRO_SEEN, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return createPortal(
    <div className="admin-momo-intro-root" role="presentation" onMouseDown={close}>
      <div
        className="admin-momo-intro"
        role="dialog"
        aria-modal="true"
        aria-labelledby="momo-intro-title"
        aria-describedby="momo-intro-copy"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-momo-stage admin-momo-stage-intro">
          <span className="admin-momo-star admin-momo-star-a" aria-hidden />
          <span className="admin-momo-star admin-momo-star-b" aria-hidden />
          <span className="admin-momo-float-heart" aria-hidden />
          <Momo mood="wave" />
        </div>
        <h2 id="momo-intro-title">Meet Momo</h2>
        <p className="admin-momo-intro-role">A search bot from FinderB.</p>
        <div id="momo-intro-copy">
          <p>Momo looks through the panel and opens the right page.</p>
          <ul>
            <li>Merchants, users, leads, admins, payments, and settings</li>
            <li>A name, email, phone, or city</li>
          </ul>
          <p>Use Momo Search in the top bar, or press Ctrl+K.</p>
        </div>
        <button id="momo-intro-close" type="button" className="admin-momo-intro-close" onClick={close}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
