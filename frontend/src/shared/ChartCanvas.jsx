import { useEffect, useRef } from 'react';
import {
  Chart, BarController, LineController, DoughnutController,
  BarElement, LineElement, PointElement, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(BarController, LineController, DoughnutController, BarElement, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

// Readable axis numbers and gridlines in BOTH light and dark themes
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.22)';
Chart.defaults.font.family = "'Inter Variable', system-ui, sans-serif";

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// "data" and "options" must come from useMemo (or a constant). The chart is rebuilt only when they change.
export default function ChartCanvas({ type, data, options, label, height = 260 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const chart = new Chart(canvasRef.current, {
      type,
      data,
      options: { responsive: true, maintainAspectRatio: false, animation: reduceMotion ? false : undefined, ...options },
    });
    return () => chart.destroy();
  }, [type, data, options]);

  return (
    <div className="relative w-full" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}