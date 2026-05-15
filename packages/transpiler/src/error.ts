import type { SourceLocation } from "estree";

export class GtsTranspilerError extends Error {
  public readonly position: SourceLocation | null;
  constructor(message: string, position: SourceLocation | null) {
    super(message);
    this.name = "GtsTranspilerError";
    this.position = position;
  }
}
