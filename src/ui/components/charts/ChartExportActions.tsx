import type { RefObject } from 'react';
import { Download, ImageDown } from 'lucide-react';
import { exportSvgAsPng, exportSvgElement } from '../../utils/chartExport.ts';

interface ChartExportActionsProps {
  svgRef: RefObject<SVGSVGElement | null>;
  title: string;
}

export function ChartExportActions({ svgRef, title }: ChartExportActionsProps) {
  return (
    <div
      className="no-print"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
    >
      <button
        type="button"
        className="btn btn-sm btn-ghost mono-num"
        style={{ height: 24, padding: '0 6px', fontSize: '0.68rem' }}
        onClick={() => exportSvgElement(svgRef.current, title)}
        title="Unduh grafik vektor .svg"
      >
        <Download size={11} /> .svg
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost mono-num"
        style={{ height: 24, padding: '0 6px', fontSize: '0.68rem' }}
        onClick={() => exportSvgAsPng(svgRef.current, title, 2)}
        title="Unduh gambar resolusi tinggi .png (2x Hi-DPI)"
      >
        <ImageDown size={11} /> .png
      </button>
    </div>
  );
}
