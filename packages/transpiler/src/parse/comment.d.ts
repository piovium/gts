import { Comment, Node } from "estree";
import { Options } from "acorn";

export function getCommentHandlers(
  source: string,
  comments: Comment[],
): {
  onComment: Options["onComment"];
  addComments: (ast: Node) => void;
};
