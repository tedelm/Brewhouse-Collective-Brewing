package service_test

import (
	"math"
	"testing"
	"time"

	"brewhouse/internal/service"
)

func TestListPurchaseCostsForMonth(t *testing.T) {
	_, users, _, inventory, settings, _, _ := testDB(t)
	_, admin := ensureAdminUser(t, users)

	vat := 25.0
	item, err := inventory.Create(admin, service.InventoryItem{
		Category: service.CategoryHops, Name: "Purchase Hop", Unit: "g", Qty: 100, CostPrice: 10, VATRate: &vat,
	})
	if err != nil {
		t.Fatalf("create item: %v", err)
	}
	order, err := inventory.CreateOrder(admin, "purchase report", "", []service.OrderLineInput{
		{InventoryItemID: item.ID, Qty: 5},
	})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	if _, err := inventory.SetOrderStatus(admin, order.ID, service.OrderStatusOrdered); err != nil {
		t.Fatalf("mark ordered: %v", err)
	}

	month := time.Now().UTC().Format("2006-01")
	report, err := settings.ListPurchaseCostsForMonth(admin, month)
	if err != nil {
		t.Fatalf("list purchase costs: %v", err)
	}
	if report.Month != month {
		t.Fatalf("expected month %s, got %s", month, report.Month)
	}
	if len(report.Lines) != 1 {
		t.Fatalf("expected 1 line, got %d", len(report.Lines))
	}
	line := report.Lines[0]
	if line.OrderID != order.ID || line.ItemName != "Purchase Hop" {
		t.Fatalf("unexpected line: %+v", line)
	}
	if math.Abs(line.LineCost-50) > 1e-9 {
		t.Fatalf("expected line cost 50, got %v", line.LineCost)
	}
	if math.Abs(report.CostTotal-50) > 1e-9 {
		t.Fatalf("expected cost total 50, got %v", report.CostTotal)
	}
	if math.Abs(report.VATTotal-12.5) > 1e-9 {
		t.Fatalf("expected vat total 12.5, got %v", report.VATTotal)
	}

	sum, err := settings.SumPurchaseVATForMonth(admin, month)
	if err != nil {
		t.Fatalf("sum purchase vat: %v", err)
	}
	if math.Abs(sum.VATTotal-report.VATTotal) > 1e-9 {
		t.Fatalf("vat summary mismatch: %v vs %v", sum.VATTotal, report.VATTotal)
	}

	otherMonth := "2000-01"
	empty, err := settings.ListPurchaseCostsForMonth(admin, otherMonth)
	if err != nil {
		t.Fatalf("empty month: %v", err)
	}
	if len(empty.Lines) != 0 || empty.CostTotal != 0 || empty.VATTotal != 0 {
		t.Fatalf("expected empty report, got %+v", empty)
	}

	planning, err := inventory.CreateOrder(admin, "planning only", "", []service.OrderLineInput{
		{InventoryItemID: item.ID, Qty: 2},
	})
	if err != nil {
		t.Fatalf("create planning order: %v", err)
	}
	_ = planning
	again, err := settings.ListPurchaseCostsForMonth(admin, month)
	if err != nil {
		t.Fatalf("list after planning: %v", err)
	}
	if len(again.Lines) != 1 {
		t.Fatalf("planning order should be excluded, got %d lines", len(again.Lines))
	}
}
