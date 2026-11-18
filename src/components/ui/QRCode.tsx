import { useMemo } from 'react';
import { qrMatrix } from '@/lib/qr';

/** Настоящий сканируемый QR в SVG (уровень коррекции M). */
export function QRCode({ value, size = 128, className, title }: { value: string; size?: number; className?: string; title?: string }) {
  const { d, n } = useMemo(() => {
    const m = qrMatrix(value);
    let path = '';
    m.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) path += `M${x + 4} ${y + 4}h1v1h-1z`;
      }),
    );
    return { d: path, n: m.length + 8 };
  }, [value]);
  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? 'QR-код'}
    >
      <rect width={n} height={n} fill="#FFFFFF" />
      <path d={d} fill="#0F172A" />
    </svg>
  );
}
