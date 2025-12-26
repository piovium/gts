class SuffixAutomaton {
    // Each node has a length, a suffix link, and a map of transitions
    struct: { len: number, link: number, next: Map<string, number> }[];
    last: number;

    constructor(s: string) {
        this.struct = [{ len: 0, link: -1, next: new Map() }];
        this.last = 0;
        for (const char of s) {
            this.extend(char);
        }
    }

    // Standard Suffix Automaton extension algorithm
    extend(c: string) {
        const cur = this.struct.length;
        this.struct.push({ len: this.struct[this.last].len + 1, link: 0, next: new Map() });
        let p = this.last;
        while (p !== -1 && !this.struct[p].next.has(c)) {
            this.struct[p].next.set(c, cur);
            p = this.struct[p].link;
        }
        if (p === -1) {
            this.struct[cur].link = 0;
        } else {
            const q = this.struct[p].next.get(c)!;
            if (this.struct[p].len + 1 === this.struct[q].len) {
                this.struct[cur].link = q;
            } else {
                const clone = this.struct.length;
                this.struct.push({
                    len: this.struct[p].len + 1,
                    link: this.struct[q].link,
                    next: new Map(this.struct[q].next)
                });
                while (p !== -1 && this.struct[p].next.get(c) === q) {
                    this.struct[p].next.set(c, clone);
                    p = this.struct[p].link;
                }
                this.struct[q].link = clone;
                this.struct[cur].link = clone;
            }
        }
        this.last = cur;
    }
}

/**
 * Finds the minimal string constructed from `letters` that is NOT a substring of `input`.
 * Complexity: O(N) where N is size of `input`.
 */
export function findMinimalMissingString(input: string, letters: string): string {
    if (letters.length === 0) return "";
    
    // Sort letters to ensure lexicographical order for same-length results
    const sortedLetters = [...letters].sort();
    
    // Build Suffix Automaton - O(N)
    const sam = new SuffixAutomaton(input);
    
    // BFS queue: stores state index
    const queue: number[] = [0];
    
    // To keep track of visited states to avoid cycles (though SAM is DAG, we want shortest path)
    const visited = new Array(sam.struct.length).fill(false);
    visited[0] = true;
    
    // Maps to reconstruct the string: state -> parent state, state -> char from parent
    const parent = new Map<number, number>();
    const charFromParent = new Map<number, string>();

    let head = 0;
    while(head < queue.length) {
        const u = queue[head++];
        
        for (const char of sortedLetters) {
            // Check if transition exists
            if (!sam.struct[u].next.has(char)) {
                // Transition missing! We found the shortest missing string.
                // Reconstruct the path backwards
                let curr = u;
                let path = "";
                while (curr !== 0) {
                    path = charFromParent.get(curr)! + path;
                    curr = parent.get(curr)!;
                }
                return path + char;
            }
            
            const v = sam.struct[u].next.get(char)!;
            if (!visited[v]) {
                visited[v] = true;
                parent.set(v, u);
                charFromParent.set(v, char);
                queue.push(v);
            }
        }
    }
    
    return ""; // Should not be reached for non-empty alphabet
}
