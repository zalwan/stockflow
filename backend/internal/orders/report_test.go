package orders

import (
	"context"
	"errors"
	"testing"

	"stockflow/internal/apperror"
)

func TestDailySalesWIBBoundariesAndCancellation(t *testing.T) {
	pool, s, _ := fixture(t)
	ctx := context.Background()
	times := []string{"2026-10-20T16:59:59Z", "2026-10-20T17:00:00Z", "2026-10-21T16:59:59.999999Z", "2026-10-21T17:00:00Z"}
	var included int64
	for i, at := range times {
		o, err := s.Create(ctx, CreateInput{Customer: "C", Items: []ItemInput{{SKU: "A", Qty: 1}}})
		if err != nil {
			t.Fatal(err)
		}
		if _, err = pool.Exec(ctx, "UPDATE sales_orders SET created_at=$2::timestamptz WHERE id=$1", o.ID, at); err != nil {
			t.Fatal(err)
		}
		if i == 1 {
			included = o.ID
		}
	}
	report, err := s.DailySales(ctx, "2026-10-21")
	if err != nil || report.Date != "2026-10-21" || report.TimeZone != "Asia/Jakarta" || report.OrderCount != 2 || report.UnitsSold != 2 || report.TotalSales != "20000" {
		t.Fatalf("WIB boundaries: %+v %v", report, err)
	}
	if _, err = s.Cancel(ctx, included); err != nil {
		t.Fatal(err)
	}
	report, err = s.DailySales(ctx, "2026-10-21")
	if err != nil || report.OrderCount != 1 || report.UnitsSold != 1 || report.TotalSales != "10000" {
		t.Fatalf("cancelled sale counted: %+v %v", report, err)
	}
	report, err = s.DailySales(ctx, "2026-10-23")
	if err != nil || report.OrderCount != 0 || report.UnitsSold != 0 || report.TotalSales != "0" {
		t.Fatalf("empty report: %+v %v", report, err)
	}
	for _, date := range []string{"", "2026-02-30", "21-10-2026", "2026-1-1", "2026-10-21T00:00:00Z"} {
		_, err = s.DailySales(ctx, date)
		var ae *apperror.Error
		if !errors.As(err, &ae) || ae.Status != 400 {
			t.Fatalf("date accepted %q: %v", date, err)
		}
	}
}

func TestDailySalesPreservesAggregatePrecision(t *testing.T) {
	pool, s, _ := fixture(t)
	ctx := context.Background()
	// Aggregate revenue must not be narrowed to a single order's INTEGER range.
	_, err := pool.Exec(ctx, `INSERT INTO sales_orders(customer,total,created_at) SELECT 'C',2147483647,'2026-10-21T05:00:00Z'::timestamptz FROM generate_series(1,3)`)
	if err != nil {
		t.Fatal(err)
	}
	report, err := s.DailySales(ctx, "2026-10-21")
	if err != nil || report.TotalSales != "6442450941" || report.OrderCount != 3 {
		t.Fatalf("aggregate precision: %+v %v", report, err)
	}
}
