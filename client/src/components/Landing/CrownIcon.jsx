export default function CrownIcon({ size = 20, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 8l4 4 5-7 5 7 4-4-2 10H5L3 8z" />
      <path d="M5 21h14" />
    </svg>
  )
}
