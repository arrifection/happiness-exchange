/** Original Happiness Exchange mark — matches favicon.svg and marketing home page. */
export default function BrandMarkSvg({
  className = '',
  width = 44,
  stroke = '#8C57F5',
  dot = '#8C57F5',
  square = '#F9C826',
  endDot = dot,
  title = 'Happiness Exchange',
}) {
  const height = Math.round((width * 56) / 74)

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 74 56"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <circle cx="12" cy="16.5" r="6.2" fill={dot} />
      <rect x="24" y="5" width="35" height="43" rx="11" fill={square} />
      <circle cx="38" cy="16.5" r="5.3" fill={dot} />
      <circle cx="46.5" cy="34.5" r="5.2" fill={endDot} />
      <path
        d="M6 27.5C6 41 15.5 50 29.5 50C40.5 50 48 44.5 48 35"
        stroke={stroke}
        strokeWidth="5.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
