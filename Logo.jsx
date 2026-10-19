export default function Logo({ size = 46, showText = true, textSize = 20 }) {
  return (
    <div className="brand-logo">
      <div className="brand-mark" style={{ width: size, height: size }}>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4.5h9a2 2 0 0 1 2 2V19H7a2 2 0 0 1-2-2V4.5Z" />
          <path d="M16 8h3v11h-9" />
        </svg>
      </div>
      {showText && <span className="brand-text" style={{ fontSize: textSize }}>RP Bookstore</span>}
    </div>
  );
}
