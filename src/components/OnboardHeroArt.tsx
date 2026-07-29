/** Higher-detail schematic illustrations for onboarding heroes. */

type ArtProps = { className?: string };

export function MapsImportArt({ className = "" }: ArtProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 168"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="mapsCard" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F8FAFC" />
        </linearGradient>
        <linearGradient id="mapsPin" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
        <filter id="mapsSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="6"
            floodColor="#0F172A"
            floodOpacity="0.08"
          />
        </filter>
      </defs>

      {/* Map board */}
      <rect
        x="18"
        y="22"
        width="124"
        height="124"
        rx="16"
        fill="url(#mapsCard)"
        stroke="#E2E8F0"
        filter="url(#mapsSoft)"
      />
      <rect x="18" y="22" width="124" height="28" rx="16" fill="#F1F5F9" />
      <rect x="18" y="36" width="124" height="14" fill="#F1F5F9" />
      <circle cx="34" cy="36" r="3.5" fill="#FCA5A5" />
      <circle cx="46" cy="36" r="3.5" fill="#FCD34D" />
      <circle cx="58" cy="36" r="3.5" fill="#86EFAC" />

      {/* Map roads */}
      <path
        d="M34 72h92M34 92h70M34 112h84"
        stroke="#E2E8F0"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M58 58v72M98 58v48"
        stroke="#F1F5F9"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M34 72h92M34 92h70M34 112h84M58 58v72M98 58v48"
        stroke="#CBD5E1"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="4 6"
      />

      {/* Pin */}
      <g filter="url(#mapsSoft)">
        <path
          d="M100 68c-11.05 0-20 8.73-20 19.5C80 105.5 100 128 100 128s20-22.5 20-40.5C120 76.73 111.05 68 100 68z"
          fill="url(#mapsPin)"
        />
        <circle cx="100" cy="88" r="7" fill="#ECFDF5" />
        <circle cx="100" cy="88" r="3.5" fill="#0D9488" />
      </g>

      {/* Floating listing card */}
      <g filter="url(#mapsSoft)">
        <rect
          x="118"
          y="96"
          width="84"
          height="56"
          rx="12"
          fill="#FFFFFF"
          stroke="#E2E8F0"
        />
        <rect x="130" y="108" width="28" height="28" rx="8" fill="#CCFBF1" />
        <path
          d="M139 122c0-3.3 2.7-6 6-6s6 2.7 6 6c0 4.5-6 10-6 10s-6-5.5-6-10z"
          fill="#0D9488"
        />
        <circle cx="145" cy="122" r="2" fill="#FFF" />
        <rect x="166" y="110" width="24" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="166" y="120" width="28" height="4" rx="2" fill="#E2E8F0" />
        <rect x="166" y="128" width="18" height="4" rx="2" fill="#E2E8F0" />
      </g>

      {/* Link cue */}
      <path
        d="M148 78h28"
        stroke="#F59E0B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="3 4"
      />
      <circle cx="180" cy="78" r="8" fill="#FFFBEB" stroke="#FCD34D" />
      <path
        d="M177 78h6M180 75v6"
        stroke="#D97706"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AiJsonArt({ className = "" }: ArtProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 168"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="aiPrompt" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#F0FDFA" />
          <stop offset="1" stopColor="#CCFBF1" />
        </linearGradient>
        <filter id="aiSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="6"
            floodColor="#0F172A"
            floodOpacity="0.08"
          />
        </filter>
      </defs>

      {/* Prompt card */}
      <g filter="url(#aiSoft)">
        <rect
          x="16"
          y="28"
          width="78"
          height="112"
          rx="14"
          fill="url(#aiPrompt)"
          stroke="#99F6E4"
        />
        <rect x="28" y="42" width="36" height="7" rx="3.5" fill="#5EEAD4" />
        <path
          d="M28 62h54M28 74h42M28 86h50M28 98h34M28 110h46"
          stroke="#2DD4BF"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>

      {/* Arrow hub */}
      <circle cx="110" cy="84" r="16" fill="#0D9488" filter="url(#aiSoft)" />
      <path
        d="M103 84h12"
        stroke="#FFF"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M112 78l7 6-7 6"
        stroke="#FFF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* JSON card */}
      <g filter="url(#aiSoft)">
        <rect
          x="126"
          y="28"
          width="78"
          height="112"
          rx="14"
          fill="#FFFFFF"
          stroke="#E2E8F0"
        />
        <rect x="126" y="28" width="78" height="26" rx="14" fill="#F8FAFC" />
        <rect x="126" y="40" width="78" height="14" fill="#F8FAFC" />
        <circle cx="140" cy="41" r="3" fill="#FCA5A5" />
        <circle cx="150" cy="41" r="3" fill="#FCD34D" />
        <circle cx="160" cy="41" r="3" fill="#86EFAC" />

        <path
          d="M144 72c-5 0-8 3.5-8 8.5v12c0 5 3 8.5 8 8.5"
          stroke="#0F766E"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M186 72c5 0 8 3.5 8 8.5v12c0 5-3 8.5-8 8.5"
          stroke="#0F766E"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M148 108h40M148 120h28"
          stroke="#CBD5E1"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function FormOnboardArt({ className = "" }: ArtProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 168"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="formSheet" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F8FAFC" />
        </linearGradient>
        <filter id="formSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="6"
            floodColor="#0F172A"
            floodOpacity="0.08"
          />
        </filter>
      </defs>

      {/* Back sheet */}
      <rect
        x="48"
        y="18"
        width="118"
        height="132"
        rx="16"
        fill="#F1F5F9"
        stroke="#E2E8F0"
        transform="rotate(4 107 84)"
      />

      {/* Main form */}
      <g filter="url(#formSoft)">
        <rect
          x="40"
          y="22"
          width="118"
          height="132"
          rx="16"
          fill="url(#formSheet)"
          stroke="#E2E8F0"
        />
        <rect x="56" y="38" width="48" height="8" rx="4" fill="#99F6E4" />
        <rect x="56" y="56" width="86" height="14" rx="7" fill="#F1F5F9" stroke="#E2E8F0" />
        <rect x="56" y="78" width="86" height="14" rx="7" fill="#F1F5F9" stroke="#E2E8F0" />
        <rect x="56" y="100" width="54" height="14" rx="7" fill="#F1F5F9" stroke="#E2E8F0" />
        <rect x="116" y="100" width="26" height="14" rx="7" fill="#CCFBF1" stroke="#99F6E4" />
        <rect x="56" y="126" width="52" height="16" rx="8" fill="#0D9488" />
        <path
          d="M72 134h20"
          stroke="#ECFDF5"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      {/* Success badge */}
      <g filter="url(#formSoft)">
        <circle cx="168" cy="44" r="22" fill="#ECFDF5" stroke="#99F6E4" />
        <path
          d="M158 44l6.5 6.5 13-13"
          stroke="#0D9488"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
