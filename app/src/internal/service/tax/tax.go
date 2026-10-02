// Package tax calculates national beer excise duty per liter for supported countries.
package tax

import (
	"encoding/json"
	"fmt"
	"math"
)

// Calculation bases stored in alcohol_tax_config.basis.
const (
	BasisABVPerPct    = "abv_per_pct"
	BasisPureAlcohol  = "pure_alcohol"
	BasisPlatoRate    = "plato_rate"
	BasisPlatoBands   = "plato_bands"
)

// Supported tax country codes (not UI language).
const (
	CountrySV = "sv"
	CountryNB = "nb"
	CountryDA = "da"
	CountryFI = "fi"
	CountryDE = "de"
	CountryES = "es"
	CountryFR = "fr"
	CountryPL = "pl"
)

// Profile is one country's editable tax parameters.
type Profile struct {
	Country     string          `json:"country"`
	Basis       string          `json:"basis"`
	ParamsJSON  string          `json:"-"`
	DiscountKey string          `json:"discount_key"`
	Params      json.RawMessage `json:"params"`
}

// DiscountOption is a selectable small-producer band for the Economy UI.
type DiscountOption struct {
	Key   string `json:"key"`
	Label string `json:"label"` // i18n key suffix or human label key
}

// Input is the batch data needed to compute excise.
type Input struct {
	ABV         float64
	Plato       float64
	VolumeL     float64
	DiscountKey string
}

// Result is tax per liter and total for the delivery volume.
type Result struct {
	PerLiter float64        `json:"per_liter"`
	Total    float64        `json:"total"`
	Basis    string         `json:"basis"`
	Meta     map[string]any `json:"meta,omitempty"`
}

// PlatoFromSG converts specific gravity to °Plato (ASBC cubic).
func PlatoFromSG(sg float64) float64 {
	if sg <= 0 {
		return 0
	}
	return -616.868 + 1111.14*sg - 630.272*sg*sg + 135.997*sg*sg*sg
}

// ValidCountry reports whether country is a supported tax jurisdiction.
func ValidCountry(country string) bool {
	switch country {
	case CountrySV, CountryNB, CountryDA, CountryFI, CountryDE, CountryES, CountryFR, CountryPL:
		return true
	default:
		return false
	}
}

// DiscountOptions returns selectable small-producer keys for a country.
func DiscountOptions(country string) []DiscountOption {
	switch country {
	case CountrySV:
		return []DiscountOption{
			{Key: "full", Label: "full"},
			{Key: "sv_50", Label: "sv_50"},
			{Key: "sv_60", Label: "sv_60"},
			{Key: "sv_70", Label: "sv_70"},
			{Key: "sv_80", Label: "sv_80"},
			{Key: "sv_90", Label: "sv_90"},
		}
	case CountryNB:
		return []DiscountOption{
			{Key: "full", Label: "full"},
			{Key: "nb_50k", Label: "nb_50k"},
			{Key: "nb_100k", Label: "nb_100k"},
			{Key: "nb_150k", Label: "nb_150k"},
			{Key: "nb_200k", Label: "nb_200k"},
		}
	case CountryDA:
		return []DiscountOption{
			{Key: "full", Label: "full"},
			{Key: "da_50", Label: "da_50"},
			{Key: "da_5k", Label: "da_5k"},
			{Key: "da_10k", Label: "da_10k"},
			{Key: "da_20k", Label: "da_20k"},
			{Key: "da_50k", Label: "da_50k"},
			{Key: "da_100k", Label: "da_100k"},
		}
	case CountryFI:
		return []DiscountOption{
			{Key: "full", Label: "full"},
			{Key: "fi_50", Label: "fi_50"},
			{Key: "fi_30", Label: "fi_30"},
			{Key: "fi_20", Label: "fi_20"},
			{Key: "fi_10", Label: "fi_10"},
		}
	case CountryDE:
		return []DiscountOption{
			{Key: "full", Label: "full"},
			{Key: "de_5k", Label: "de_5k"},
			{Key: "de_10k", Label: "de_10k"},
			{Key: "de_20k", Label: "de_20k"},
			{Key: "de_40k", Label: "de_40k"},
		}
	case CountryES:
		return []DiscountOption{{Key: "full", Label: "full"}}
	case CountryFR:
		return []DiscountOption{
			{Key: "full", Label: "full"},
			{Key: "fr_50", Label: "fr_50"},
		}
	case CountryPL:
		return []DiscountOption{
			{Key: "full", Label: "full"},
			{Key: "pl_50", Label: "pl_50"},
		}
	default:
		return []DiscountOption{{Key: "full", Label: "full"}}
	}
}

// ValidDiscountKey reports whether key is allowed for country.
func ValidDiscountKey(country, key string) bool {
	for _, o := range DiscountOptions(country) {
		if o.Key == key {
			return true
		}
	}
	return false
}

// Calculate returns excise tax for the given profile and batch input.
func Calculate(p Profile, in Input) (Result, error) {
	if !ValidCountry(p.Country) {
		return Result{}, fmt.Errorf("unsupported tax country %q", p.Country)
	}
	key := in.DiscountKey
	if key == "" {
		key = p.DiscountKey
	}
	if key == "" {
		key = "full"
	}
	params := p.Params
	if len(params) == 0 && p.ParamsJSON != "" {
		params = json.RawMessage(p.ParamsJSON)
	}

	var perL float64
	var err error
	meta := map[string]any{"discount_key": key}

	switch p.Country {
	case CountrySV:
		perL, err = calcSV(params, in.ABV, key)
	case CountryNB:
		perL, err = calcNB(params, in.ABV, key)
	case CountryDA:
		perL, err = calcDA(params, in.ABV, key)
	case CountryFI:
		perL, err = calcFI(params, in.ABV, key)
	case CountryDE:
		perL, err = calcDE(params, in.Plato, key)
		meta["plato"] = in.Plato
	case CountryES:
		perL, err = calcES(params, in.ABV, in.Plato)
		meta["plato"] = in.Plato
	case CountryFR:
		perL, err = calcFR(params, in.ABV, key)
	case CountryPL:
		perL, err = calcPL(params, in.Plato, key)
		meta["plato"] = in.Plato
	default:
		return Result{}, fmt.Errorf("unsupported tax country %q", p.Country)
	}
	if err != nil {
		return Result{}, err
	}
	perL = roundMoney(perL)
	total := roundMoney(perL * in.VolumeL)
	return Result{PerLiter: perL, Total: total, Basis: p.Basis, Meta: meta}, nil
}

func roundMoney(v float64) float64 {
	return math.Round(v*1e6) / 1e6
}

type svParams struct {
	Rate       float64 `json:"rate"`
	FreeMaxABV float64 `json:"free_max_abv"`
}

func calcSV(raw json.RawMessage, abv float64, key string) (float64, error) {
	var p svParams
	if err := json.Unmarshal(raw, &p); err != nil {
		return 0, fmt.Errorf("sv params: %w", err)
	}
	if abv <= p.FreeMaxABV {
		return 0, nil
	}
	mult := svDiscountMult(key)
	return abv * p.Rate * mult, nil
}

func svDiscountMult(key string) float64 {
	switch key {
	case "sv_50", "0.5":
		return 0.5
	case "sv_60", "0.6":
		return 0.6
	case "sv_70", "0.7":
		return 0.7
	case "sv_80", "0.8":
		return 0.8
	case "sv_90", "0.9":
		return 0.9
	default:
		return 1.0
	}
}

type nbParams struct {
	Rate float64 `json:"rate"`
}

func calcNB(raw json.RawMessage, abv float64, key string) (float64, error) {
	var p nbParams
	if err := json.Unmarshal(raw, &p); err != nil {
		return 0, fmt.Errorf("nb params: %w", err)
	}
	// Reduced Norwegian rates apply only for fermented drinks >3.7% to ≤4.7%.
	if key != "full" && abv > 3.7 && abv <= 4.7 {
		switch key {
		case "nb_50k":
			return 19.36, nil
		case "nb_100k":
			return 20.58, nil
		case "nb_150k":
			return 21.79, nil
		case "nb_200k":
			return 23.00, nil
		}
	}
	return p.Rate * abv, nil
}

type daParams struct {
	Rate       float64 `json:"rate"`
	FreeMaxABV float64 `json:"free_max_abv"`
}

func calcDA(raw json.RawMessage, abv float64, key string) (float64, error) {
	var p daParams
	if err := json.Unmarshal(raw, &p); err != nil {
		return 0, fmt.Errorf("da params: %w", err)
	}
	if abv <= p.FreeMaxABV {
		return 0, nil
	}
	base := p.Rate * (abv / 100.0)
	reduction := daReductionPct(key)
	return base * (1.0 - reduction/100.0), nil
}

func daReductionPct(key string) float64 {
	switch key {
	case "da_50":
		return 50
	case "da_5k":
		return 168607.0/5000.0 + 4.43
	case "da_10k":
		return 168607.0/10000.0 + 4.43
	case "da_20k":
		return 14.29 - 20000.0/14003.0
	case "da_50k":
		return 14.29 - 50000.0/14003.0
	case "da_100k":
		return 14.29 - 100000.0/14003.0
	default:
		return 0
	}
}

type fiParams struct {
	RateLowCentsPerCL  float64 `json:"rate_low_cents_per_cl"`
	RateHighCentsPerCL float64 `json:"rate_high_cents_per_cl"`
	LowMaxABV          float64 `json:"low_max_abv"`
	MinABV             float64 `json:"min_abv"`
}

func calcFI(raw json.RawMessage, abv float64, key string) (float64, error) {
	var p fiParams
	if err := json.Unmarshal(raw, &p); err != nil {
		return 0, fmt.Errorf("fi params: %w", err)
	}
	if abv <= p.MinABV {
		return 0, nil
	}
	centsPerCL := p.RateHighCentsPerCL
	if abv <= p.LowMaxABV {
		centsPerCL = p.RateLowCentsPerCL
	}
	// 1 L × ABV% = ABV cl pure alcohol; cents → EUR.
	perL := (abv * centsPerCL) / 100.0
	reduction := fiReductionPct(key)
	return perL * (1.0 - reduction/100.0), nil
}

func fiReductionPct(key string) float64 {
	switch key {
	case "fi_50":
		return 50
	case "fi_30":
		return 30
	case "fi_20":
		return 20
	case "fi_10":
		return 10
	default:
		return 0
	}
}

type deParams struct {
	RatePerHLPlato float64 `json:"rate_per_hl_plato"`
}

func calcDE(raw json.RawMessage, plato float64, key string) (float64, error) {
	var p deParams
	if err := json.Unmarshal(raw, &p); err != nil {
		return 0, fmt.Errorf("de params: %w", err)
	}
	perHL := p.RatePerHLPlato * plato * deShare(key)
	return perHL / 100.0, nil // EUR/hl → EUR/L
}

func deShare(key string) float64 {
	switch key {
	case "de_5k":
		return 0.560
	case "de_10k":
		return 0.672
	case "de_20k":
		return 0.784
	case "de_40k":
		return 0.840
	default:
		return 1.0
	}
}

type esBand struct {
	MaxABV    *float64 `json:"max_abv"`
	MinABV    *float64 `json:"min_abv"`
	MinPlato  *float64 `json:"min_plato"`
	MaxPlato  *float64 `json:"max_plato"`
	PerHL     *float64 `json:"per_hl"`
	PerHLPlato *float64 `json:"per_hl_plato"`
}

type esParams struct {
	Bands []esBand `json:"bands"`
}

func calcES(raw json.RawMessage, abv, plato float64) (float64, error) {
	var p esParams
	if err := json.Unmarshal(raw, &p); err != nil {
		return 0, fmt.Errorf("es params: %w", err)
	}
	if len(p.Bands) == 0 {
		// Built-in 2026 Spanish bands if params omit explicit list.
		return esBuiltin(abv, plato), nil
	}
	for _, b := range p.Bands {
		if b.MaxABV != nil && abv <= *b.MaxABV {
			if b.PerHL != nil {
				return *b.PerHL / 100.0, nil
			}
		}
	}
	return esBuiltin(abv, plato), nil
}

func esBuiltin(abv, plato float64) float64 {
	switch {
	case abv <= 1.2:
		return 0
	case abv <= 2.8:
		return 2.75 / 100.0
	case plato < 11:
		return 7.48 / 100.0
	case plato <= 15:
		return 9.96 / 100.0
	case plato <= 19:
		return 13.56 / 100.0
	default:
		return (0.91 * plato) / 100.0
	}
}

type frParams struct {
	RateHigh   float64 `json:"rate_high"`
	RateLow    float64 `json:"rate_low"`
	LowMaxABV  float64 `json:"low_max_abv"`
}

func calcFR(raw json.RawMessage, abv float64, key string) (float64, error) {
	var p frParams
	if err := json.Unmarshal(raw, &p); err != nil {
		return 0, fmt.Errorf("fr params: %w", err)
	}
	rate := p.RateHigh
	if abv < p.LowMaxABV {
		rate = p.RateLow
	}
	if key == "fr_50" {
		rate = p.RateLow // reduced = half of high; same as low rate for >2.8%
		if abv < p.LowMaxABV {
			rate = p.RateLow // already low; small brewery still uses low? Plan: half of standard.
			// For <2.8%, standard is already rate_low; half would be rate_low/2.
			// Underlag: reduced is 4.12 for independent ≤200k hl (half of 8.24).
			// For beers under 2.8%, ordinary is 4.12 — keep 4.12 when on reduced key.
			rate = p.RateLow
		}
	}
	perHL := rate * abv
	return perHL / 100.0, nil
}

type plParams struct {
	RatePerHLPlato float64 `json:"rate_per_hl_plato"`
}

func calcPL(raw json.RawMessage, plato float64, key string) (float64, error) {
	var p plParams
	if err := json.Unmarshal(raw, &p); err != nil {
		return 0, fmt.Errorf("pl params: %w", err)
	}
	perHL := p.RatePerHLPlato * plato
	if key == "pl_50" {
		perHL *= 0.5
	}
	return perHL / 100.0, nil
}

// DefaultParamsJSON returns 2026 seed params for a country.
func DefaultParamsJSON(country string) string {
	switch country {
	case CountrySV:
		return `{"rate":2.28,"free_max_abv":2.8}`
	case CountryNB:
		return `{"rate":5.41}`
	case CountryDA:
		return `{"rate":48.74,"free_max_abv":2.7}`
	case CountryFI:
		return `{"rate_low_cents_per_cl":28.75,"rate_high_cents_per_cl":36.71,"low_max_abv":3.5,"min_abv":0.5}`
	case CountryDE:
		return `{"rate_per_hl_plato":0.787}`
	case CountryES:
		return `{"bands":[]}`
	case CountryFR:
		return `{"rate_high":8.24,"rate_low":4.12,"low_max_abv":2.8}`
	case CountryPL:
		return `{"rate_per_hl_plato":11.47}`
	default:
		return `{}`
	}
}

// DefaultBasis returns the calculation basis for a country.
func DefaultBasis(country string) string {
	switch country {
	case CountrySV, CountryNB, CountryFR:
		return BasisABVPerPct
	case CountryDA, CountryFI:
		return BasisPureAlcohol
	case CountryDE, CountryPL:
		return BasisPlatoRate
	case CountryES:
		return BasisPlatoBands
	default:
		return BasisABVPerPct
	}
}

// AllCountries returns supported tax country codes in stable order.
func AllCountries() []string {
	return []string{
		CountrySV, CountryNB, CountryDA, CountryFI,
		CountryDE, CountryES, CountryFR, CountryPL,
	}
}
