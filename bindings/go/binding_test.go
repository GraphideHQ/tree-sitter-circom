package tree_sitter_circom_test

import (
	"strings"
	"testing"

	tree_sitter_circom "github.com/GraphideHQ/tree-sitter-circom/bindings/go"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_circom.Language())
	if language == nil {
		t.Fatal("Error loading Circom grammar")
	}
	parser := tree_sitter.NewParser()
	defer parser.Close()
	if err := parser.SetLanguage(language); err != nil {
		t.Fatalf("SetLanguage: %v", err)
	}
}

func TestParsesHexLiteralsAndBuses(t *testing.T) {
	source := []byte(`pragma circom 2.2.0;
bus Point() {
    signal x;
    signal y;
}
template T() {
    input Point() {edwards} p;
    output signal o;
    o <== p.x * 0xFF;
}
component main {public [p]} = T();
`)
	parser := tree_sitter.NewParser()
	defer parser.Close()
	if err := parser.SetLanguage(tree_sitter.NewLanguage(tree_sitter_circom.Language())); err != nil {
		t.Fatalf("SetLanguage: %v", err)
	}
	tree := parser.Parse(source, nil)
	defer tree.Close()
	root := tree.RootNode()
	if root.HasError() {
		t.Fatalf("unexpected parse error: %s", root.ToSexp())
	}
	sexp := root.ToSexp()
	for _, want := range []string{
		"(bus_definition name: (identifier)",
		"type: (bus_type name: (identifier))",
		"(int_literal)",
		"public_signals: (main_component_public_signals",
	} {
		if !strings.Contains(sexp, want) {
			t.Errorf("tree lacks %q:\n%s", want, sexp)
		}
	}
}
