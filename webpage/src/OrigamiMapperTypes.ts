// Type definitions for OrigamiMapperJS
export namespace OrigamiMapperTypes {
  export type Polygon = {
    id: string;
    vertices: [number, number][];
    input_image?: number;
    output_image?: number;
    rotation?: number;
  };

  export type TemplateJson = {
    offset: [number, number];
    input_polygons: Polygon[];
    output_polygons: Polygon[];
  };

  export interface CanvasLike {
    width: number;
    height: number;
    getContext(contextId: '2d'): CanvasRenderingContext2D | null;
    toDataURL(type?: string, quality?: any): string;
  }

  export interface PolygonLike {
    id: string;
    vertices: [number, number][];
    imageIdx: number;
    rotation: number;
    absolute(width: number, height: number): [number, number][];
  }
}
