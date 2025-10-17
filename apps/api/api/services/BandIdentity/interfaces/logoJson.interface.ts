// Logo JSON structure interfaces for optimized generation
export interface LogoShape {
  type: 'circle' | 'rect' | 'path' | 'polygon' | 'ellipse' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  
  // Circle properties
  cx?: number;
  cy?: number;
  r?: number;
  
  // Rectangle properties
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rx?: number; // border radius
  ry?: number;
  
  // Path properties
  d?: string;
  
  // Polygon properties
  points?: string;
  
  // Line properties
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  
  // Ellipse properties
  rx_ellipse?: number;
  ry_ellipse?: number;
}

export interface LogoTextElement {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill?: string;
  fontFamily?: string;
  fontWeight?: string;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'auto' | 'middle' | 'hanging';
}

export interface LogoSize {
  w: number;
  h: number;
}

export interface LogoIconStructure {
  shapes: LogoShape[];
  size: LogoSize;
}

export interface LogoTextStructure {
  elements: LogoTextElement[];
  size: LogoSize;
}

export interface LogoJsonStructure {
  id: string;
  name: string;
  concept: string;
  colors: string[];
  fonts: string[];
  icon: LogoIconStructure;
  text: LogoTextStructure;
  layout: {
    textPosition: 'right' | 'bottom'; // Text position relative to icon
    spacing: number; // Spacing between icon and text in pixels
  };
}

export interface LogoVariationStructure {
  shapes: LogoShape[];
  size: LogoSize;
}

export interface LogoVariationsJson {
  variations: {
    lightBackground: LogoVariationStructure;
    darkBackground: LogoVariationStructure;
    monochrome: LogoVariationStructure;
  };
}
