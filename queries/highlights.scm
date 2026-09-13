; identifiers
; -----------
(identifier) @variable

; Pragma
; -----------
(pragma_directive) @tag

; Include
; -----------
(include_directive) @include

; Literals
; --------

(string) @string
(int_literal) @number
(comment) @comment

; Definitions
; -----------

(function_definition
  name: (identifier) @function)

(template_definition
  name: (identifier) @function)

(bus_definition
  name: (identifier) @type)

(bus_type
  name: (identifier) @type)

; Use contructor coloring for special functions
(main_component_definition) @constructor

; Invocations

(call_expression
  function: (identifier) @function)

; Function parameters
(parameter name: (identifier) @variable.parameter)

; Members
(member_expression property: (property_identifier) @property)

(named_input name: (identifier) @property)

(signal_tags (identifier) @attribute)

(placeholder) @variable.builtin

; Tokens
; -------

; Keywords

[
 "pragma"
 "circom"
 (circom_custom_templates_token)
 "public"
 "signal"
 "var"
 "include"
 "input"
 "output"
 "component"
 "main"
 "bus"
 "parallel"
 "log"
 "assert"
 (custom)
 (extern_c)
 (parallel)
] @keyword

[
 "for"
 "while"
] @repeat

[
 "if"
 "else"
] @conditional

[
 "return"
] @keyword.return

[
  "function"
  "template"
] @keyword.function

; Punctuation

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  "."
  ","
  ";"
] @punctuation.delimiter

; Operators

[
  "&&"
  "||"
  ">>"
  "<<"
  "&"
  "^"
  "|"
  "+"
  "-"
  "*"
  "/"
  "\\"
  "%"
  "**"
  "<"
  "<="
  "=="
  "!="
  ">="
  ">"
  "!"
  "~"
  "++"
  "--"
  "?"
  ":"
  "="
  "+="
  "-="
  "*="
  "/="
  "\\="
  "%="
  "**="
  "<<="
  ">>="
  "&="
  "|="
  "^="
] @operator

[
  "<=="
  "==>"
  "<--"
  "-->"
  "==="
] @assignment
