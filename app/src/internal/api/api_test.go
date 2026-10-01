package api_test

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"brewhouse/internal/api"
	"brewhouse/internal/auth"
	"brewhouse/internal/database"
	"brewhouse/internal/router"
	"brewhouse/internal/service"
	"brewhouse/internal/web"
)

type testEnv struct {
	handler http.Handler
	users   *service.UserService
	access  *service.AccessService
	adminPW string
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	path := filepath.Join(t.TempDir(), "api-test.db")
	db, err := database.OpenHolder(path)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	access := service.NewAccessService(db)
	users := service.NewUserService(db)
	plain, created, err := users.EnsureDefaultAdmin()
	if err != nil || !created || plain == "" {
		t.Fatalf("ensure admin: created=%v err=%v", created, err)
	}
	breweries := service.NewBreweryService(db, access)
	inventory := service.NewInventoryService(db, access)
	settings := service.NewSettingsService(db, access)
	recipes := service.NewRecipeService(db, access, inventory, settings)
	schedule := service.NewScheduleService(db, access)
	backup := service.NewBackupService(db, access, filepath.Join(t.TempDir(), "backups"))
	demo := service.NewDemoService(db, breweries, inventory, settings, recipes, schedule)
	tokens := auth.NewTokenIssuer("test-secret", time.Hour)
	webHandler, err := web.New("test")
	if err != nil {
		t.Fatalf("web: %v", err)
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
		AppVersion: "test",
		Logger:     log.Default(),
	})
	return &testEnv{
		handler: router.New(webHandler, apiHandler, tokens),
		users:   users,
		access:  access,
		adminPW: plain,
	}
}

func (e *testEnv) do(method, path, token string, body any) *httptest.ResponseRecorder {
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, rdr)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.handler.ServeHTTP(rec, req)
	return rec
}

func (e *testEnv) login(t *testing.T, username, password string) (string, map[string]any) {
	t.Helper()
	rec := e.do(http.MethodPost, "/api/login", "", map[string]string{
		"username": username,
		"password": password,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("login %s: status %d body %s", username, rec.Code, rec.Body.String())
	}
	var data map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &data); err != nil {
		t.Fatalf("login decode: %v", err)
	}
	token, _ := data["token"].(string)
	if token == "" {
		t.Fatal("expected token")
	}
	return token, data
}

func TestLogin_InvalidCredentials(t *testing.T) {
	env := newTestEnv(t)
	rec := env.do(http.MethodPost, "/api/login", "", map[string]string{
		"username": "admin",
		"password": "wrong-password",
	})
	if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusBadRequest && rec.Code != http.StatusForbidden {
		t.Fatalf("expected auth failure status, got %d %s", rec.Code, rec.Body.String())
	}
}

func TestAuth_Unauthorized(t *testing.T) {
	env := newTestEnv(t)
	rec := env.do(http.MethodGet, "/api/recipes", "", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestSession_Elevate(t *testing.T) {
	env := newTestEnv(t)
	token, data := env.login(t, "admin", env.adminPW)
	if data["role"] != service.RoleSuperuser {
		t.Fatalf("admin should start as superuser, got %v", data["role"])
	}
	rec := env.do(http.MethodPost, "/api/session/elevate", token, map[string]any{"elevated": true})
	if rec.Code != http.StatusOK {
		t.Fatalf("elevate: %d %s", rec.Code, rec.Body.String())
	}
	var elevated map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &elevated)
	if elevated["role"] != service.RoleAdmin {
		t.Fatalf("expected admin role after elevate, got %v", elevated["role"])
	}
	token2, _ := elevated["token"].(string)
	rec = env.do(http.MethodGet, "/api/recipes/nav-counts", token2, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("nav-counts: %d %s", rec.Code, rec.Body.String())
	}
}

func TestRecipes_CreateAndNavCounts(t *testing.T) {
	env := newTestEnv(t)
	token, _ := env.login(t, "admin", env.adminPW)
	elev := env.do(http.MethodPost, "/api/session/elevate", token, map[string]any{"elevated": true})
	var elevData map[string]any
	_ = json.Unmarshal(elev.Body.Bytes(), &elevData)
	adminToken, _ := elevData["token"].(string)

	breweryRec := env.do(http.MethodPost, "/api/breweries", adminToken, map[string]any{
		"name": "API Brew",
	})
	if breweryRec.Code != http.StatusCreated && breweryRec.Code != http.StatusOK {
		t.Fatalf("create brewery: %d %s", breweryRec.Code, breweryRec.Body.String())
	}
	var brewery map[string]any
	_ = json.Unmarshal(breweryRec.Body.Bytes(), &brewery)
	breweryID := int64(brewery["id"].(float64))

	itemRec := env.do(http.MethodPost, "/api/inventory", adminToken, map[string]any{
		"category":   "malt",
		"name":       "API Malt",
		"unit":       "kg",
		"qty":        50,
		"cost_price": 1,
	})
	if itemRec.Code != http.StatusCreated && itemRec.Code != http.StatusOK {
		t.Fatalf("create item: %d %s", itemRec.Code, itemRec.Body.String())
	}
	var item map[string]any
	_ = json.Unmarshal(itemRec.Body.Bytes(), &item)

	recipeRec := env.do(http.MethodPost, "/api/recipes", adminToken, map[string]any{
		"brewery_id": breweryID,
		"name":       "API Batch",
		"ingredients": []map[string]any{
			{"inventory_item_id": item["id"], "qty": 1, "unit": "kg"},
		},
	})
	if recipeRec.Code != http.StatusCreated && recipeRec.Code != http.StatusOK {
		t.Fatalf("create recipe: %d %s", recipeRec.Code, recipeRec.Body.String())
	}

	nav := env.do(http.MethodGet, "/api/recipes/nav-counts", adminToken, nil)
	if nav.Code != http.StatusOK {
		t.Fatalf("nav-counts: %d %s", nav.Code, nav.Body.String())
	}
	var counts map[string]any
	_ = json.Unmarshal(nav.Body.Bytes(), &counts)
	if counts["recipes"].(float64) < 1 {
		t.Fatalf("expected recipes count >= 1, got %v", counts)
	}
	if _, ok := counts["hygiene"]; !ok {
		t.Fatalf("expected hygiene key in nav-counts: %v", counts)
	}
}

func TestOrders_OpenCount(t *testing.T) {
	env := newTestEnv(t)
	token, _ := env.login(t, "admin", env.adminPW)
	elev := env.do(http.MethodPost, "/api/session/elevate", token, map[string]any{"elevated": true})
	var elevData map[string]any
	_ = json.Unmarshal(elev.Body.Bytes(), &elevData)
	adminToken, _ := elevData["token"].(string)

	rec := env.do(http.MethodGet, "/api/inventory/orders/open-count", adminToken, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("open-count: %d %s", rec.Code, rec.Body.String())
	}
	var data map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &data)
	if _, ok := data["count"]; !ok {
		t.Fatalf("missing count: %v", data)
	}
	if _, ok := data["shortfall_lines"]; !ok {
		t.Fatalf("missing shortfall_lines: %v", data)
	}
}

func TestEconomy_DeliveriesForbiddenForUser(t *testing.T) {
	env := newTestEnv(t)
	adminToken, _ := env.login(t, "admin", env.adminPW)
	elev := env.do(http.MethodPost, "/api/session/elevate", adminToken, map[string]any{"elevated": true})
	var elevData map[string]any
	_ = json.Unmarshal(elev.Body.Bytes(), &elevData)
	elevToken, _ := elevData["token"].(string)

	uRec := env.do(http.MethodPost, "/api/users", elevToken, map[string]any{
		"username": "plainuser",
		"password": "pass12345!",
		"email":    "plain@test.local",
		"role":     service.RoleUser,
	})
	if uRec.Code != http.StatusCreated && uRec.Code != http.StatusOK {
		t.Fatalf("create user: %d %s", uRec.Code, uRec.Body.String())
	}

	userToken, _ := env.login(t, "plainuser", "pass12345!")
	rec := env.do(http.MethodGet, "/api/recipes/delivered?month=2026-10", userToken, nil)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for plain user, got %d %s", rec.Code, rec.Body.String())
	}

	me := env.do(http.MethodGet, "/api/me", elevToken, nil)
	if me.Code != http.StatusOK {
		t.Fatalf("me: %d %s", me.Code, me.Body.String())
	}
	var meData map[string]any
	_ = json.Unmarshal(me.Body.Bytes(), &meData)
	if meData["can_view_economy"] != true {
		t.Fatalf("elevated admin should can_view_economy, got %v", meData["can_view_economy"])
	}
}
