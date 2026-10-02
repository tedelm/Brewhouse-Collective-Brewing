package service_test

import (
	"encoding/json"
	"errors"
	"math"
	"testing"

	"brewhouse/internal/service"
)

func TestTaxForDelivery_SwedishBeerFormula(t *testing.T) {
	_, users, _, _, settings, _, _ := testDB(t)
	_, admin := ensureAdminUser(t, users)

	cfg, err := settings.GetAlcoholTaxConfig()
	if err != nil {
		t.Fatalf("get config: %v", err)
	}
	if cfg.Country != "sv" || cfg.RateSEK != 2.28 || cfg.FreeMaxABV != 2.8 {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}

	perL, err := settings.TaxForDelivery(2.8, 1.048, 1)
	if err != nil {
		t.Fatalf("tax 2.8: %v", err)
	}
	if perL != 0 {
		t.Fatalf("expected 0 at 2.8%%, got %v", perL)
	}

	perL, err = settings.TaxForDelivery(5.0, 1.048, 1)
	if err != nil {
		t.Fatalf("tax 5.0: %v", err)
	}
	if math.Abs(perL-11.40) > 1e-9 {
		t.Fatalf("expected 11.40 at 5%% full rate, got %v", perL)
	}

	if _, err := settings.UpdateAlcoholTaxConfigLegacy(admin, 2.28, 2.8, 0.5); err != nil {
		t.Fatalf("update discount: %v", err)
	}
	perL, err = settings.TaxForDelivery(5.0, 1.048, 1)
	if err != nil {
		t.Fatalf("tax 5.0 discounted: %v", err)
	}
	if math.Abs(perL-5.70) > 1e-9 {
		t.Fatalf("expected 5.70 at 5%% with 50%% discount, got %v", perL)
	}
}

func TestUpdateAlcoholTaxConfig_ForbiddenForSuperuser(t *testing.T) {
	_, users, _, _, settings, _, _ := testDB(t)
	_ = ensureAdminActor(t, users)
	su := service.Actor{UserID: 1, Role: service.RoleSuperuser}
	params, _ := json.Marshal(map[string]float64{"rate": 2.28, "free_max_abv": 2.8})
	_, err := settings.UpdateAlcoholTaxConfig(su, params, "full")
	if !errors.Is(err, service.ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}

func TestTaxCountry_NorwaySwitch(t *testing.T) {
	_, users, _, _, settings, _, _ := testDB(t)
	_, admin := ensureAdminUser(t, users)

	if _, err := settings.UpdateRegionalConfig(admin, "NOK", "nb", "nb"); err != nil {
		t.Fatalf("regional: %v", err)
	}
	preview, err := settings.TaxPreview(5.0, 1.048, 1)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if math.Abs(preview.PerLiter-27.05) > 1e-6 {
		t.Fatalf("expected 27.05 NOK/l, got %v", preview.PerLiter)
	}
}

func TestDeleteTank_BlockedWhenBooked(t *testing.T) {
	_, users, breweries, inventory, settings, recipes, schedule := testDB(t)
	_, admin := ensureAdminUser(t, users)
	brewery, err := breweries.Create(admin, "Tank Guard Brewery", "", "", "", "", nil)
	if err != nil {
		t.Fatalf("brewery: %v", err)
	}
	item, err := inventory.Create(admin, service.InventoryItem{
		Category: service.CategoryMalt, Name: "Pale", Unit: "kg", Qty: 20, CostPrice: 10,
	})
	if err != nil {
		t.Fatalf("item: %v", err)
	}
	tank, err := settings.CreateTank(admin, "BookedFV", 500)
	if err != nil {
		t.Fatalf("tank: %v", err)
	}
	created, err := recipes.Create(admin, brewery.ID, "Booked Batch", []service.IngredientInput{
		{InventoryItemID: item.ID, Qty: 5},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := schedule.Book(admin, service.BookRequest{
		RecipeID: created.Recipe.ID, Date: "2031-01-01", TankID: tank.ID, TankDays: 7,
	}); err != nil {
		t.Fatalf("book: %v", err)
	}
	err = settings.DeleteTank(admin, tank.ID)
	if err == nil {
		t.Fatal("expected delete to fail")
	}
	if !errors.Is(err, service.ErrConflict) {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
}
