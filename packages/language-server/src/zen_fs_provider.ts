import { FileType, type FileSystem } from "@volar/language-service";

type FileSystemEntry = {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
};

const toFileType = (entry: FileSystemEntry): FileType =>
  entry.isFile()
    ? FileType.File
    : entry.isDirectory()
      ? FileType.Directory
      : entry.isSymbolicLink()
        ? FileType.SymbolicLink
        : FileType.Unknown;

/**
 * Adapt ZenFS to Volar's file-system provider contract: a missing path must read
 * as absent, so each syscall reports `undefined` (or no entries) instead of
 * propagating the error.
 */
export default function zenFsProvider(
  fs: typeof import("@zenfs/core").fs,
): FileSystem {
  return {
    stat(uri) {
      try {
        const stats = fs.statSync(uri.fsPath);
        return {
          type: toFileType(stats),
          ctime: stats.ctimeMs,
          mtime: stats.mtimeMs,
          size: stats.size,
        };
      } catch {
        return;
      }
    },
    readFile(uri, encoding) {
      try {
        return fs.readFileSync(uri.fsPath, {
          encoding: (encoding as "utf-8") ?? "utf-8",
        });
      } catch {
        return;
      }
    },
    readDirectory(uri) {
      try {
        const files = fs.readdirSync(uri.fsPath, { withFileTypes: true });
        return files.map<[string, FileType]>((file) => [
          file.name,
          toFileType(file),
        ]);
      } catch {
        return [];
      }
    },
  };
}
