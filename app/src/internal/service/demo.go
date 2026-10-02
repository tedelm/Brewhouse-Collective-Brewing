package service

import (
	"database/sql"
	_ "embed"
	"fmt"
	"time"

	"brewhouse/internal/database"
)

//go:embed demo_logo.png
var demoBreweryLogoPNG []byte

const (
	metaDemoStatus     = "demo_status"
	demoStatusSeeded   = "seeded"
	demoStatusPurged   = "purged"
	demoBreweryName    = "Demo Brewery"
	demoTank1Name      = "Demo FV-1"
	demoTank2Name      = "Demo FV-2"
	demoMaltName       = "Extra Pale Premium Pilsner Malt"
	demoHopsName       = "Cascade"
	demoYeastName      = "Fermentis SafAle US-05"
	demoMaltTopUp      = 200.0
	demoHopsTopUp      = 3000.0
	demoYeastTopUp     = 20.0
)

// DemoService seeds and purges first-run demo brewery data.
type DemoService struct {
	db         *database.Holder
	breweries  *BreweryService
	inventory  *InventoryService
	settings   *SettingsService
	recipes    *RecipeService
	schedule   *ScheduleService
}

// NewDemoService creates a DemoService.
func NewDemoService(
	db *database.Holder,
	breweries *BreweryService,
	inventory *InventoryService,
	settings *SettingsService,
	recipes *RecipeService,
	schedule *ScheduleService,
) *DemoService {
	return &DemoService{
		db:        db,
		breweries: breweries,
		inventory: inventory,
		settings:  settings,
		recipes:   recipes,
		schedule:  schedule,
	}
}

// DemoStatusInfo describes whether demo data is present and the meta flag.
type DemoStatusInfo struct {
	Present bool   `json:"present"`
	Status  string `json:"status"`
}

// DemoStatus returns whether a demo brewery exists and the persisted demo_status flag.
func (s *DemoService) DemoStatus() (DemoStatusInfo, error) {
	status, err := s.getMeta(metaDemoStatus)
	if err != nil {
		return DemoStatusInfo{}, err
	}
	var n int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM breweries WHERE is_demo = 1`).Scan(&n); err != nil {
		return DemoStatusInfo{}, fmt.Errorf("count demo breweries: %w", err)
	}
	return DemoStatusInfo{Present: n > 0, Status: status}, nil
}

// SeedDemoIfNeeded creates the demo brewery and pipeline batches on first run.
// Skips when demo_status is already set or any brewery already exists.
func (s *DemoService) SeedDemoIfNeeded(actor Actor) (bool, error) {
	if !actor.IsAdmin() {
		return false, ErrForbidden
	}
	status, err := s.getMeta(metaDemoStatus)
	if err != nil {
		return false, err
	}
	if status == demoStatusSeeded || status == demoStatusPurged {
		return false, nil
	}
	var breweryCount int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM breweries`).Scan(&breweryCount); err != nil {
		return false, fmt.Errorf("count breweries: %w", err)
	}
	if breweryCount > 0 {
		return false, nil
	}

	if err := s.seedDemo(actor); err != nil {
		return false, err
	}
	if err := s.setMeta(metaDemoStatus, demoStatusSeeded); err != nil {
		return false, err
	}
	return true, nil
}

// PurgeDemo removes demo brewery, tanks, and batches, then marks demo as purged
// so it will not reseed on later restarts.
func (s *DemoService) PurgeDemo(actor Actor) error {
	if !actor.IsAdmin() {
		return ErrForbidden
	}
	info, err := s.DemoStatus()
	if err != nil {
		return err
	}
	if !info.Present {
		if err := s.setMeta(metaDemoStatus, demoStatusPurged); err != nil {
			return err
		}
		return nil
	}

	rows, err := s.db.Query(`SELECT id FROM breweries WHERE is_demo = 1`)
	if err != nil {
		return fmt.Errorf("list demo breweries: %w", err)
	}
	var breweryIDs []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		breweryIDs = append(breweryIDs, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, breweryID := range breweryIDs {
		if _, err := s.db.Exec(
			`DELETE FROM inventory_orders
			 WHERE id IN (
			   SELECT DISTINCT order_id FROM inventory_order_lines WHERE brewery_id = ?
			 )`,
			breweryID,
		); err != nil {
			return fmt.Errorf("delete demo orders for brewery %d: %w", breweryID, err)
		}
		recipeRows, err := s.db.Query(`SELECT id FROM recipes WHERE brewery_id = ?`, breweryID)
		if err != nil {
			return fmt.Errorf("list demo recipes: %w", err)
		}
		var recipeIDs []int64
		for recipeRows.Next() {
			var id int64
			if err := recipeRows.Scan(&id); err != nil {
				recipeRows.Close()
				return err
			}
			recipeIDs = append(recipeIDs, id)
		}
		recipeRows.Close()
		if err := recipeRows.Err(); err != nil {
			return err
		}
		for _, recipeID := range recipeIDs {
			if err := s.purgeRecipe(actor, recipeID); err != nil {
				return fmt.Errorf("purge recipe %d: %w", recipeID, err)
			}
		}
		if _, err := s.db.Exec(`DELETE FROM breweries WHERE id = ?`, breweryID); err != nil {
			return fmt.Errorf("delete demo brewery: %w", err)
		}
	}

	if _, err := s.db.Exec(`DELETE FROM fermentation_tanks WHERE is_demo = 1`); err != nil {
		return fmt.Errorf("delete demo tanks: %w", err)
	}
	if err := s.reverseDemoInventoryTopUps(actor); err != nil {
		return err
	}
	return s.setMeta(metaDemoStatus, demoStatusPurged)
}

func (s *DemoService) seedDemo(actor Actor) error {
	adminID := actor.UserID
	brewery, err := s.breweries.Create(
		actor,
		demoBreweryName,
		"Demo Brewer",
		"demo@brewhouse.local",
		"",
		"", "", &adminID,
	)
	if err != nil {
		return fmt.Errorf("create demo brewery: %w", err)
	}
	if _, err := s.db.Exec(`UPDATE breweries SET is_demo = 1 WHERE id = ?`, brewery.ID); err != nil {
		return fmt.Errorf("mark demo brewery: %w", err)
	}
	if err := s.breweries.SetLogo(actor, brewery.ID, "image/png", demoBreweryLogoPNG); err != nil {
		return fmt.Errorf("set demo brewery logo: %w", err)
	}

	tank1, err := s.settings.CreateTank(actor, demoTank1Name, 1000)
	if err != nil {
		return fmt.Errorf("create demo tank 1: %w", err)
	}
	tank2, err := s.settings.CreateTank(actor, demoTank2Name, 1000)
	if err != nil {
		return fmt.Errorf("create demo tank 2: %w", err)
	}
	if _, err := s.db.Exec(
		`UPDATE fermentation_tanks SET is_demo = 1 WHERE id IN (?, ?)`,
		tank1.ID, tank2.ID,
	); err != nil {
		return fmt.Errorf("mark demo tanks: %w", err)
	}

	malt, err := s.findInventoryItem(CategoryMalt, demoMaltName)
	if err != nil {
		return err
	}
	hops, err := s.findInventoryItem(CategoryHops, demoHopsName)
	if err != nil {
		return err
	}
	yeast, err := s.findInventoryItem(CategoryYeast, demoYeastName)
	if err != nil {
		return err
	}
	if err := s.topUpInventory(malt.ID, demoMaltTopUp); err != nil {
		return err
	}
	if err := s.topUpInventory(hops.ID, demoHopsTopUp); err != nil {
		return err
	}
	if err := s.topUpInventory(yeast.ID, demoYeastTopUp); err != nil {
		return err
	}

	multID, err := s.defaultMultiplierID()
	if err != nil {
		return err
	}
	beerPrice, err := s.settings.GetBeerPriceConfig()
	if err != nil {
		return err
	}
	netPerL := beerPrice.MinNetSEKPerLiter
	if netPerL <= 0 {
		netPerL = 55
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)
	type batchSpec struct {
		name     string
		target   string
		brewDay  time.Time
		tankID   int64
		tankDays int
	}
	// Brew days are unique (brewery equipment); tank ranges do not overlap per FV.
	batches := []batchSpec{
		{name: "Session Lager", target: StatusCreated},
		{name: "Wheat Beer", target: StatusScheduled, brewDay: today.AddDate(0, 0, 10), tankID: tank1.ID, tankDays: 14},
		{name: "Stout", target: StatusBrewday, brewDay: today.AddDate(0, 0, -2), tankID: tank2.ID, tankDays: 14},
		{name: "Amber Ale", target: StatusHygieneDone, brewDay: today.AddDate(0, 0, -18), tankID: tank1.ID, tankDays: 14},
		{name: "Hazy IPA", target: StatusReadyForDelivery, brewDay: today.AddDate(0, 0, -19), tankID: tank2.ID, tankDays: 14},
		{name: "Nordic Pilsner", target: StatusDelivered, brewDay: today.AddDate(0, 0, -40), tankID: tank1.ID, tankDays: 14},
	}

	ings := []IngredientInput{
		{InventoryItemID: malt.ID, Qty: 20, Unit: "kg"},
		{InventoryItemID: hops.ID, Qty: 200, Unit: "g"},
		{InventoryItemID: yeast.ID, Qty: 1, Unit: "pack"},
	}

	for _, b := range batches {
		created, err := s.recipes.Create(actor, brewery.ID, b.name, ings)
		if err != nil {
			return fmt.Errorf("create batch %q: %w", b.name, err)
		}
		id := created.Recipe.ID
		if b.target == StatusCreated {
			continue
		}
		if err := s.schedule.Book(actor, BookRequest{
			RecipeID: id,
			Date:     b.brewDay.Format("2006-01-02"),
			TankID:   b.tankID,
			TankDays: b.tankDays,
		}); err != nil {
			return fmt.Errorf("schedule %q: %w", b.name, err)
		}
		if b.target == StatusScheduled {
			continue
		}
		if _, err := s.recipes.SetBrewday(actor, id, 1.048, 500); err != nil {
			return fmt.Errorf("brewday %q: %w", b.name, err)
		}
		if b.target == StatusBrewday {
			continue
		}
		if _, err := s.recipes.CompleteAllHygiene(actor, id); err != nil {
			return fmt.Errorf("hygiene %q: %w", b.name, err)
		}
		if b.target == StatusHygieneDone {
			continue
		}
		if _, err := s.recipes.SetDelivery(actor, id, 1.010, 450, netPerL, multID); err != nil {
			return fmt.Errorf("delivery %q: %w", b.name, err)
		}
		if b.target == StatusReadyForDelivery {
			continue
		}
		if _, err := s.recipes.Deliver(actor, id); err != nil {
			return fmt.Errorf("deliver %q: %w", b.name, err)
		}
	}

	breweryID := brewery.ID
	if _, err := s.inventory.CreateOrder(actor, "Demo wishlist", "", []OrderLineInput{
		{InventoryItemID: malt.ID, Qty: 25, BreweryID: &breweryID},
		{InventoryItemID: hops.ID, Qty: 500, BreweryID: &breweryID},
		{InventoryItemID: yeast.ID, Qty: 2, BreweryID: &breweryID},
	}); err != nil {
		return fmt.Errorf("create demo order: %w", err)
	}
	return nil
}

func (s *DemoService) purgeRecipe(actor Actor, id int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	ings, err := s.recipes.loadIngredients(id)
	if err != nil {
		return err
	}
	for _, ing := range ings {
		if ing.CheckedOut <= 0 {
			continue
		}
		var qtyBefore float64
		err := tx.QueryRow(`SELECT qty FROM inventory_items WHERE id = ?`, ing.InventoryItemID).Scan(&qtyBefore)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(
			`UPDATE inventory_items SET qty = qty + ? WHERE id = ?`,
			ing.CheckedOut, ing.InventoryItemID,
		); err != nil {
			return err
		}
		itemID := ing.InventoryItemID
		qtyAfter := qtyBefore + ing.CheckedOut
		summary := fmt.Sprintf(
			"demo purge restore +%s (qty: %s → %s)",
			formatLogQty(ing.CheckedOut), formatLogQty(qtyBefore), formatLogQty(qtyAfter),
		)
		if err := s.inventory.appendItemLog(tx, &itemID, ing.ItemName, actor, summary); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`DELETE FROM brewery_bookings WHERE recipe_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM tank_bookings WHERE recipe_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM recipe_hygiene_checks WHERE recipe_id = ?`, id); err != nil {
		return err
	}
	// Clear wishlist lines pointing at this recipe before delete.
	if _, err := tx.Exec(`UPDATE inventory_order_lines SET recipe_id = NULL WHERE recipe_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM recipes WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *DemoService) findInventoryItem(category, name string) (*InventoryItem, error) {
	var id int64
	err := s.db.QueryRow(
		`SELECT id FROM inventory_items WHERE category = ? AND name = ? ORDER BY id LIMIT 1`,
		category, name,
	).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("demo inventory item %s/%q not found", category, name)
	}
	if err != nil {
		return nil, err
	}
	return s.inventory.Get(id)
}

func (s *DemoService) reverseDemoInventoryTopUps(actor Actor) error {
	type topUp struct {
		category string
		name     string
		qty      float64
	}
	items := []topUp{
		{CategoryMalt, demoMaltName, demoMaltTopUp},
		{CategoryHops, demoHopsName, demoHopsTopUp},
		{CategoryYeast, demoYeastName, demoYeastTopUp},
	}
	for _, item := range items {
		inv, err := s.findInventoryItem(item.category, item.name)
		if err != nil {
			// Seed may have failed part-way; skip missing catalog rows.
			continue
		}
		if err := s.drawDownInventory(actor, inv, item.qty); err != nil {
			return err
		}
	}
	return nil
}

func (s *DemoService) topUpInventory(id int64, qty float64) error {
	_, err := s.db.Exec(`UPDATE inventory_items SET qty = qty + ? WHERE id = ?`, qty, id)
	if err != nil {
		return fmt.Errorf("top up inventory %d: %w", id, err)
	}
	return nil
}

func (s *DemoService) drawDownInventory(actor Actor, item *InventoryItem, qty float64) error {
	if item == nil || qty <= 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var qtyBefore float64
	if err := tx.QueryRow(`SELECT qty FROM inventory_items WHERE id = ?`, item.ID).Scan(&qtyBefore); err != nil {
		return fmt.Errorf("read inventory %d: %w", item.ID, err)
	}
	draw := qty
	if draw > qtyBefore {
		draw = qtyBefore
	}
	if draw <= 0 {
		return nil
	}
	qtyAfter := qtyBefore - draw
	if _, err := tx.Exec(`UPDATE inventory_items SET qty = ? WHERE id = ?`, qtyAfter, item.ID); err != nil {
		return fmt.Errorf("draw down inventory %d: %w", item.ID, err)
	}
	itemID := item.ID
	summary := fmt.Sprintf(
		"demo purge draw down -%s (qty: %s → %s)",
		formatLogQty(draw), formatLogQty(qtyBefore), formatLogQty(qtyAfter),
	)
	if err := s.inventory.appendItemLog(tx, &itemID, item.Name, actor, summary); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *DemoService) defaultMultiplierID() (int64, error) {
	list, err := s.settings.ListMultipliers()
	if err != nil {
		return 0, err
	}
	for _, m := range list {
		if m.Name == "default" {
			return m.ID, nil
		}
	}
	if len(list) == 0 {
		return 0, fmt.Errorf("no price multipliers configured")
	}
	return list[0].ID, nil
}

func (s *DemoService) getMeta(key string) (string, error) {
	var value string
	err := s.db.QueryRow(`SELECT value FROM app_meta WHERE key = ?`, key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("get app_meta %q: %w", key, err)
	}
	return value, nil
}

func (s *DemoService) setMeta(key, value string) error {
	_, err := s.db.Exec(
		`INSERT INTO app_meta (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		key, value,
	)
	if err != nil {
		return fmt.Errorf("set app_meta %q: %w", key, err)
	}
	return nil
}
