package tax_test

import (
	"encoding/json"
	"math"
	"testing"

	"brewhouse/internal/service/tax"
)

func almostEqual(a, b, eps float64) bool {
	return math.Abs(a-b) <= eps
}

func profile(country, discount string) tax.Profile {
	return tax.Profile{
		Country:     country,
		Basis:       tax.DefaultBasis(country),
		ParamsJSON:  tax.DefaultParamsJSON(country),
		Params:      json.RawMessage(tax.DefaultParamsJSON(country)),
		DiscountKey: discount,
	}
}

func TestPlatoFromSG_TwelvePlatoApprox(t *testing.T) {
	// ~12 °P wort is roughly SG 1.048
	p := tax.PlatoFromSG(1.048)
	if p < 11.8 || p > 12.2 {
		t.Fatalf("expected ~12 °P at 1.048, got %v", p)
	}
}

func TestSGFromPlato_RoundTrip(t *testing.T) {
	for _, sg := range []float64{1.000, 1.010, 1.048, 1.080, 1.100} {
		p := tax.PlatoFromSG(sg)
		back := tax.SGFromPlato(p)
		if math.Abs(back-sg) > 1e-5 {
			t.Fatalf("round-trip sg=%v plato=%v back=%v", sg, p, back)
		}
	}
}

func TestCalculate_Sweden(t *testing.T) {
	r, err := tax.Calculate(profile(tax.CountrySV, "full"), tax.Input{ABV: 2.8, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if r.PerLiter != 0 {
		t.Fatalf("expected 0 at free max, got %v", r.PerLiter)
	}
	r, err = tax.Calculate(profile(tax.CountrySV, "full"), tax.Input{ABV: 5.0, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 11.40, 1e-6) {
		t.Fatalf("expected 11.40, got %v", r.PerLiter)
	}
	r, err = tax.Calculate(profile(tax.CountrySV, "sv_50"), tax.Input{ABV: 5.0, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 5.70, 1e-6) {
		t.Fatalf("expected 5.70, got %v", r.PerLiter)
	}
}

func TestCalculate_Norway(t *testing.T) {
	r, err := tax.Calculate(profile(tax.CountryNB, "full"), tax.Input{ABV: 5.0, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 27.05, 1e-6) {
		t.Fatalf("expected 27.05 NOK/l, got %v", r.PerLiter)
	}
	// Small-brewery band does not apply above 4.7%
	r, err = tax.Calculate(profile(tax.CountryNB, "nb_50k"), tax.Input{ABV: 5.0, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 27.05, 1e-6) {
		t.Fatalf("5%% should stay ordinary, got %v", r.PerLiter)
	}
	r, err = tax.Calculate(profile(tax.CountryNB, "nb_50k"), tax.Input{ABV: 4.5, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 19.36, 1e-6) {
		t.Fatalf("expected 19.36 at 4.5%% small, got %v", r.PerLiter)
	}
}

func TestCalculate_Denmark(t *testing.T) {
	r, err := tax.Calculate(profile(tax.CountryDA, "full"), tax.Input{ABV: 5.0, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 2.437, 1e-6) {
		t.Fatalf("expected 2.437 DKK/l, got %v", r.PerLiter)
	}
	r, err = tax.Calculate(profile(tax.CountryDA, "da_50"), tax.Input{ABV: 5.0, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 1.2185, 1e-6) {
		t.Fatalf("expected 1.2185 with 50%% reduction, got %v", r.PerLiter)
	}
}

func TestCalculate_Finland(t *testing.T) {
	r, err := tax.Calculate(profile(tax.CountryFI, "full"), tax.Input{ABV: 5.0, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 1.8355, 1e-6) {
		t.Fatalf("expected 1.8355 EUR/l, got %v", r.PerLiter)
	}
}

func TestCalculate_Germany(t *testing.T) {
	r, err := tax.Calculate(profile(tax.CountryDE, "full"), tax.Input{Plato: 12, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 0.09444, 1e-6) {
		t.Fatalf("expected 0.09444 EUR/l, got %v", r.PerLiter)
	}
	r, err = tax.Calculate(profile(tax.CountryDE, "de_5k"), tax.Input{Plato: 12, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 0.0528864, 1e-6) {
		t.Fatalf("expected ~0.05289 EUR/l at 56%%, got %v", r.PerLiter)
	}
}

func TestCalculate_Spain(t *testing.T) {
	r, err := tax.Calculate(profile(tax.CountryES, "full"), tax.Input{ABV: 5.0, Plato: 12, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 0.0996, 1e-6) {
		t.Fatalf("expected 0.0996 EUR/l, got %v", r.PerLiter)
	}
}

func TestCalculate_France(t *testing.T) {
	r, err := tax.Calculate(profile(tax.CountryFR, "full"), tax.Input{ABV: 5.0, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 0.4120, 1e-6) {
		t.Fatalf("expected 0.4120 EUR/l, got %v", r.PerLiter)
	}
	r, err = tax.Calculate(profile(tax.CountryFR, "fr_50"), tax.Input{ABV: 5.0, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 0.2060, 1e-6) {
		t.Fatalf("expected 0.2060 EUR/l reduced, got %v", r.PerLiter)
	}
}

func TestCalculate_Poland(t *testing.T) {
	r, err := tax.Calculate(profile(tax.CountryPL, "full"), tax.Input{Plato: 12, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 1.3764, 1e-6) {
		t.Fatalf("expected 1.3764 PLN/l, got %v", r.PerLiter)
	}
	r, err = tax.Calculate(profile(tax.CountryPL, "pl_50"), tax.Input{Plato: 12, VolumeL: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !almostEqual(r.PerLiter, 0.6882, 1e-6) {
		t.Fatalf("expected 0.6882 PLN/l reduced, got %v", r.PerLiter)
	}
}
