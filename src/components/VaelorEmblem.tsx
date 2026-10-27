import React from 'react';

interface VaelorEmblemProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VaelorEmblem: React.FC<VaelorEmblemProps> = ({ size = 'md', className = '' }) => {
  const px = size === 'sm' ? 28 : size === 'lg' ? 68 : 38;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 128 128"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <radialGradient id={`vBg-${size}`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#2e2150" />
          <stop offset="100%" stopColor="#0d0b14" />
        </radialGradient>
        <linearGradient id={`vEdge-${size}`} x1="16" y1="16" x2="112" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ddd5f7" />
          <stop offset="50%" stopColor="#8b6ff7" />
          <stop offset="100%" stopColor="#4f3b8c" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="116" height="116" rx="26" fill={`url(#vBg-${size})`} stroke={`url(#vEdge-${size})`} strokeWidth="2.5" />
      <polygon points="64,22 100,64 64,106 28,64" stroke="#8b6ff7" strokeWidth="2" opacity="0.6" />
      <circle cx="64" cy="64" r="29" stroke="#e2dcf5" strokeWidth="2" opacity="0.9" />
      <ellipse cx="64" cy="64" rx="13" ry="30" transform="rotate(45 64 64)" stroke="#a890fa" strokeWidth="1.8" />
      <ellipse cx="64" cy="64" rx="13" ry="30" transform="rotate(-45 64 64)" stroke="#a890fa" strokeWidth="1.8" />
      <circle cx="64" cy="64" r="5.5" fill="#f5f3fc" />
    </svg>
  );
};
