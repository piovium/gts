declare global {
  var console:
    | {
        log: (...args: any[]) => void;
        error: (...args: any[]) => void;
      }
    | undefined;
}

export {};
