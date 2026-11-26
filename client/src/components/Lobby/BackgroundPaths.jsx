export default function BackgroundPaths({ children }) {
  return (
    <div className="lobby-bg">
      <svg
        className="lobby-bg-shapes"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="none" stroke="#8b3dff" strokeOpacity="0.1" strokeWidth="1">
          <path d="M-120 520 520 -120h360L240 520z" />
          <path d="M210 760 870 -60" />
          <path d="M640 920 1310 -40" />
          <path d="M1000 940 1440 380" />
          <path d="M880 -40 1440 610v320z" fill="rgba(255,255,255,0.012)" />
          <path d="M-80 880 520 240h180L40 940z" />
        </g>
        <g fill="rgba(18,16,24,0.55)" stroke="#8b3dff" strokeOpacity="0.08" strokeWidth="1">
          <path d="M1010 900 1440 430v470z" />
          <path d="M-120 900 300 520v380z" />
        </g>
      </svg>
      <div className="lobby-bg-content">{children}</div>
    </div>
  )
}
