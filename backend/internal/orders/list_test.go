package orders

import (
	"context"
	"errors"
	"stockflow/internal/apperror"
	"testing"
)

func TestOrderListFilteringAndCounts(t *testing.T) {
	pool, s, _ := fixture(t)
	ctx := context.Background()
	first, err := s.Create(ctx, CreateInput{Customer: "Pelanggan Sama", Items: []ItemInput{{SKU: "A", Qty: 2}, {SKU: "B", Qty: 1}}})
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.Create(ctx, CreateInput{Customer: "Pelanggan Sama", Items: []ItemInput{{SKU: "A", Qty: 1}}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Cancel(ctx, second.ID); err != nil {
		t.Fatal(err)
	}
	before := counts(t, pool)
	page, err := s.List(ctx, ListParams{Page: 1, Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 2 || len(page.Data) != 2 || page.Data[0].ID != second.ID || page.Data[1].ID != first.ID {
		t.Fatalf("wrong list: %+v", page)
	}
	row := page.Data[1]
	if row.Customer != "Pelanggan Sama" || row.ItemCount != 2 || row.UnitCount != 3 || row.Total != 40000 {
		t.Fatalf("wrong order aggregate: %+v", row)
	}
	if page.Data[0].Status != "CANCELLED" || page.Data[0].CancelledAt == nil {
		t.Fatal("cancelled order not represented")
	}
	for _, status := range []string{"CREATED", "CANCELLED"} {
		p, e := s.List(ctx, ListParams{Page: 1, Limit: 10, Search: "pELaNGGaN", Status: status})
		if e != nil || p.Total != 1 || len(p.Data) != 1 || p.Data[0].Status != status {
			t.Fatalf("wrong filter: %+v %v", p, e)
		}
	}
	if counts(t, pool) != before {
		t.Fatal("listing mutated stock/orders/movements")
	}
}
func TestOrderListPaginationAndSearch(t *testing.T) {
	pool, s, _ := fixture(t)
	ctx := context.Background()
	for _, customer := range []string{"Toko Sinar_100%", "Toko lain"} {
		if _, err := s.Create(ctx, CreateInput{Customer: customer, Items: []ItemInput{{SKU: "A", Qty: 1}}}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := pool.Exec(ctx, "UPDATE sales_orders SET created_at='2026-10-21T00:00:00Z'"); err != nil {
		t.Fatal(err)
	}
	for page, wantID := range map[int]int64{1: 2, 2: 1} {
		p, err := s.List(ctx, ListParams{Page: page, Limit: 1})
		if err != nil || p.Total != 2 || len(p.Data) != 1 || p.Data[0].ID != wantID {
			t.Fatalf("unstable pagination: %+v %v", p, err)
		}
	}
	for search, wantID := range map[string]int64{"#0001": 1, "0002": 2, "sINAr": 1, "%": 1, "_": 1} {
		p, err := s.List(ctx, ListParams{Page: 1, Limit: 10, Search: search})
		if err != nil || p.Total != 1 || len(p.Data) != 1 || p.Data[0].ID != wantID {
			t.Fatalf("search %q: %+v %v", search, p, err)
		}
	}
	for _, search := range []string{"nobody", "#2147483648", "999999999999999999", "#99999999999999999999999999"} {
		p, err := s.List(ctx, ListParams{Page: 1, Limit: 10, Search: search})
		if err != nil || p.Total != 0 || p.Data == nil || len(p.Data) != 0 {
			t.Fatalf("empty search %q: %+v %v", search, p, err)
		}
	}
	empty, err := s.List(ctx, ListParams{Page: 3, Limit: 1})
	if err != nil || empty.Total != 2 || len(empty.Data) != 0 || empty.Data == nil {
		t.Fatalf("wrong empty page %+v %v", empty, err)
	}
	for _, params := range []ListParams{{Page: 0, Limit: 10}, {Page: 1, Limit: 0}, {Page: 1, Limit: 101}, {Page: 1, Limit: 10, Status: "ACTIVE"}} {
		_, err := s.List(ctx, params)
		var ae *apperror.Error
		if !errors.As(err, &ae) || ae.Status != 400 {
			t.Fatalf("invalid params accepted: %+v %v", params, err)
		}
	}
}
