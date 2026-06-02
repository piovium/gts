import type { CodeInformation, CodeMapping } from "@volar/language-core";

export interface VolarMappingResult {
  code: string;
  mappings: CodeMapping[];
}

export const DEFAULT_VOLAR_MAPPING_DATA: CodeInformation = {
  completion: true,
  format: true,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true,
};
export const VERIFICATION_ONLY_MAPPING_DATA: CodeInformation = {
  verification: true,
};

Object.freeze(DEFAULT_VOLAR_MAPPING_DATA);
Object.freeze(VERIFICATION_ONLY_MAPPING_DATA);
