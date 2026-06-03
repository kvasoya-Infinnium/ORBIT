// components/BrandIcon.jsx
// Real-brand SVG icons for each connector type. These render with the brand's
// own colors (multi-color where the official logo is multi-color), so the icon
// chips no longer rely on `currentColor` from .ttype-* classes — the brand
// shows through regardless of the surrounding theme.
//
// Usage:  <BrandIcon typeId="slack" size={18} />
//
// Falls back to the generic stroke icon set (Icon.jsx) for any unknown type.
import React from "react";
import Icon, { connectorIconName } from "./Icon.jsx";

// Each entry returns the inner SVG content for a 24x24 viewBox.
const BRANDS = {
  // Slack — official 4-color hash
  slack: (
    <g>
      <path fill="#36C5F0" d="M5.5 14.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm1.5 0h2a2 2 0 0 1 2 2v3.5a2 2 0 1 1-4 0z" />
      <path fill="#2EB67D" d="M9.5 18.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm0-1.5v-2a2 2 0 0 1 2-2h3.5a2 2 0 1 1 0 4z" />
      <path fill="#ECB22E" d="M18.5 9.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm-1.5 0h-2a2 2 0 0 1-2-2V4a2 2 0 1 1 4 0z" />
      <path fill="#E01E5A" d="M14.5 5.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 1.5v2a2 2 0 0 1-2 2H9a2 2 0 1 1 0-4z" />
    </g>
  ),

  // Notion — black "N" mark on a rounded card
  notion: (
    <g>
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#FFFFFF" />
      <rect x="2" y="2" width="20" height="20" rx="4" fill="none" stroke="#000" strokeWidth="1.4" />
      <path fill="#000" d="M8 6.5v11h1.7V10l5 7.5H17V6.5h-1.7v7.4L10.4 6.5z" />
    </g>
  ),

  // Gmail — multi-color envelope (red/blue/green/yellow)
  email: (
    <g>
      <path fill="#4285F4" d="M2 6.5C2 5.7 2.7 5 3.5 5H5l7 5.2L19 5h1.5c.8 0 1.5.7 1.5 1.5V18c0 .8-.7 1.5-1.5 1.5H19V9.5L12 14.6 5 9.5v10H3.5C2.7 19.5 2 18.8 2 18z" />
      <path fill="#34A853" d="M2 18c0 .8.7 1.5 1.5 1.5H5V9.5L2 7.2z" />
      <path fill="#FBBC04" d="M19 19.5h1.5c.8 0 1.5-.7 1.5-1.5V7.2l-3 2.3z" />
      <path fill="#EA4335" d="M5 9.5 2 7.2V6.5C2 5.7 2.7 5 3.5 5H5zm14 0V5h1.5c.8 0 1.5.7 1.5 1.5v.7z" />
      <path fill="#C5221F" d="M5 5h14l-7 5.2z" />
    </g>
  ),

  // AWS S3 — orange bucket with curved top
  s3: (
    <g>
      <path
        fill="#E25444"
        d="M5 6.5 12 4l7 2.5v11L12 20l-7-2.5z"
      />
      <path
        fill="#7B1D13"
        opacity=".25"
        d="M12 4v16l7-2.5v-11z"
      />
      <path
        fill="#FFFFFF"
        d="M9.2 10.4c0-.5.5-.9 1.4-1.2.6-.2 1.4-.3 2.2-.3.9 0 1.7.1 2.3.3.9.3 1.4.7 1.4 1.2v3.2c0 .5-.5.9-1.4 1.2-.6.2-1.4.3-2.3.3-.8 0-1.6-.1-2.2-.3-.9-.3-1.4-.7-1.4-1.2zm1 0c0 .2.3.4.7.5.5.2 1.2.3 1.9.3.8 0 1.5-.1 2-.3.4-.1.7-.3.7-.5s-.3-.4-.7-.5c-.5-.2-1.2-.3-2-.3-.7 0-1.4.1-1.9.3-.4.1-.7.3-.7.5zm0 1.6c0 .2.3.4.7.5.5.2 1.2.3 1.9.3.8 0 1.5-.1 2-.3.4-.1.7-.3.7-.5v-.5c-.7.3-1.7.5-2.7.5-1 0-1.9-.2-2.6-.5zm0 1.6c0 .2.3.4.7.5.5.2 1.2.3 1.9.3.8 0 1.5-.1 2-.3.4-.1.7-.3.7-.5v-.5c-.7.3-1.7.5-2.7.5-1 0-1.9-.2-2.6-.5z"
      />
    </g>
  ),

  // Zoho — red "Z" mark
  zoho: (
    <g>
      <rect x="2" y="3" width="20" height="18" rx="4" fill="#FFFFFF" />
      <rect x="2" y="3" width="20" height="18" rx="4" fill="none" stroke="#E42527" strokeWidth="1.5" />
      <path fill="#E42527" d="M7 8h10L9.3 16H17v2H6.5l7.7-8H7z" />
    </g>
  ),

  // OpenAI / GPT — knot-style hexagonal mark
  ai_chat: (
    <g>
      <path
        fill="#10A37F"
        d="M21.5 10.4a5.7 5.7 0 0 0-.5-4.7 5.8 5.8 0 0 0-6.3-2.8A5.8 5.8 0 0 0 5 5a5.8 5.8 0 0 0-3.9 2.8 5.8 5.8 0 0 0 .7 6.8 5.7 5.7 0 0 0 .5 4.7 5.8 5.8 0 0 0 6.3 2.8 5.8 5.8 0 0 0 9.7-2 5.8 5.8 0 0 0 3.9-2.8 5.8 5.8 0 0 0-.7-6.9zM13 20.6a4.3 4.3 0 0 1-2.8-1l.1-.1 4.6-2.7c.2-.1.4-.4.4-.7v-6.5l2 1.1v5.4a4.3 4.3 0 0 1-4.3 4.5zM3.9 16.7a4.3 4.3 0 0 1-.5-2.9l.1.1L8 16.6c.2.1.5.1.7 0l5.7-3.3v2.3l-4.7 2.7a4.3 4.3 0 0 1-5.8-1.6zm-1.3-9.4a4.3 4.3 0 0 1 2.3-1.9V11c0 .3.2.5.4.7l5.6 3.2-1.9 1.1L4.4 13.4a4.3 4.3 0 0 1-1.8-6.1zm15.5 3.6L12.5 8 14.4 7l4.6 2.7c2 1.2 2.7 3.8 1.6 5.9a4.3 4.3 0 0 1-2.3 1.9V12c0-.3-.2-.5-.4-.7zm1.9-2.9-.1-.1L15.4 5c-.2-.1-.5-.1-.7 0L9 8.3V6L13.6 3.3a4.3 4.3 0 0 1 6.4 4.7zM8 13.3l-2-1.2V6.7a4.3 4.3 0 0 1 7.1-3.3l-.1.1-4.6 2.7c-.2.1-.4.4-.4.7zm1-2.3 2.5-1.5 2.5 1.5v2.9l-2.5 1.4-2.5-1.4z"
      />
    </g>
  ),

  // Fileshare — generic folder, brand-neutral but in a warm color
  fileshare: (
    <g>
      <path
        fill="#F4A85E"
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      />
      <path
        fill="#FFFFFF"
        opacity=".35"
        d="M3 9h18v2H3z"
      />
    </g>
  ),
};

export function hasBrand(typeId) {
  return Object.prototype.hasOwnProperty.call(BRANDS, typeId);
}

export default function BrandIcon({ typeId, size = 18, className = "" }) {
  const brand = BRANDS[typeId];
  if (!brand) {
    // fallback to the stroke icon set
    return <Icon name={connectorIconName(typeId)} size={size} className={className} />;
  }
  return (
    <svg
      className={"icon brand-icon " + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {brand}
    </svg>
  );
}
