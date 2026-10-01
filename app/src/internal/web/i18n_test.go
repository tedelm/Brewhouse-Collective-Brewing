package web_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestI18n_KeyParityWithEnglish(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	dir := filepath.Join(filepath.Dir(file), "static", "i18n")
	enPath := filepath.Join(dir, "en.json")
	enRaw, err := os.ReadFile(enPath)
	if err != nil {
		t.Fatalf("read en.json: %v", err)
	}
	var en map[string]string
	if err := json.Unmarshal(enRaw, &en); err != nil {
		t.Fatalf("parse en.json: %v", err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read i18n dir: %v", err)
	}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" || e.Name() == "en.json" {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			t.Fatalf("read %s: %v", e.Name(), err)
		}
		var loc map[string]string
		if err := json.Unmarshal(raw, &loc); err != nil {
			t.Fatalf("parse %s: %v", e.Name(), err)
		}
		for k := range en {
			if _, ok := loc[k]; !ok {
				t.Errorf("%s missing key %q", e.Name(), k)
			}
		}
		for k := range loc {
			if _, ok := en[k]; !ok {
				t.Errorf("%s has extra key %q", e.Name(), k)
			}
		}
	}
}
