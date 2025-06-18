export interface EntityRenderer<T> {
  render(ctx: CanvasRenderingContext2D, entity: T): void;
}
