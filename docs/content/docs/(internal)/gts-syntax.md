---
title: GTS Syntax Reference
---

GamingTS (GTS) is a superset of TypeScript. A `.gts` file can contain any valid TypeScript, plus GTS-specific `define` statements.

## Formal Grammar

The GTS parser extends ECMAScript/TypeScript with these productions (comments show the grammar from `gts_plugin.ts`):

```
Statement:
+   DefineStatement

DefineStatement:
    "define" [no LineTerminator here] NamedAttributeDefinition

NamedAttributeDefinition:
    AttributeName AttributeBody AttributeBindingClause? ";"

AttributeName:
    Identifier
    StringLiteral

AttributeBody:
    PositionalAttributeList? NamedAttributeBlock?

AttributeBindingClause:
    "as" BindingAccessModifier? Identifier

BindingAccessModifier:
    "private"
    "protected"
    "public"

PositionalAttributeList:
    AttributeExpression
    AttributeExpression "," PositionalAttributeList

NamedAttributeBlock:
    "{" NamedAttributeList DirectShortcutFunction? "}"

NamedAttributeList:
    [empty]
    NamedAttributeDefinition NamedAttributeList

AttributeExpression:
    ":" ShortcutFunction
    [lookahead != "{"] PrimaryExpression

DirectShortcutFunction:
    [lookahead = one of ":", ReservedWord]
    FunctionBody[~Yield, ~Await]

ShortcutFunction:
    "(" Expression[+In, ~Yield, ~Await] ")"
    "{" FunctionBody[~Yield, ~Await] "}"

PrimaryExpression:
+   ShortcutArgumentExpression

ShortcutArgumentExpression:
    ":" Identifier
```

## Define Statement

The `define` keyword starts a top-level declaration. It is only valid at the module (top) level.

```gts
define character {
  id 1201 as Barbara;
  since "v3.3.0";
  tags hydro, catalyst, mondstadt;
  health 10;
  energy 3;
  skills WhisperOfWater;
}
```

### Anatomy

```
define <RootAttributeName> {
  <AttributeName> <positional1>, <positional2>, ... {
    <NestedAttributeName> <positionals> ;
    ...
  } as <BindingName> ;
}
```

- **`define`** — keyword (must be followed immediately by an identifier, no line break allowed).
- **Root attribute name** — the first identifier after `define` (e.g., `character`, `skill`, `summon`). This tells the runtime which ViewModel to use.
- **Named attribute block** (`{ ... }`) — contains a list of nested attribute definitions.
- **Positional attributes** — comma-separated expressions appearing before a `{` or `;`.
- **Binding clause** (`as Name`) — exports the attribute's return value as a variable. Access modifiers `public` (default), `private`, or `protected` control visibility.

### Positional Attributes

Lowercase identifiers in positional position are automatically converted to string literals:

```gts
tags hydro, catalyst, mondstadt;
// transpiles to: tags("hydro", "catalyst", "mondstadt")
```

Expressions starting with uppercase or non-identifier characters are kept as-is:

```gts
skills WhisperOfWater;
// transpiles to: skills(WhisperOfWater)  — a variable reference
```

## Shortcut Functions

The colon (`:`) prefix creates shortcut functions — concise syntax for calling methods on a context object.

### Shortcut Expression (`:( expr )`)

```gts
when :( true )
// transpiles to: when(__gts_fnArg => true)
```

### Shortcut Block (`:{ stmts }`)

```gts
:{ console.log("hello"); return 42; }
// transpiles to: (__gts_fnArg => { ... })
```

### Shortcut Argument (`:identifier`)

Inside a shortcut function, `:identifier` accesses a property on the function argument:

```gts
:damage(hydro, 1);
// transpiles to: __gts_fnArg.damage("hydro", 1)
//   (inside an arrow function with __gts_fnArg as the first parameter)
```

The shortcut function receives a single parameter:
1. `__gts_fnArg` — the context object

### Direct Shortcut Function

Inside a named attribute block, if the parser encounters a `:` token or a reserved word, it enters "direct function" mode — the remaining statements are treated as the function body:

```gts
define skill {
  id 12011 as WhisperOfWater;
  cost hydro, 3;
  :damage(hydro, 1);    // <-- direct function starts here
  :summon(MelodyLoop);
}
```

This is equivalent to having an `[Action]` attribute with the function body.


## Binding Exports

The `as` clause after an attribute exports its return value:

```gts
define character {
  id 1201 as Barbara;           // export const Barbara = ...
  id 1201 as private Barbara;   // const Barbara = ... (not exported)
}
```

- `as Name` — public export (default)
- `as public Name` — explicit public export
- `as private Name` — local variable, not exported
- `as protected Name` — **not supported** (throws error)

## TypeScript Interop

GTS files can contain standard TypeScript alongside `define` statements:

```gts
import { A } from "./test2.gts";

export const add = (a: number, b: number) => a + b;

define character {
  id 1201 as Barbara;
  // ...
}

const sub = (a: number, b: number) => a - b;
```

The transpiler preserves all TypeScript code and only transforms GTS-specific constructs. TypeScript type annotations are erased in the final JS output (same as standard TS compilation).

## Reserved Words

GTS adds one keyword to the language:
- **`define`** — starts a define statement (top-level only)

This is a contextual keyword — `define` is only recognized at the start of a top-level statement (with no line break after it).
