package service_test

import (
	"path/filepath"
	"testing"

	"brewhouse/internal/database"
	"brewhouse/internal/service"
)

func TestAppTour_NeededCompleteReset(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app-tour.db")
	db, err := database.OpenHolder(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	users := service.NewUserService(db)
	access := service.NewAccessService(db)
	settings := service.NewSettingsService(db, access)

	plain, created, err := users.EnsureDefaultAdmin()
	if err != nil || !created {
		t.Fatalf("ensure admin: created=%v err=%v", created, err)
	}
	admin, err := users.Authenticate("admin", plain)
	if err != nil {
		t.Fatalf("auth: %v", err)
	}
	actor := service.Actor{UserID: admin.ID, Role: service.RoleSuperuser}

	status, err := settings.GetAppTourStatus(actor)
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if !status.Needed {
		t.Fatalf("expected tour needed, got %+v", status)
	}

	done, err := settings.CompleteAppTour(actor)
	if err != nil {
		t.Fatalf("complete: %v", err)
	}
	if done.Needed || done.Status != "complete" {
		t.Fatalf("expected complete, got %+v", done)
	}

	status, err = settings.GetAppTourStatus(actor)
	if err != nil {
		t.Fatalf("status after complete: %v", err)
	}
	if status.Needed {
		t.Fatal("expected tour not needed after complete")
	}

	reset, err := settings.ResetAppTour(actor)
	if err != nil {
		t.Fatalf("reset: %v", err)
	}
	if !reset.Needed {
		t.Fatalf("expected needed after reset, got %+v", reset)
	}

	// Another user id must not share completion.
	other := service.Actor{UserID: admin.ID + 99, Role: service.RoleUser}
	otherStatus, err := settings.GetAppTourStatus(other)
	if err != nil {
		t.Fatalf("other status: %v", err)
	}
	if !otherStatus.Needed {
		t.Fatalf("expected other user still needs tour, got %+v", otherStatus)
	}
}

func TestSetupWizard_ResetMakesNeeded(t *testing.T) {
	_, users, _, _, settings, _, _ := testDB(t)
	plain, _, err := users.EnsureDefaultAdmin()
	if err != nil {
		t.Fatalf("ensure: %v", err)
	}
	admin, err := users.Authenticate("admin", plain)
	if err != nil {
		t.Fatalf("auth: %v", err)
	}
	actor := service.Actor{UserID: admin.ID, Role: service.RoleAdmin}

	if _, err := settings.CompleteSetupWizard(actor); err != nil {
		t.Fatalf("complete: %v", err)
	}
	status, err := settings.GetSetupWizardStatus(actor)
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if status.Needed {
		t.Fatal("expected not needed after complete")
	}

	reset, err := settings.ResetSetupWizard(actor)
	if err != nil {
		t.Fatalf("reset: %v", err)
	}
	if !reset.Needed || reset.Status != "pending" {
		t.Fatalf("expected pending needed, got %+v", reset)
	}

	status, err = settings.GetSetupWizardStatus(actor)
	if err != nil {
		t.Fatalf("status after reset: %v", err)
	}
	if !status.Needed {
		t.Fatal("expected needed after reset")
	}
}
