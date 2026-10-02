package service_test

import (
	"path/filepath"
	"testing"

	"brewhouse/internal/database"
	"brewhouse/internal/service"
)

func demoTestStack(t *testing.T) (
	*service.DemoService,
	*service.UserService,
	*service.BreweryService,
	*service.RecipeService,
	*service.SettingsService,
	*service.InventoryService,
) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "demo-test.db")
	db, err := database.OpenHolder(path)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	access := service.NewAccessService(db)
	users := service.NewUserService(db)
	breweries := service.NewBreweryService(db, access)
	inventory := service.NewInventoryService(db, access)
	settings := service.NewSettingsService(db, access)
	recipes := service.NewRecipeService(db, access, inventory, settings)
	schedule := service.NewScheduleService(db, access)
	demo := service.NewDemoService(db, breweries, inventory, settings, recipes, schedule)
	return demo, users, breweries, recipes, settings, inventory
}

func TestSeedDemoIfNeeded_CreatesPipelineAndSkipsSecondRun(t *testing.T) {
	demo, users, breweries, recipes, settings, _ := demoTestStack(t)
	admin := ensureAdminActor(t, users)

	seeded, err := demo.SeedDemoIfNeeded(admin)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	if !seeded {
		t.Fatal("expected seed on first run")
	}

	info, err := demo.DemoStatus()
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if !info.Present || info.Status != "seeded" {
		t.Fatalf("expected present seeded, got %+v", info)
	}

	list, err := breweries.List(admin)
	if err != nil {
		t.Fatalf("list breweries: %v", err)
	}
	if len(list) != 1 || list[0].Name != "Demo Brewery" {
		t.Fatalf("expected Demo Brewery, got %+v", list)
	}

	batches, err := recipes.List(admin, list[0].ID, true)
	if err != nil {
		t.Fatalf("list recipes: %v", err)
	}
	byStatus := map[string]string{}
	for _, r := range batches {
		byStatus[r.Status] = r.Name
	}
	want := map[string]string{
		service.StatusCreated:          "Session Lager",
		service.StatusScheduled:        "Wheat Beer",
		service.StatusBrewday:          "Stout",
		service.StatusHygieneDone:      "Amber Ale",
		service.StatusReadyForDelivery: "Hazy IPA",
		service.StatusDelivered:        "Nordic Pilsner",
	}
	for status, name := range want {
		if byStatus[status] != name {
			t.Fatalf("status %s: want %q, got %q (all=%v)", status, name, byStatus[status], byStatus)
		}
	}

	tanks, err := settings.ListTanks()
	if err != nil {
		t.Fatalf("list tanks: %v", err)
	}
	if len(tanks) < 2 {
		t.Fatalf("expected at least 2 demo tanks, got %d", len(tanks))
	}

	delivered := batches[0]
	for _, r := range batches {
		if r.Status == service.StatusDelivered {
			delivered = r
			break
		}
	}
	_, done, err := recipes.HygieneStatus(admin, delivered.ID)
	if err != nil {
		t.Fatalf("hygiene status: %v", err)
	}
	if len(done) == 0 {
		t.Fatal("expected hygiene checks on delivered batch")
	}
	for _, ok := range done {
		if !ok {
			t.Fatal("expected all hygiene checks complete on delivered batch")
		}
	}
	if delivered.DeliveredAt == nil || *delivered.DeliveredAt == "" {
		t.Fatal("expected delivered_at on Nordic Pilsner")
	}

	seededAgain, err := demo.SeedDemoIfNeeded(admin)
	if err != nil {
		t.Fatalf("second seed: %v", err)
	}
	if seededAgain {
		t.Fatal("expected second seed to skip")
	}
	list2, err := breweries.List(admin)
	if err != nil {
		t.Fatalf("list after second seed: %v", err)
	}
	if len(list2) != 1 {
		t.Fatalf("expected still 1 brewery, got %d", len(list2))
	}
}

func TestPurgeDemo_RemovesDemoAndDoesNotReseed(t *testing.T) {
	demo, users, breweries, recipes, settings, inventory := demoTestStack(t)
	admin := ensureAdminActor(t, users)

	itemQty := func(category, name string) float64 {
		t.Helper()
		items, err := inventory.ListByCategory(category)
		if err != nil {
			t.Fatalf("list %s: %v", category, err)
		}
		for _, it := range items {
			if it.Name == name {
				return it.Qty
			}
		}
		t.Fatalf("item %s/%q not found", category, name)
		return 0
	}

	maltBefore := itemQty(service.CategoryMalt, "Extra Pale Premium Pilsner Malt")
	hopsBefore := itemQty(service.CategoryHops, "Cascade")
	yeastBefore := itemQty(service.CategoryYeast, "Fermentis SafAle US-05")

	if _, err := demo.SeedDemoIfNeeded(admin); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := demo.PurgeDemo(admin); err != nil {
		t.Fatalf("purge: %v", err)
	}

	if got := itemQty(service.CategoryMalt, "Extra Pale Premium Pilsner Malt"); got != maltBefore {
		t.Fatalf("malt qty after purge: want %v, got %v", maltBefore, got)
	}
	if got := itemQty(service.CategoryHops, "Cascade"); got != hopsBefore {
		t.Fatalf("hops qty after purge: want %v, got %v", hopsBefore, got)
	}
	if got := itemQty(service.CategoryYeast, "Fermentis SafAle US-05"); got != yeastBefore {
		t.Fatalf("yeast qty after purge: want %v, got %v", yeastBefore, got)
	}

	info, err := demo.DemoStatus()
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if info.Present || info.Status != "purged" {
		t.Fatalf("expected purged absent, got %+v", info)
	}

	list, err := breweries.List(admin)
	if err != nil {
		t.Fatalf("list breweries: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("expected no breweries after purge, got %+v", list)
	}

	batches, err := recipes.List(admin, 0, true)
	if err != nil {
		t.Fatalf("list recipes: %v", err)
	}
	if len(batches) != 0 {
		t.Fatalf("expected no recipes after purge, got %d", len(batches))
	}

	tanks, err := settings.ListTanks()
	if err != nil {
		t.Fatalf("list tanks: %v", err)
	}
	for _, tank := range tanks {
		if tank.Name == "Demo FV-1" || tank.Name == "Demo FV-2" {
			t.Fatalf("demo tank %q still present", tank.Name)
		}
	}

	seeded, err := demo.SeedDemoIfNeeded(admin)
	if err != nil {
		t.Fatalf("reseed after purge: %v", err)
	}
	if seeded {
		t.Fatal("expected no reseed after purge")
	}
}

func TestSeedDemoIfNeeded_SkipsWhenBreweryExists(t *testing.T) {
	demo, users, breweries, _, _, _ := demoTestStack(t)
	admin := ensureAdminActor(t, users)

	if _, err := breweries.Create(admin, "Real Brewery", "", "", "", "", "", nil); err != nil {
		t.Fatalf("create brewery: %v", err)
	}
	seeded, err := demo.SeedDemoIfNeeded(admin)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	if seeded {
		t.Fatal("expected skip when brewery already exists")
	}
}
