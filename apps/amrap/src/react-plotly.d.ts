declare module 'react-plotly.js' {
  import type { ComponentType } from 'react';
  interface PlotParams {
    data: unknown[];
    layout?: Record<string, unknown>;
    config?: Record<string, unknown>;
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
  }
  const Plot: ComponentType<PlotParams>;
  export default Plot;
}
