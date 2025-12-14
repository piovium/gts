import type { SourceLocation } from "estree";

export class GtsTranspilerError extends Error {
  constructor(
    message: string,
    public readonly position: SourceLocation | null,
  ) {
    super(message);
    this.name = "GtsTranspilerError";
  }
}
