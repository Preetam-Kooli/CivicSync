import { useEffect, useRef } from 'react';
import {
  Chart, BarController, LineController, DoughnutController,
  BarElement, LineElement, PointElement, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';

// Chart.js is "tree-shakeable": register only the parts we use to keep the download small
Chart.register(BarController, LineController, DoughnutController, BarElement, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// "data" and "options" must come from useMemo in the parent. The chart is rebuilt only when they change.
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

  // The explicit height is what keeps the chart from growing forever on phones
  return (
    <div className="relative w-full" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}