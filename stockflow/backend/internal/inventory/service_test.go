package inventory

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"

	"stockflow/internal/apperror"
	"stockflow/internal/testutil"
)

func TestStockTransactions(t *testing.T) {
	p := testutil.Database(t)
	ctx := context.Background()
	s := New(p)
	product, err := s.Create(ctx, ProductInput{SKU: "A", Name: "Paper", Price: 10000, IsActive: true})
	if err != nil {
		t.Fatal(err)
	}
	if product.Stock != 0 || product.LastMovementAt != nil {
		t.Fatal("new product has unexpected stock/history")
	}
	if _, err = s.Adjust(ctx, product.ID, StockInput{Type: "in", Qty: 5, Note: "Receipt"}); err != nil {
		t.Fatal(err)
	}
	_, err = s.Adjust(ctx, product.ID, StockInput{Type: "out", Qty: 6})
	var ae *apperror.Error
	if !errors.As(err, &ae) || ae.Code != "INSUFFICIENT_STOCK" || ae.Available == nil || *ae.Available != 5 {
		t.Fatalf("incorrect conflict: %v", err)
	}
	rows, err := s.Movements(ctx, product.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 {
		t.Fatal("failed adjustment wrote history")
	}
	page, err := s.List(ctx, ListParams{Page: 1, Limit: 20, Filter: "all"})
	if err != nil {
		t.Fatal(err)
	}
	if page.Data[0].Stock != 5 || page.Data[0].LastMovementAt == nil {
		t.Fatal("stock or last movement wrong")
	}
	updated, err := s.Adjust(ctx, product.ID, StockInput{Type: "in", Qty: 3})
	if err != nil || updated.Stock != 8 {
		t.Fatalf("receipt failed: %+v %v", updated, err)
	}
	rows, _ = s.Movements(ctx, product.ID)
	if len(rows) != 2 || rows[0].Qty != 3 {
		t.Fatal("history not newest first")
	}
	err = s.Delete(ctx, product.ID)
	if !errors.As(err, &ae) || ae.Code != "PRODUCT_HAS_HISTORY" {
		t.Fatalf("history deletion allowed: %v", err)
	}
}
func TestProductValidationAndSummary(t *testing.T) {
	p := testutil.Database(t)
	s := New(p)
	ctx := context.Background()
	for _, in := range []ProductInput{{SKU: "", Name: "A"}, {SKU: "A", Name: " "}, {SKU: "A", Name: "A", Price: -1}, {SKU: "A", Name: "A", Price: 2147483648}} {
		if _, err := s.Create(ctx, in); err == nil {
			t.Fatalf("invalid product accepted: %+v", in)
		}
	}
	a, err := s.Create(ctx, ProductInput{SKU: "PAPER", Name: "Office Paper", Price: 100, IsActive: true})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Create(ctx, ProductInput{SKU: "PAPER", Name: "Duplicate"}); err == nil {
		t.Fatal("duplicate sku accepted")
	}
	s.Adjust(ctx, a.ID, StockInput{Type: "in", Qty: 11})
	for i := 0; i < 22; i++ {
		_, err = s.Create(ctx, ProductInput{SKU: string(rune('A' + i)), Name: "Supply", Price: 200, IsActive: false})
		if err != nil {
			t.Fatal(err)
		}
	}
	page, err := s.List(ctx, ListParams{Page: 2, Limit: 20, Filter: "all"})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 23 || len(page.Data) != 3 {
		t.Fatalf("pagination wrong: %+v", page)
	}
	page, err = s.List(ctx, ListParams{Page: 1, Limit: 20, Filter: "active", Search: "office"})
	if err != nil || page.Total != 1 {
		t.Fatalf("filter wrong %+v %v", page, err)
	}
	page, err = s.List(ctx, ListParams{Page: 1, Limit: 20, Filter: "all", Search: "paper"})
	if err != nil || page.Total != 1 {
		t.Fatal("sku case-insensitive search failed")
	}
	page, _ = s.List(ctx, ListParams{Page: 1, Limit: 20, Filter: "low-stock"})
	if page.Total != 22 {
		t.Fatal("low stock filter incorrect")
	}
	summary, err := s.Summary(ctx)
	if err != nil || summary.TotalProducts != 23 || summary.ActiveProducts != 1 || summary.LowStockCount != 22 || summary.TotalStockValue != "1100" {
		t.Fatalf("summary wrong %+v %v", summary, err)
	}
	for _, qty := range []int64{0, -1, 2147483648, 2147483647} {
		if _, err = s.Adjust(ctx, a.ID, StockInput{Type: "in", Qty: qty}); err == nil {
			t.Fatalf("invalid/overflow stock accepted %d", qty)
		}
	}
	if _, err = s.Update(ctx, 99999, ProductInput{SKU: "missing", Name: "Missing"}); err == nil {
		t.Fatal("missing update succeeded")
	}
	b, _ := s.Create(ctx, ProductInput{SKU: "DELETE", Name: "Unused"})
	if err = s.Delete(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Movements(ctx, 99999); err == nil {
		t.Fatal("missing history should be 404")
	}
}
func TestDeleteAndAdjustmentRace(t *testing.T) {
	p := testutil.Database(t)
	s := New(p)
	ctx := context.Background()
	a, _ := s.Create(ctx, ProductInput{SKU: "RACE", Name: "Race"})
	var wg sync.WaitGroup
	wg.Add(2)
	var delErr, adjErr error
	go func() { defer wg.Done(); delErr = s.Delete(ctx, a.ID) }()
	go func() { defer wg.Done(); _, adjErr = s.Adjust(ctx, a.ID, StockInput{Type: "in", Qty: 1}) }()
	wg.Wait()
	if (delErr == nil) == (adjErr == nil) {
		t.Fatalf("expected one successful operation: delete=%v adjust=%v", delErr, adjErr)
	}
	var n int
	if err := p.QueryRow(ctx, "SELECT count(*) FROM stock_movements WHERE product_id=$1", a.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if adjErr == nil && n != 1 {
		t.Fatal("successful movement lost")
	}
}

func TestSummaryHandlesLargeValidInventory(t *testing.T) {
	pool := testutil.Database(t)
	s := New(pool)
	ctx := context.Background()
	for _, sku := range []string{"MAX-A", "MAX-B", "MAX-C"} {
		p, err := s.Create(ctx, ProductInput{SKU: sku, Name: sku, Price: 2147483647, IsActive: true})
		if err != nil {
			t.Fatal(err)
		}
		if _, err = s.Adjust(ctx, p.ID, StockInput{Type: "in", Qty: 2147483647}); err != nil {
			t.Fatal(err)
		}
	}
	summary, err := s.Summary(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprint(summary.TotalStockValue); got != "13835058042397261827" {
		t.Fatalf("summary value lost precision: %s", got)
	}
}
