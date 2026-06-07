/**
 * Get the character offset after hashbang and file-scope leading comments.
 * This is for simulating the behavior of TSServer insert auto-imports if no
 * imports are present.
 * @param source 
 * @returns 
 */
export function getContentStartOffset(source: string): number {
  let result = 0;
  /** Current visiting character */
  let pos = 0;
  if (source.startsWith("#!")) {
    const nl = source.indexOf("\n", pos);
    if (nl === -1) {
      return source.length;
    }
    pos = nl + 1;
  }
  const skipWhitespaces = () => {
    let newlineCount = 0;
    for (; pos < source.length; pos++) {
      const ch = source[pos];
      if (ch === " " || ch === "\t" || ch === "\r") {
        continue;
      }
      if (ch === "\n") {
        newlineCount++;
        continue;
      }
      break;
    }
    return newlineCount;
  }
  skipWhitespaces();
  while (pos < source.length) {
    let newlineCount = 0;
    // Eat a comment
    if (source[pos] === "/" && pos + 1 < source.length) {
      if (source[pos + 1] === "/") {
        const nl = source.indexOf("\n", pos);
        pos = nl === -1 ? source.length : nl + 1;
        newlineCount++;
      } else if (source[pos + 1] === "*") {
        pos += 2;
        while (pos < source.length) {
          if (
            source[pos] === "*" &&
            pos + 1 < source.length &&
            source[pos + 1] === "/"
          ) {
            pos += 2;
            break;
          }
          pos++;
        }
      }
      result = pos;
      newlineCount += skipWhitespaces();
      // If there are already 2 newlines in whitespace, the leading comments are ended
      if (newlineCount >= 2) {
        break;
      }
    } else {
      // Not a comment, stop here
      break;
    }
  }
  return result;
}
