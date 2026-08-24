import type { CSSProperties, SVGProps } from 'react'

type HabytFlowWordmarkProps = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'width' | 'height'> & {
  width?: number | string
  height?: number | string
  skew?: number
}

const colors = {
  cream: '#F4F4F0',
  greenLight: '#86EFAC',
  greenMid: '#22C55E',
  greenDark: '#064E3B',
  greyNode: '#9CA3AF',
  stroke: '#000000',
}

const svgStyle: CSSProperties = {
  backgroundColor: 'transparent',
  display: 'inline-block',
  verticalAlign: 'middle',
}

const textStyle: CSSProperties = {
  fontFamily: 'var(--font-montserrat), Montserrat, sans-serif',
  fontWeight: 900,
  letterSpacing: '-3px',
}

const shapeStyle = {
  fill: colors.cream,
  stroke: colors.stroke,
  strokeWidth: 4,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} satisfies CSSProperties

function TrackerGrid() {
  return (
    <g style={shapeStyle}>
      <rect x="0" y="80" width="18" height="18" />
      <rect x="22" y="80" width="18" height="18" />
      <rect x="0" y="102" width="18" height="18" />
      <rect x="22" y="102" width="18" height="18" />
      <rect x="0" y="124" width="18" height="18" />
      <rect x="22" y="124" width="18" height="18" />
      <rect x="0" y="146" width="18" height="18" />
      <rect x="22" y="146" width="18" height="18" />
    </g>
  )
}

export function HabytFlowWordmark({
  className = '',
  width = 'auto',
  height = '1em',
  skew = -15,
  style,
  role = 'img',
  'aria-label': ariaLabel = 'HabytFlow',
  ...props
}: HabytFlowWordmarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1300 220"
      width={width}
      height={height}
      className={className}
      fill="none"
      shapeRendering="geometricPrecision"
      style={{ ...svgStyle, ...style }}
      role={role}
      aria-label={ariaLabel}
      {...props}
    >
      <g transform={`skewX(${skew}) translate(80, 25)`}>
        <g>
          <path style={shapeStyle} d="M 0 0 h 40 v 76 h -40 z" />
          <TrackerGrid />
          <path style={shapeStyle} d="M 40 70 h 45 v 26 h -45 z" />
          <path style={shapeStyle} d="M 85 0 h 40 v 164 h -40 z" />
          <g stroke={colors.stroke} strokeWidth="3" strokeLinejoin="round">
            <rect x="85" y="60" width="20" height="20" fill={colors.greenLight} />
            <rect x="85" y="80" width="20" height="20" fill={colors.greenMid} />
            <rect x="85" y="100" width="20" height="20" fill={colors.greenDark} />
            <path fill={colors.greyNode} d="M 105 60 h 5 a 10 10 0 0 1 0 20 h -5 z" />
          </g>
        </g>

        <text x="142" y="164" fontSize="175" fill={colors.cream} style={textStyle}>
          abyt
        </text>

        <g transform="translate(560, 0)">
          <path style={shapeStyle} d="M 0 0 h 40 v 76 h -40 z" />
          <TrackerGrid />
          <path
            style={shapeStyle}
            d="M 40 0 L 130 0 C 160 0, 180 5, 200 -15 C 175 35, 140 40, 110 40 L 40 40 Z"
          />
          <path stroke={colors.stroke} strokeWidth="4" strokeLinecap="round" d="M 80 0 v 40 M 120 0 v 40" />
          <path
            style={shapeStyle}
            d="M 40 70 L 90 70 C 115 70, 135 75, 145 80 C 125 110, 95 115, 70 115 L 40 115 Z"
          />
          <path stroke={colors.stroke} strokeWidth="4" strokeLinecap="round" d="M 80 70 v 45" />
        </g>

        <text x="755" y="164" fontSize="175" fill={colors.cream} style={textStyle}>
          low
        </text>
      </g>
    </svg>
  )
}

export default HabytFlowWordmark
