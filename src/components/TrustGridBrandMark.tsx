import React from 'react';

interface TrustGridBrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const TrustGridBrandMark: React.FC<TrustGridBrandMarkProps> = ({
  size = 'md',
  className = '',
}) => {
  const px = size === 'sm' ? 28 : size === 'lg' ? 44 : 34;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="11"
        fill="#0B1B30"
        stroke="#1685FF"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      {/* Outer Geometric Triangular A */}
      <path
        d="M24 9L38 37H31.8L28.6 30.2H19.4L16.2 37H10L24 9Z"
        fill="url(#tg_grad_primary)"
      />
      {/* Inner Negative Cutout & Trust Crossbar */}
      <path d="M24 17.5L27.1 24.8H20.9L24 17.5Z" fill="#06101F" />
      <path
        d="M17.5 27.5H30.5"
        stroke="#35C8FF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="tg_grad_primary"
          x1="12"
          y1="9"
          x2="36"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#35C8FF" />
          <stop offset="1" stopColor="#1685FF" />
        </linearGradient>
      </defs>
    </svg>
  );
};
