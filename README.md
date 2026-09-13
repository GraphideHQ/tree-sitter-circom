## tree-sitter-circom (GraphideHQ fork)

[![Test grammar](https://github.com/GraphideHQ/tree-sitter-circom/actions/workflows/test.yaml/badge.svg)](https://github.com/GraphideHQ/tree-sitter-circom/actions/workflows/test.yaml)

### Fork

This is a fork of [Decurity/tree-sitter-circom](https://github.com/Decurity/tree-sitter-circom)
(forked at `0215052`). What differs from upstream:

- **Compiler-exact syntax.** The grammar was checked construct by construct
  against the official compiler's grammar (`parser/src/lang.lalrpop` in
  [iden3/circom](https://github.com/iden3/circom)) and against circom 2.2.3
  itself. It accepts what the compiler's parser accepts and rejects what it
  rejects, including:
  - hexadecimal literals (`0xFF`);
  - circom 2.2 buses: `bus` definitions, bus-typed signals in every header
    form (`input Point() {tag} p[n];`, `Point(2) output q;`, `Point p;`);
  - tuple declarations (`signal (a, b[n]) <== T()(x);`, `var (i, j) = ...;`,
    `component (c, d);`), tuple and `_` placeholders on assignment left sides;
  - anonymous components with named inputs (`T()(a <== x, b <== y)`) and
    anonymous-component statements;
  - `template custom`/`extern_c`/`parallel` modifiers, templates and buses
    without a parameter list, `parallel` expressions;
  - `input signal x;` header order, signal tags;
  - `log(...)` with strings, `assert(...)`;
  - the compiler's operator precedence tiers (bitwise and shift operators were
    wrong upstream), left-associative `**`, non-associative ternaries, no
    unary `+`, no doubled prefix operators;
  - the compiler's reserved keywords, top-level item order (pragmas, includes,
    definitions, main), and string literal rules.
- **Tree shaped for extraction.** Stable field names on definitions,
  declarations (one `*_declarator` node per declared name), calls, member
  access, statements and operators. See `src/node-types.json`.
- **ABI 15**, generated with tree-sitter CLI 0.26.8, loadable by
  `github.com/tree-sitter/go-tree-sitter` v0.25.0 (ABI 13 to 15).
- **Go module path** `github.com/GraphideHQ/tree-sitter-circom`.
- **Real-world parse check.** `script/parse-corpus.sh` parses every `.circom`
  file of pinned revisions of circomlib, zk-email-verify, circom-ecdsa,
  semaphore, maci, circomlib-ml, iden3's compiler test circuits and others;
  every file the compiler accepts parses without an ERROR or MISSING node.
  `script/parse-corpus.exclude` names the files the compiler rejects.

### Upstream README

> 💡 this grammar is still in development, the structure of the generated AST is not stable

This repository contains a grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter).

The goal of this project is to provide an parser efficient low-dependency parser for circom which targets most circom versions in use and is designed for enabling metaprogramming.


### Navigating this repository
The primary file in this repository is `grammar.js` which describes the tree-sitter grammar.

```
# Primary file:
grammar.js
# Tests:
/test/**/*

# Auto generated:
/src/**/*
index.js
binding.gyp
```

### References
-> Circom Documentation: 
- https://docs.circom.io/

-> Tree-sitter Solidity grammar:
- https://github.com/JoranHonig/tree-sitter-solidity/blob/master/grammar.js

Major inspriration & some structures have been taken from tree-sitter-solidity, a big thanks to the contributors to this repo! 
