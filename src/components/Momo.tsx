export type MomoMood = "look" | "wave" | "happy" | "curious" | "sad" | "yawn" | "sleep" | "run" | "workout" | "peek" | "dash" | "walk";

export default function Momo({ mood = "look", className = "" }: { mood?: MomoMood; className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={`admin-momo is-${mood}${className ? ` ${className}` : ""}`} aria-hidden overflow="visible">
      <ellipse className="admin-momo-shadow" cx="40" cy="75.5" rx="15" ry="2.4" fill="#9a3412" />
      <g className="admin-momo-nap">
        <ellipse cx="44" cy="66" rx="24" ry="3" fill="#9a3412" opacity="0.14" />
        <ellipse cx="52" cy="48" rx="22" ry="15" fill="#ff9a45" />
        <ellipse cx="56" cy="52" rx="11" ry="8" fill="#fff8f3" />
        <ellipse cx="16" cy="30" rx="6.2" ry="9" fill="#ff8a3d" transform="rotate(-30 16 30)" />
        <ellipse cx="17" cy="31.5" rx="3.1" ry="5" fill="#ffd4e0" transform="rotate(-30 17 31.5)" />
        <ellipse cx="34" cy="26" rx="6.2" ry="9" fill="#ff7d32" transform="rotate(16 34 26)" />
        <ellipse cx="34" cy="27.5" rx="3.1" ry="5" fill="#ffd4e0" transform="rotate(16 34 27.5)" />
        <circle cx="24" cy="42" r="15.5" fill="#ff9a45" />
        <ellipse cx="18" cy="36" rx="5.5" ry="3" fill="#fff" opacity="0.4" />
        <path d="M16 41.6c2.3 2.6 6.4 2.6 8.6 0" fill="none" stroke="#3b241c" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M26.2 40.8c2.3 2.6 6.4 2.6 8.6 0" fill="none" stroke="#3b241c" strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="14.2" cy="48" rx="2.8" ry="1.5" fill="#ff8fab" />
        <ellipse cx="33.4" cy="47.2" rx="2.8" ry="1.5" fill="#ff8fab" />
        <path d="M20 49.4c1.5 2.1 6.4 2.1 7.8 0" fill="none" stroke="#3b241c" strokeWidth="1.45" strokeLinecap="round" />
        <circle cx="40" cy="55" r="4.2" fill="#ffd7b8" />
        <ellipse cx="68" cy="58" rx="5.2" ry="2.7" fill="#ffc49a" />
      </g>
      <g className="admin-momo-zzz">
        <text x="60" y="20">z</text>
        <text x="68" y="13">z</text>
        <text x="75" y="7">z</text>
      </g>
      <g className="admin-momo-bob">
        <ellipse className="admin-momo-tuft" cx="40" cy="21" rx="5" ry="3.4" fill="#ffb067" />
        <g className="admin-momo-ear admin-momo-ear-l">
          <ellipse cx="20" cy="24" rx="11" ry="12" fill="#ffb067" />
          <ellipse cx="21" cy="26" rx="5.4" ry="6.4" fill="#ffe0ea" />
        </g>
        <g className="admin-momo-ear admin-momo-ear-r">
          <ellipse cx="60" cy="22" rx="11" ry="12" fill="#ff9a45" />
          <ellipse cx="59" cy="24" rx="5.4" ry="6.4" fill="#ffe0ea" />
        </g>
        <circle cx="40" cy="46" r="26" fill="#ff9a45" />
        <ellipse cx="29" cy="33" rx="11" ry="6" fill="#fff" opacity="0.55" />
        <ellipse className="admin-momo-foot admin-momo-foot-l" cx="30" cy="71.5" rx="6.2" ry="3.1" fill="#ffc9a4" />
        <ellipse className="admin-momo-foot admin-momo-foot-r" cx="50" cy="71.5" rx="6.2" ry="3.1" fill="#ffb888" />
        <g className="admin-momo-eye">
          <ellipse cx="29" cy="41.4" rx="8.8" ry="9.6" fill="#fff" />
          <g className="admin-momo-pupil">
            <circle cx="29.3" cy="42.2" r="5.2" fill="#1c1412" />
            <circle cx="31.3" cy="39.8" r="1.9" fill="#fff" />
            <circle cx="27.4" cy="43.9" r="0.75" fill="#fff" />
          </g>
          <ellipse className="admin-momo-lid" cx="29" cy="41.4" rx="9.1" ry="9.9" fill="#ff9a45" />
        </g>
        <g className="admin-momo-eye">
          <ellipse cx="51" cy="41.4" rx="8.8" ry="9.6" fill="#fff" />
          <g className="admin-momo-pupil">
            <circle cx="51.3" cy="42.2" r="5.2" fill="#1c1412" />
            <circle cx="53.3" cy="39.8" r="1.9" fill="#fff" />
            <circle cx="49.4" cy="43.9" r="0.75" fill="#fff" />
          </g>
          <ellipse className="admin-momo-lid" cx="51" cy="41.4" rx="9.1" ry="9.9" fill="#ff9a45" />
        </g>
        <path className="admin-momo-joy" d="M21.4 41.8c2.3-3.6 8.2-3.6 10.5 0" />
        <path className="admin-momo-joy" d="M43.4 41.8c2.3-3.6 8.2-3.6 10.5 0" />
        <path className="admin-momo-shut" d="M20.2 42.8c3 3.2 11.4 3.2 14.2 0" />
        <path className="admin-momo-shut" d="M42.2 42.8c3 3.2 11.4 3.2 14.2 0" />
        <ellipse className="admin-momo-blush" cx="17.5" cy="51.5" rx="5.2" ry="3" fill="#ff7eae" />
        <ellipse className="admin-momo-blush" cx="62.5" cy="51.5" rx="5.2" ry="3" fill="#ff7eae" />
        <ellipse className="admin-momo-tear" cx="59.4" cy="50.2" rx="1.35" ry="2.1" fill="#7dd3fc" />
        <ellipse className="admin-momo-nose" cx="40" cy="52.2" rx="2.35" ry="1.55" fill="#7a4636" />
        <ellipse cx="39.2" cy="51.75" rx="0.62" ry="0.38" fill="#fff" opacity="0.7" />
        <g className="admin-momo-mouth admin-momo-mouth-smile">
          <path d="M34.2 57.2C35.8 63.8 44.2 63.8 45.8 57.2 43.6 60.2 36.4 60.2 34.2 57.2Z" fill="#ff335c" />
        </g>
        <path className="admin-momo-mouth admin-momo-mouth-frown" d="M33.4 59.4c2.2-2.6 10.8-2.6 13 0" />
        <ellipse className="admin-momo-mouth admin-momo-mouth-o" cx="40" cy="58" rx="2.6" ry="2.2" />
        <g className="admin-momo-mouth admin-momo-mouth-yawn">
          <ellipse cx="40" cy="58.4" rx="4" ry="4.2" fill="#5c3a32" />
          <ellipse cx="40" cy="60.2" rx="2.3" ry="1.4" fill="#ff9bb5" />
        </g>
        <ellipse className="admin-momo-sweat" cx="64" cy="30" rx="1.7" ry="2.6" fill="#bae6fd" />
        <ellipse className="admin-momo-paw" cx="15" cy="56" rx="4.6" ry="3.3" fill="#ffd0ae" transform="rotate(20 15 56)" />
        <g className="admin-momo-arm">
          <ellipse cx="64" cy="48" rx="7.4" ry="3.5" fill="#ffd0ae" transform="rotate(-58 64 48)" />
          <circle cx="71" cy="38" r="4.8" fill="#ffe7d6" />
          <circle cx="69.6" cy="36.6" r="1.5" fill="#fff" opacity="0.9" />
        </g>
      </g>
    </svg>
  );
}
