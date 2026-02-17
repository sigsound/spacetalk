"use client";

interface PolycamLogoProps {
  className?: string;
  color?: string;
}

export default function PolycamLogo({ className = "w-8 h-8", color = "currentColor" }: PolycamLogoProps) {
  return (
    <svg viewBox="0 0 112 133" className={className} fill={color}>
      <path d="M85.6463 79.8026L105.41 68.401V30.3985L52.7074 0L0 30.3985V68.401L52.7074 37.9981L72.4716 49.3998L52.7074 60.8014V98.7995L112 133V95.0019L85.6463 79.8026Z" />
    </svg>
  );
}
