import type { FileSystem, FileType } from "@volar/language-service";

export default function zenFsProvider(
  fs: typeof import("@zenfs/core").fs,
): FileSystem {
  return {
    stat(uri) {
      try {
        const stats = fs.statSync(uri.path);
        // console.log("stat", uri.path, stats);
        return {
          type: stats.isFile()
            ? (1 satisfies FileType.File)
            : stats.isDirectory()
              ? (2 satisfies FileType.Directory)
              : stats.isSymbolicLink()
                ? (64 satisfies FileType.SymbolicLink)
                : (0 satisfies FileType.Unknown),
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
        // console.log("readFile", uri.path);
        return fs.readFileSync(uri.path, {
          encoding: (encoding as "utf-8") ?? "utf-8",
        });
      } catch {
        return;
      }
    },
    readDirectory(uri) {
      try {
        const files = fs.readdirSync(uri.path, { withFileTypes: true });
        // console.log("readDirectory", uri.path, files.map((f) => f.name));
        return files.map<[string, FileType]>((file) => {
          return [
            file.name,
            file.isFile()
              ? (1 satisfies FileType.File)
              : file.isDirectory()
                ? (2 satisfies FileType.Directory)
                : file.isSymbolicLink()
                  ? (64 satisfies FileType.SymbolicLink)
                  : (0 satisfies FileType.Unknown),
          ];
        });
      } catch {
        return [];
      }
    },
  };
}
