import {
  DiagnosticSeverity,
  Range,
  type LanguageServicePlugin,
} from "@volar/language-server";
import { getVirtualCode } from "./utils";
export const createDiagnosticsPlugin = (): LanguageServicePlugin => {
  return {
    name: "gts-diagnostics",
    capabilities: {
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create: (context) => {
      return {
        provideDiagnostics: (document) => {
          try {
            console.log(document.uri);
            const [virtualCode] = getVirtualCode(document, context);
            console.log(document.uri, virtualCode);
            if (!virtualCode) {
              return;
            }
            return virtualCode.errors.map((err) => {
              const loc = err.position ?? {
                start: { line: 1, column: 0 },
                end: { line: 1, column: 1 },
              };
              const range: Range = {
                start: {
                  line: loc.start.line - 1,
                  character: loc.start.column,
                },
                end: { line: loc.end.line - 1, character: loc.end.column },
              };
              console.log(range);
              return {
                severity: DiagnosticSeverity.Error,
                range,
                message: err.message,
                source: "gts-transpiler",
                code: "gts-transpiler-error",
              };
            });
          } catch (e) {
            console.error(e);
            return;
          }
        },
      };
    },
  };
};
