export function FusionLogo({ size = 40 }) {
  return (
    <svg width={size} height={size * 1.14} viewBox="0 0 140 160">
      <polygon points="70,0 140,40 140,120 70,160 0,120 0,40"
               fill="none" stroke="#1d4ed8" strokeWidth="4"/>
      <polygon points="70,20 120,48 120,112 70,140 20,112 20,48"
               fill="none" stroke="#93c5fd" strokeWidth="1.5"/>
      <text x="70" y="95" fontSize="56" fontWeight="700" fill="#1d4ed8"
            textAnchor="middle" fontFamily="sans-serif">F</text>
    </svg>
  );
}
