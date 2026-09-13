/**
 * @file Circom grammar for tree-sitter
 * @license MIT
 *
 * The source of truth is the official compiler's LALRPOP grammar,
 * iden3/circom parser/src/lang.lalrpop. Rule comments name the compiler
 * production each rule mirrors. Where this grammar is knowingly more lenient
 * than the compiler it says so in a comment.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Binary operator tiers, lowest to highest (Expression12 .. Expression3).
// Every tier is left-associative in the compiler, `**` included.
const PREC = {
  OR: 1, // ||
  AND: 2, // &&
  CMP: 3, // == != < > <= >=
  BIT_OR: 4, // |
  BIT_XOR: 5, // ^
  BIT_AND: 6, // &
  SHIFT: 7, // << >>
  ADD: 8, // + -
  MUL: 9, // * / \ %
  POW: 10, // **
};

const COMPOUND_ASSIGNMENT_OPERATORS = [
  '+=', '-=', '*=', '/=', '\\=', '%=', '**=',
  '<<=', '>>=', '&=', '|=', '^=',
];

module.exports = grammar({
  name: 'circom',

  word: $ => $.identifier,

  conflicts: $ => [
    // `(T()(x))` is the start of either an anonymous-component statement or
    // the left side of an assignment; only the token after the `)` decides.
    [$.call_expression, $._anonymous_component_call],
  ],

  // Every string literal in lang.lalrpop is a keyword of the compiler's lexer,
  // so none of them can be used as an identifier.
  reserved: {
    global: _ => [
      'pragma', 'circom', 'custom_templates', 'include',
      'template', 'custom', 'extern_c', 'parallel', 'function', 'bus',
      'component', 'main', 'public',
      'signal', 'input', 'output', 'var',
      'if', 'else', 'for', 'while', 'return', 'log', 'assert',
    ],
  },

  extras: $ => [
    /\s/,
    $.comment,
  ],

  rules: {
    // ParseAst: pragmas, then includes, then definitions, then at most one
    // main component, in that order.
    source_file: $ => seq(
      repeat($.pragma_directive),
      repeat($.include_directive),
      repeat($._definition),
      optional($.main_component_definition),
    ),

    // -- [ Pragma ] --------------------------------------------------------
    // ParsePragma
    pragma_directive: $ => seq(
      'pragma',
      choice($.circom_pragma_token, $.circom_custom_templates_token),
      ';',
    ),

    circom_custom_templates_token: _ => 'custom_templates',

    circom_pragma_token: $ => seq(
      'circom',
      field('version', $.circom_version),
    ),

    // Version: SMALL_DECNUMBER "." SMALL_DECNUMBER "." SMALL_DECNUMBER
    circom_version: _ => seq(/[0-9]+/, '.', /[0-9]+/, '.', /[0-9]+/),

    // -- [ Include ] -------------------------------------------------------
    // ParseInclude
    include_directive: $ => seq(
      'include',
      field('source', $.string),
      ';',
    ),

    // STRING: r#""[^"\n]*""# -- no escapes, no single quotes. The compiler
    // strips comments before it lexes, without regard to quotes, so `//`
    // cannot occur inside a string and a `/* ... */` inside one is dropped.
    string: _ => token(seq(
      '"',
      repeat(choice(
        /[^"\n\/]/,
        /\/[^"\n\/*]/,
        /\/\*[^*]*\*+([^/*][^*]*\*+)*\//,
      )),
      optional('/'),
      '"',
    )),

    // -- [ Definitions ] ---------------------------------------------------
    // ParseDefinition
    _definition: $ => choice(
      $.function_definition,
      $.template_definition,
      $.bus_definition,
    ),

    template_definition: $ => seq(
      'template',
      optional(field('modifier', $.custom)),
      optional(field('modifier', $.extern_c)),
      optional(field('modifier', $.parallel)),
      field('name', $.identifier),
      optional(field('parameters', $.parameter_list)),
      field('body', $.template_body),
    ),

    template_body: $ => seq('{', repeat($._block_item), '}'),

    function_definition: $ => seq(
      'function',
      field('name', $.identifier),
      field('parameters', $.parameter_list),
      field('body', $.function_body),
    ),

    function_body: $ => seq('{', repeat($._block_item), '}'),

    // circom 2.2
    bus_definition: $ => seq(
      'bus',
      field('name', $.identifier),
      optional(field('parameters', $.parameter_list)),
      field('body', $.bus_body),
    ),

    bus_body: $ => seq('{', repeat($._block_item), '}'),

    parameter_list: $ => seq('(', commaSep($.parameter), ')'),

    parameter: $ => field('name', $.identifier),

    // ParseMainComponent
    main_component_definition: $ => seq(
      'component',
      'main',
      optional(field('public_signals', $.main_component_public_signals)),
      '=',
      field('value', $._expression),
      ';',
    ),

    // ParsePublicList
    main_component_public_signals: $ => seq(
      '{', 'public', '[', commaSep1($.identifier), ']', '}',
    ),

    // -- [ Statements ] ----------------------------------------------------
    // ParseStatement3: what a block may contain.
    _block_item: $ => choice(
      $._declaration,
      $._statement,
    ),

    _declaration: $ => choice(
      $.signal_declaration_statement,
      $.variable_declaration_statement,
      $.component_declaration_statement,
    ),

    // ParseStatement0/1/2: declarations cannot be the unbraced body of an
    // if, for or while.
    _statement: $ => choice(
      $.if_statement,
      $._loop_body,
    ),

    // ParseStatement2: a for/while body cannot be an unbraced if.
    _loop_body: $ => choice(
      $.for_statement,
      $.while_statement,
      $.return_statement,
      $.expression_statement,
      $.log_statement,
      $.assert_statement,
      $.block_statement,
    ),

    // ParseBlock
    block_statement: $ => seq('{', repeat($._block_item), '}'),

    if_statement: $ => prec.right(seq(
      'if',
      '(',
      field('condition', $._expression),
      ')',
      field('consequence', $._statement),
      optional(seq('else', field('alternative', $._statement))),
    )),

    for_statement: $ => seq(
      'for',
      '(',
      choice(
        field('initializer', $._declaration),
        seq(field('initializer', $._substitution), ';'),
      ),
      field('condition', $._expression),
      ';',
      field('update', $._substitution),
      ')',
      field('body', $._loop_body),
    ),

    while_statement: $ => seq(
      'while',
      '(',
      field('condition', $._expression),
      ')',
      field('body', $._loop_body),
    ),

    return_statement: $ => seq(
      'return',
      field('value', $._expression),
      ';',
    ),

    // ParseStatementLog
    log_statement: $ => seq(
      'log',
      '(',
      commaSep(field('argument', choice($.string, $._expression))),
      ')',
      ';',
    ),

    assert_statement: $ => seq(
      'assert',
      '(',
      field('condition', $._expression),
      ')',
      ';',
    ),

    // ParseSubstitution ";", `lhe === rhe ;`, and `lhe ;` -- the compiler only
    // accepts a bare expression statement when it is an anonymous component.
    expression_statement: $ => seq(
      choice(
        $.assignment_expression,
        $.increment_expression,
        $.decrement_expression,
        $._anonymous_component_statement,
      ),
      ';',
    ),

    _anonymous_component_statement: $ => choice(
      alias($._anonymous_component_call, $.call_expression),
      alias($._parenthesized_anonymous_component, $.parenthesized_expression),
    ),

    _parenthesized_anonymous_component: $ => seq(
      '(', $._anonymous_component_statement, ')',
    ),

    // ParseSubstitution (what a for initializer/update may be)
    _substitution: $ => choice(
      alias($._substitution_assignment, $.assignment_expression),
      $.increment_expression,
      $.decrement_expression,
    ),

    assignment_expression: $ => choice(
      $._substitution_assignment,
      seq(
        field('left', $._expression),
        field('operator', '==='),
        field('right', $._expression),
      ),
    ),

    _substitution_assignment: $ => choice(
      seq(
        field('left', $._expression),
        field('operator', choice('=', '<--', '<==', '-->', '==>')),
        field('right', $._expression),
      ),
      seq(
        field('left', $._variable),
        field('operator', choice(...COMPOUND_ASSIGNMENT_OPERATORS)),
        field('right', $._expression),
      ),
    ),

    increment_expression: $ => seq(field('argument', $._variable), '++'),

    decrement_expression: $ => seq(field('argument', $._variable), '--'),

    // -- [ Declarations ] --------------------------------------------------
    // ParseDeclaration

    // `signal [input|output] [{tags}] a, b[n] <== e;`
    // `input signal [{tags}] a;`
    // `signal [input|output] [{tags}] (a, b[n]) [<==|<--|= e];`
    // `[input|output] Bus[(args)] [{tags}] p, q[n];`   (circom 2.2)
    // `Bus[(args)] [input|output] [{tags}] p;`         (circom 2.2)
    signal_declaration_statement: $ => seq(
      choice(
        seq($._signal_header, choice($._signal_declarators, $._signal_tuple)),
        seq($._bus_header, $._signal_declarators),
      ),
      ';',
    ),

    // SignalHeader
    _signal_header: $ => seq(
      choice(
        seq('signal', optional(field('direction', $.signal_visibility))),
        seq(field('direction', $.signal_visibility), 'signal'),
      ),
      optional(field('tags', $.signal_tags)),
    ),

    // BusHeader
    _bus_header: $ => seq(
      choice(
        seq(field('type', $.bus_type), optional(field('direction', $.signal_visibility))),
        seq(field('direction', $.signal_visibility), field('type', $.bus_type)),
      ),
      optional(field('tags', $.signal_tags)),
    ),

    bus_type: $ => seq(
      field('name', $.identifier),
      optional(seq('(', optional(field('arguments', $.argument_list)), ')')),
    ),

    // Either every declarator uses `<--`, or none does (SignalSimpleSymbol
    // lists versus SignalSymbol lists).
    _signal_declarators: $ => choice(
      commaSep1(field('declarator', $.signal_declarator)),
      commaSep1(field('declarator', alias($._signal_declarator_unconstrained, $.signal_declarator))),
    ),

    signal_declarator: $ => seq(
      field('name', $.identifier),
      optional(field('dimensions', $.array_type)),
      optional(seq(field('operator', '<=='), field('value', $._expression))),
    ),

    _signal_declarator_unconstrained: $ => seq(
      field('name', $.identifier),
      optional(field('dimensions', $.array_type)),
      field('operator', '<--'),
      field('value', $._expression),
    ),

    _signal_tuple: $ => seq(
      '(',
      commaSep1(field('declarator', alias($._simple_declarator, $.signal_declarator))),
      ')',
      optional($._tuple_initialization),
    ),

    signal_visibility: _ => choice('input', 'output'),

    // ParseTagsList
    signal_tags: $ => seq('{', commaSep1($.identifier), '}'),

    variable_declaration_statement: $ => seq(
      'var',
      choice(
        commaSep1(field('declarator', $.variable_declarator)),
        seq(
          '(',
          commaSep1(field('declarator', alias($._simple_declarator, $.variable_declarator))),
          ')',
          optional($._tuple_initialization),
        ),
      ),
      ';',
    ),

    variable_declarator: $ => seq(
      field('name', $.identifier),
      optional(field('dimensions', $.array_type)),
      optional(seq(field('operator', '='), field('value', $._expression))),
    ),

    component_declaration_statement: $ => seq(
      'component',
      choice(
        commaSep1(field('declarator', $.component_declarator)),
        seq(
          '(',
          commaSep1(field('declarator', alias($._simple_declarator, $.component_declarator))),
          ')',
          optional($._tuple_initialization),
        ),
      ),
      ';',
    ),

    component_declarator: $ => seq(
      field('name', $.identifier),
      optional(field('dimensions', $.array_type)),
      optional(seq(field('operator', '='), field('value', $._expression))),
    ),

    // SimpleSymbol
    _simple_declarator: $ => seq(
      field('name', $.identifier),
      optional(field('dimensions', $.array_type)),
    ),

    // TupleInitialization
    _tuple_initialization: $ => seq(
      field('operator', choice('<==', '<--', '=')),
      field('value', $._expression),
    ),

    // ParseArrayAcc*
    array_type: $ => repeat1(seq('[', $._expression, ']')),

    // -- [ Expressions ] ---------------------------------------------------
    // ParseExpression: Expression14 | ParseExpression1
    _expression: $ => choice(
      $.parallel_expression,
      $._expression1,
    ),

    // Expression14
    parallel_expression: $ => seq('parallel', field('expression', $._expression1)),

    // ParseExpression1: Expression13 | Expression12
    _expression1: $ => choice(
      $.ternary_expression,
      $._operand,
    ),

    // Expression13: not associative, the branches cannot be ternaries
    // without parentheses.
    ternary_expression: $ => seq(
      field('condition', $._operand),
      '?',
      field('consequence', $._operand),
      ':',
      field('alternative', $._operand),
    ),

    // Expression12 .. Expression2
    _operand: $ => choice(
      $.binary_expression,
      $.unary_expression,
      $._primary_expression,
    ),

    binary_expression: $ => choice(
      ...[
        ['||', PREC.OR],
        ['&&', PREC.AND],
        ['==', PREC.CMP],
        ['!=', PREC.CMP],
        ['<', PREC.CMP],
        ['>', PREC.CMP],
        ['<=', PREC.CMP],
        ['>=', PREC.CMP],
        ['|', PREC.BIT_OR],
        ['^', PREC.BIT_XOR],
        ['&', PREC.BIT_AND],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MUL],
        ['/', PREC.MUL],
        ['\\', PREC.MUL],
        ['%', PREC.MUL],
        ['**', PREC.POW],
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field('left', $._operand),
          // @ts-ignore
          field('operator', operator),
          field('right', $._operand),
        )),
      ),
    ),

    // Expression2: PrefixOpTier over Expression1, so a prefix operator
    // cannot be applied twice (`- -x`) and binds tighter than `**`.
    unary_expression: $ => seq(
      field('operator', choice('!', '~', '-')),
      field('argument', $._primary_expression),
    ),

    // Expression1 | Expression0
    _primary_expression: $ => choice(
      $.call_expression,
      $.array_expression,
      $.tuple_expression,
      $.identifier,
      $.member_expression,
      $.array_access_expression,
      $.placeholder,
      $.int_literal,
      $.parenthesized_expression,
    ),

    // Function call, template instantiation, or anonymous component
    // `T(params)(inputs)`.
    call_expression: $ => seq(
      field('function', $.identifier),
      '(',
      optional(field('arguments', $.argument_list)),
      ')',
      optional(field('inputs', $.anonymous_inputs)),
    ),

    _anonymous_component_call: $ => seq(
      field('function', $.identifier),
      '(',
      optional(field('arguments', $.argument_list)),
      ')',
      field('inputs', $.anonymous_inputs),
    ),

    // ListableAnon: all positional, or all named.
    anonymous_inputs: $ => seq(
      '(',
      optional(choice(
        $.argument_list,
        commaSep1(field('input', $.named_input)),
      )),
      ')',
    ),

    // ListableWithInputNames element
    named_input: $ => seq(
      field('name', $.identifier),
      field('operator', choice('=', '<--', '<==')),
      field('value', $._expression),
    ),

    argument_list: $ => commaSep1(field('argument', $._expression)),

    array_expression: $ => seq('[', commaSep1($._expression), ']'),

    // TwoElemsListable
    tuple_expression: $ => seq(
      '(',
      $._expression,
      ',',
      commaSep1($._expression),
      ')',
    ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    // ParseVariable: accesses only apply to a plain identifier chain, never
    // to a call or a parenthesized expression.
    _variable: $ => choice(
      $.identifier,
      $.member_expression,
      $.array_access_expression,
    ),

    member_expression: $ => seq(
      field('object', $._variable),
      '.',
      field('property', alias($.identifier, $.property_identifier)),
    ),

    array_access_expression: $ => seq(
      field('base', $._variable),
      '[',
      field('index', $._expression),
      ']',
    ),

    // The anonymous variable `_`.
    placeholder: _ => '_',

    // DECNUMBER | HEXNUMBER
    int_literal: _ => token(choice(
      /0x[0-9A-Fa-f]+/,
      /[0-9]+/,
    )),

    identifier: _ => /[$_]*[a-zA-Z][a-zA-Z$_0-9]*/,

    custom: _ => 'custom',

    extern_c: _ => 'extern_c',

    parallel: _ => 'parallel',

    // The compiler strips comments in a preprocessing pass, so they may
    // appear anywhere whitespace may.
    comment: _ => token(choice(
      seq('//', /[^\r\n]*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
    )),
  },
});

/**
 * @param {RuleOrLiteral} rule
 * @return {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

/**
 * @param {RuleOrLiteral} rule
 * @return {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}
