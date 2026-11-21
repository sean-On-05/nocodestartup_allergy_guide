export function FoodArt({ type = 'rice', className = '' }: { type?: string; className?: string }) {
  const stew = type === 'stew' || type === 'street'
  return <svg className={`food-art ${className}`} viewBox="0 0 240 190" aria-hidden="true">
    <ellipse cx="122" cy="167" rx="80" ry="12" fill="#234a3920" />
    <path d="M42 84Q45 166 120 169Q195 166 198 84Z" fill={stew ? '#384540' : '#ece9df'} />
    <ellipse cx="120" cy="86" rx="79" ry="46" fill={stew ? '#4a5750' : '#fffef9'} />
    <ellipse cx="120" cy="86" rx="68" ry="37" fill={stew ? '#bf5133' : '#f1e9d4'} />
    {stew ? <><path d="M65 77l39-17 15 16-38 21Z" fill="#e88a5b" /><path d="M132 67l32 4-4 23-32-5Z" fill="#f6e7c8" /><path d="M83 96l29-8 13 19-25 8Z" fill="#df7753" /><path d="M144 102l21-6 5 9-20 7Z" fill="#53815a" /><path d="M104 57l20 2-2 5-20-2Z" fill="#77a868" /><ellipse cx="138" cy="99" rx="4" ry="2" fill="#f5b772" /></> : <><path d="M60 78q10-20 29-22l22 20-27 15Z" fill="#5f8b56" /><path d="M123 52q25 0 43 16l-23 18-24-12Z" fill="#dc8648" /><path d="M62 95l32-10 13 24-26 3Z" fill="#a77d4b" /><path d="M145 89l29-11q12 22-13 31l-21-7Z" fill="#819f5f" /><path d="M101 105q20 18 48 3l-16-17-25 1Z" fill="#a0543c" /><path d="M92 78q6-14 22-10 9-15 24-1 17 4 13 18-2 18-24 15-20 6-31-7-12-3-4-15Z" fill="#fffdf0" /><ellipse cx="123" cy="81" rx="15" ry="12" fill="#e6b84a" /><path d="M72 72l20-6m-25 12l24-6m58-10l12 9m-13-3l14 9" stroke="#d0d8a1" strokeWidth="2" strokeLinecap="round" /></>}
    <path d="M58 118q10 29 35 35" fill="none" stroke={stew ? '#66756b' : '#fffdf6'} strokeWidth="4" strokeLinecap="round" />
    <path d="M184 28l-34 51M195 32l-35 52" stroke="#a67c50" strokeWidth="5" strokeLinecap="round" />
  </svg>
}
