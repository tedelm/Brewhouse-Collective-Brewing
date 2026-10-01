package main

import (
	"log"
	"net/http"
	"time"

	"brewhouse/internal/api"
	"brewhouse/internal/auth"
	"brewhouse/internal/config"
	"brewhouse/internal/database"
	"brewhouse/internal/router"
	"brewhouse/internal/service"
	"brewhouse/internal/web"
)

func main() {
	logger := log.Default()

	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.OpenHolder(cfg.DatabasePath)
	if err != nil {
		logger.Println("Failed to open database:", err)
		return
	}
	defer db.Close()

	// Initialize services
	access := service.NewAccessService(db)
	users := service.NewUserService(db)
	plain, created, err := users.EnsureDefaultAdmin()
	if err != nil {
		logger.Println("Failed to ensure default admin:", err)
		return
	}
	if created {
		logger.Println("Default admin created. Username: admin. Save the generated password shown on the login page securely. (length:", len(plain), ")")
	}
	breweries := service.NewBreweryService(db, access)
	inventory := service.NewInventoryService(db, access)
	settings := service.NewSettingsService(db, access)
	recipes := service.NewRecipeService(db, access, inventory, settings)
	schedule := service.NewScheduleService(db, access)
	backup := service.NewBackupService(db, access, cfg.BackupDir)
	demo := service.NewDemoService(db, breweries, inventory, settings, recipes, schedule)

	if adminActor, ok := findAdminActor(users); ok {
		if seeded, seedErr := demo.SeedDemoIfNeeded(adminActor); seedErr != nil {
			logger.Println("Failed to seed demo data:", seedErr)
			return
		} else if seeded {
			logger.Println("Demo brewery and batches seeded")
		}
	}

	tokens := auth.NewTokenIssuer(cfg.JWTSecret, 10*time.Minute)

	// Initialize web layer
	webHandler, err := web.New(cfg.AppVersion)
	if err != nil {
		logger.Println("Failed to initialize web handler:", err)
		return
	}

	apiHandler := api.New(api.Deps{
		Users:      users,
		Breweries:  breweries,
		Inventory:  inventory,
		Recipes:    recipes,
		Schedule:   schedule,
		Settings:   settings,
		Backup:     backup,
		Demo:       demo,
		Access:     access,
		Tokens:     tokens,
		Web:        webHandler,
		AppVersion: cfg.AppVersion,
		Logger:     logger,
	})

	// Nightly SQLite backups at 01:00 local time
	scheduler := service.NewBackupScheduler(backup, logger)
	scheduler.Start()
	defer scheduler.Stop()

	// Setup routes
	handler := router.New(webHandler, apiHandler, tokens)

	addr := ":" + cfg.Port
	logger.Println("Listening on", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		logger.Println("Failed to start server:", err)
		return
	}
}

func findAdminActor(users *service.UserService) (service.Actor, bool) {
	list, err := users.List()
	if err != nil {
		return service.Actor{}, false
	}
	for _, u := range list {
		if u.Role == service.RoleAdmin && u.Active {
			return service.Actor{UserID: u.ID, Role: service.RoleAdmin}, true
		}
	}
	return service.Actor{}, false
}
