package service_test

import (
	"errors"
	"path/filepath"
	"testing"

	"brewhouse/internal/database"
	"brewhouse/internal/service"
)

func TestSetupWizard_NeededOnFreshInstall(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wizard-fresh.db")
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
	if err := database.EnsureSetupWizardMeta(db.DB()); err != nil {
		t.Fatalf("ensure wizard meta: %v", err)
	}

	admin, err := users.Authenticate("admin", plain)
	if err != nil {
		t.Fatalf("auth: %v", err)
	}
	actor := service.Actor{UserID: admin.ID, Role: service.RoleSuperuser}

	status, err := settings.GetSetupWizardStatus(actor)
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if !status.Needed {
		t.Fatalf("expected wizard needed on fresh install, got %+v", status)
	}

	done, err := settings.CompleteSetupWizard(actor)
	if err != nil {
		t.Fatalf("complete: %v", err)
	}
	if done.Needed || done.Status != "complete" {
		t.Fatalf("expected complete, got %+v", done)
	}

	status, err = settings.GetSetupWizardStatus(actor)
	if err != nil {
		t.Fatalf("status after complete: %v", err)
	}
	if status.Needed {
		t.Fatal("expected wizard not needed after complete")
	}
}

func TestSetupWizard_CompleteForbiddenForNonAdmin(t *testing.T) {
	_, _, _, _, settings, _, _ := testDB(t)
	plainUser := service.Actor{UserID: 99, Role: service.RoleUser}
	_, err := settings.CompleteSetupWizard(plainUser)
	if !errors.Is(err, service.ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}

func TestSetupWizard_ExistingInstallMarkedComplete(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wizard-used.db")
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
	if err := users.ClearBootstrapCredentialsIfMatch("admin"); err != nil {
		t.Fatalf("clear bootstrap: %v", err)
	}
	_, _, pending, err := users.BootstrapCredentials()
	if err != nil {
		t.Fatalf("bootstrap: %v", err)
	}
	if pending {
		t.Fatal("expected bootstrap cleared")
	}

	if err := database.EnsureSetupWizardMeta(db.DB()); err != nil {
		t.Fatalf("ensure wizard meta: %v", err)
	}

	status, err := settings.GetSetupWizardStatus(service.Actor{UserID: admin.ID, Role: service.RoleAdmin})
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if status.Needed {
		t.Fatalf("expected existing install to skip wizard, got %+v", status)
	}
}
