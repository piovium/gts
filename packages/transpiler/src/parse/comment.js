// https://github.com/Ripple-TS/ripple/blob/e92e8f9876a080818c75cf698fc5d84a8c76a1a7/packages/ripple/src/compiler/phases/1-parse/index.js#L2170
// We do not ts-check this file because Ripple has different AST definitions
// but it works anyway

import { walk } from "zimmerframe";

/**
 * @import { AST, Parse } from '../types.js'
 */

/**
 * Acorn doesn't add comments to the AST by itself. This factory returns the capabilities
 * to add them after the fact. They are needed in order to support `ripple-ignore` comments
 * in JS code and so that `prettier-plugin` doesn't remove all comments when formatting.
 * @param {string} source
 * @param {AST.CommentWithLocation[]} comments
 * @param {number} [index=0] - Starting index
 * @returns {{onComment: Parse.Options['onComment'], addComments: (ast: AST.Node) => void}}
 */
export function getCommentHandlers(source, comments, index = 0) {
  /**
	 * @param {string} text
	 * @param {number} startIndex
	 * @returns {string | null}
	 */
	function getNextNonWhitespaceCharacter(text, startIndex) {
		for (let i = startIndex; i < text.length; i++) {
			const char = text[i];
			if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r') {
				return char;
			}
		}
		return null;
	}

	return {
		/**
		 * @type {Parse.Options['onComment']}
		 */
		onComment: (block, value, start, end, start_loc, end_loc, metadata) => {
			if (block && /\n/.test(value)) {
				let a = start;
				while (a > 0 && source[a - 1] !== '\n') a -= 1;

				let b = a;
				while (/[ \t]/.test(source[b])) b += 1;

				const indentation = source.slice(a, b);
				value = value.replace(new RegExp(`^${indentation}`, 'gm'), '');
			}

			comments.push({
				type: block ? 'Block' : 'Line',
				value,
				start,
				end,
				loc: {
					start: start_loc,
					end: end_loc,
				},
				context: metadata ?? null,
			});
		},

		/**
		 * @param {AST.Node} ast
		 */
		addComments: (ast) => {
			if (comments.length === 0) return;

			comments = comments
				.filter((comment) => comment.start >= index)
				.map(({ type, value, start, end, loc, context }) => ({
					type,
					value,
					start,
					end,
					loc,
					context,
				}));

			walk(ast, null, {
				_(node, { next, path }) {
					const metadata = node?.metadata;

					if (metadata && metadata.commentContainerId !== undefined) {
						while (
							comments[0] &&
							comments[0].context &&
							comments[0].context.containerId === metadata.commentContainerId &&
							comments[0].context.beforeMeaningfulChild
						) {
							const elementComment = /** @type {AST.CommentWithLocation} */ (comments.shift());

							(metadata.elementLeadingComments ||= []).push(elementComment);
						}
					}

					while (
						comments[0] &&
						comments[0].start < /** @type {AST.NodeWithLocation} */ (node).start
					) {
						const comment = /** @type {AST.CommentWithLocation} */ (comments.shift());

						// Skip leading comments for BlockStatement that is a function body
						// These comments should be dangling on the function instead
						if (node.type === 'BlockStatement') {
							const parent = path.at(-1);
							if (
								parent &&
								(parent.type === 'FunctionDeclaration' ||
									parent.type === 'FunctionExpression' ||
									parent.type === 'ArrowFunctionExpression') &&
								parent.body === node
							) {
								// This is a function body - don't attach comment, let it be handled by function
								(parent.comments ||= []).push(comment);
								continue;
							}
						}

						const ancestorElements = /** @type {(AST.Element & AST.NodeWithLocation)[]} */ (
							path.filter((ancestor) => ancestor && ancestor.type === 'Element' && ancestor.loc)
						).sort((a, b) => a.loc.start.line - b.loc.start.line);

						const targetAncestor = ancestorElements.find(
							(ancestor) => comment.loc.start.line < ancestor.loc.start.line,
						);

						if (targetAncestor) {
							targetAncestor.metadata ??= { path: [] };
							(targetAncestor.metadata.elementLeadingComments ||= []).push(comment);
							continue;
						}

						(node.leadingComments ||= []).push(comment);
					}

					next();

					if (comments[0]) {
						if (node.type === 'BlockStatement' && node.body.length === 0) {
							// Collect all comments that fall within this empty block
							while (
								comments[0] &&
								comments[0].start < /** @type {AST.NodeWithLocation} */ (node).end &&
								comments[0].end < /** @type {AST.NodeWithLocation} */ (node).end
							) {
								const comment = /** @type {AST.CommentWithLocation} */ (comments.shift());
								(node.innerComments ||= []).push(comment);
							}
							if (node.innerComments && node.innerComments.length > 0) {
								return;
							}
						}
						// Handle JSXEmptyExpression - these represent {/* comment */} in JSX
						if (node.type === 'JSXEmptyExpression') {
							// Collect all comments that fall within this JSXEmptyExpression
							while (
								comments[0] &&
								comments[0].start >= /** @type {AST.NodeWithLocation} */ (node).start &&
								comments[0].end <= /** @type {AST.NodeWithLocation} */ (node).end
							) {
								const comment = /** @type {AST.CommentWithLocation} */ (comments.shift());
								(node.innerComments ||= []).push(comment);
							}
							if (node.innerComments && node.innerComments.length > 0) {
								return;
							}
						}
						// Handle empty Element nodes the same way as empty BlockStatements
						if (node.type === 'Element' && (!node.children || node.children.length === 0)) {
							// Collect all comments that fall within this empty element
							while (
								comments[0] &&
								comments[0].start < /** @type {AST.NodeWithLocation} */ (node).end &&
								comments[0].end < /** @type {AST.NodeWithLocation} */ (node).end
							) {
								const comment = /** @type {AST.CommentWithLocation} */ (comments.shift());
								(node.innerComments ||= []).push(comment);
							}
							if (node.innerComments && node.innerComments.length > 0) {
								return;
							}
						}

						const parent = /** @type {AST.Node & AST.NodeWithLocation} */ (path.at(-1));

						if (parent === undefined || node.end !== parent.end) {
							const slice = source.slice(node.end, comments[0].start);

							// Check if this node is the last item in an array-like structure
							let is_last_in_array = false;
							/** @type {(AST.Node | null)[] | null} */
							let node_array = null;
							let isParam = false;
							let isArgument = false;
							let isSwitchCaseSibling = false;

							if (
								parent.type === 'BlockStatement' ||
								parent.type === 'Program' ||
								parent.type === 'Component' ||
								parent.type === 'ClassBody'
							) {
								node_array = parent.body;
							} else if (parent.type === 'SwitchStatement') {
								node_array = parent.cases;
								isSwitchCaseSibling = true;
							} else if (parent.type === 'SwitchCase') {
								node_array = parent.consequent;
							} else if (
								parent.type === 'ArrayExpression' ||
								parent.type === 'TrackedArrayExpression'
							) {
								node_array = parent.elements;
							} else if (
								parent.type === 'ObjectExpression' ||
								parent.type === 'TrackedObjectExpression'
							) {
								node_array = parent.properties;
							} else if (
								parent.type === 'FunctionDeclaration' ||
								parent.type === 'FunctionExpression' ||
								parent.type === 'ArrowFunctionExpression'
							) {
								node_array = parent.params;
								isParam = true;
							} else if (parent.type === 'CallExpression' || parent.type === 'NewExpression') {
								node_array = parent.arguments;
								isArgument = true;
							}

							if (node_array && Array.isArray(node_array)) {
								is_last_in_array = node_array.indexOf(node) === node_array.length - 1;
							}

							if (is_last_in_array) {
								if (isParam || isArgument) {
									while (comments.length) {
										const potentialComment = comments[0];
										if (parent && potentialComment.start >= parent.end) {
											break;
										}

										const nextChar = getNextNonWhitespaceCharacter(source, potentialComment.end);
										if (nextChar === ')') {
											(node.trailingComments ||= []).push(
												/** @type {AST.CommentWithLocation} */ (comments.shift()),
											);
											continue;
										}

										break;
									}
								} else {
									// Special case: There can be multiple trailing comments after the last node in a block,
									// and they can be separated by newlines
									let end = node.end;

									while (comments.length) {
										const comment = comments[0];
										if (parent && comment.start >= parent.end) break;

										(node.trailingComments ||= []).push(comment);
										comments.shift();
										end = comment.end;
									}
								}
							} else if (/** @type {AST.NodeWithLocation} */ (node).end <= comments[0].start) {
								const onlySimpleWhitespace = /^[,) \t]*$/.test(slice);
								const onlyWhitespace = /^\s*$/.test(slice);
								const hasBlankLine = /\n\s*\n/.test(slice);
								const nodeEndLine = node.loc?.end?.line ?? null;
								const commentStartLine = comments[0].loc?.start?.line ?? null;
								const isImmediateNextLine =
									nodeEndLine !== null &&
									commentStartLine !== null &&
									commentStartLine === nodeEndLine + 1;

								if (isSwitchCaseSibling && !is_last_in_array) {
									if (
										nodeEndLine !== null &&
										commentStartLine !== null &&
										nodeEndLine === commentStartLine
									) {
										node.trailingComments = [
											/** @type {AST.CommentWithLocation} */ (comments.shift()),
										];
									}
									return;
								}

								if (
									onlySimpleWhitespace ||
									(onlyWhitespace && !hasBlankLine && isImmediateNextLine)
								) {
									// Check if this is a block comment that's inline with the next statement
									// e.g., /** @type {SomeType} */ (a) = 5;
									// These should be leading comments, not trailing
									if (comments[0].type === 'Block' && !is_last_in_array && node_array) {
										const currentIndex = node_array.indexOf(node);
										const nextSibling = node_array[currentIndex + 1];

										if (nextSibling && nextSibling.loc) {
											const commentEndLine = comments[0].loc?.end?.line;
											const nextSiblingStartLine = nextSibling.loc?.start?.line;

											// If comment ends on same line as next sibling starts, it's inline with next
											if (commentEndLine === nextSiblingStartLine) {
												// Leave it for next sibling's leading comments
												return;
											}
										}
									}

									// For function parameters, only attach as trailing comment if it's on the same line
									// Comments on next line after comma should be leading comments of next parameter
									if (isParam) {
										// Check if comment is on same line as the node
										const nodeEndLine = source.slice(0, node.end).split('\n').length;
										const commentStartLine = source.slice(0, comments[0].start).split('\n').length;
										if (nodeEndLine === commentStartLine) {
											node.trailingComments = [
												/** @type {AST.CommentWithLocation} */ (comments.shift()),
											];
										}
										// Otherwise leave it for next parameter's leading comments
									} else {
										node.trailingComments = [
											/** @type {AST.CommentWithLocation} */ (comments.shift()),
										];
									}
								} else if (hasBlankLine && onlyWhitespace && node_array) {
									// When there's a blank line between node and comment(s),
									// check if there's also a blank line after the comment(s) before the next node
									// If so, attach comments as trailing to preserve the grouping
									// Only do this for statement-level contexts (BlockStatement, Program),
									// not for Element children or other contexts
									const isStatementContext =
										parent.type === 'BlockStatement' || parent.type === 'Program';

									// Don't apply for Component - let Prettier handle comment attachment there
									// Component bodies have different comment handling via metadata.elementLeadingComments
									if (!isStatementContext) {
										return;
									}

									const currentIndex = node_array.indexOf(node);
									const nextSibling = node_array[currentIndex + 1];

									if (nextSibling && nextSibling.loc) {
										// Find where the comment block ends
										let lastCommentIndex = 0;
										let lastCommentEnd = comments[0].end;

										// Collect consecutive comments (without blank lines between them)
										while (comments[lastCommentIndex + 1]) {
											const currentComment = comments[lastCommentIndex];
											const nextComment = comments[lastCommentIndex + 1];
											const sliceBetween = source.slice(currentComment.end, nextComment.start);

											// If there's a blank line, stop
											if (/\n\s*\n/.test(sliceBetween)) {
												break;
											}

											lastCommentIndex++;
											lastCommentEnd = nextComment.end;
										}

										// Check if there's a blank line after the last comment and before next sibling
										const sliceAfterComments = source.slice(lastCommentEnd, nextSibling.start);
										const hasBlankLineAfter = /\n\s*\n/.test(sliceAfterComments);

										if (hasBlankLineAfter) {
											// Don't attach comments as trailing if next sibling is an Element
											// and any comment falls within the Element's line range
											// This means the comments are inside the Element (between opening and closing tags)
											const nextIsElement = nextSibling.type === 'Element';
											const commentsInsideElement =
												nextIsElement &&
												nextSibling.loc &&
												comments.some((c) => {
													if (!c.loc) return false;
													// Check if comment is on a line between Element's start and end lines
													return (
														c.loc.start.line >= nextSibling.loc.start.line &&
														c.loc.end.line <= nextSibling.loc.end.line
													);
												});

											if (!commentsInsideElement) {
												// Attach all the comments as trailing
												for (let i = 0; i <= lastCommentIndex; i++) {
													(node.trailingComments ||= []).push(
														/** @type {AST.CommentWithLocation} */ (comments.shift()),
													);
												}
											}
										}
									}
								}
							}
						}
					}
				},
			});
		},
	};
}