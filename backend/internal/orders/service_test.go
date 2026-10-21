package orders

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"stockflow/internal/apperror"
	"stockflow/internal/inventory"
	"stockflow/internal/testutil"
)

func fixture(t *testing.T) (*pgxpool.Pool, *Service, *inventory.Service) {
	t.Helper()
	p := testutil.Database(t)
	inv := inventory.New(p)
	ctx := context.Background()
	for _, x := range []struct {
		sku        string
		price, qty int64
	}{{"A", 10000, 5}, {"B", 20000, 1}} {
		a, err := inv.Create(ctx, inventory.ProductInput{SKU: x.sku, Name: x.sku, Price: x.price, IsActive: true})
		if err != nil {
			t.Fatal(err)
		}
		if _, err = inv.Adjust(ctx, a.ID, inventory.StockInput{Type: "in", Qty: x.qty}); err != nil {
			t.Fatal(err)
		}
	}
	return p, New(p), inv
}
func counts(t *testing.T, p *pgxpool.Pool) [4]int {
	t.Helper()
	var a [4]int
	err := p.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM sales_orders),(SELECT count(*) FROM sales_order_items),(SELECT count(*) FROM stock_movements),(SELECT sum(stock) FROM products)`).Scan(&a[0], &a[1], &a[2], &a[3])
	if err != nil {
		t.Fatal(err)
	}
	return a
}
func TestCreateOrderAtomic(t *testing.T) {
	p, s, inv := fixture(t)
	ctx := context.Background()
	before := counts(t, p)
	_, err := s.Create(ctx, CreateInput{Customer: "Customer", Items: []ItemInput{{SKU: "A", Qty: 2}, {SKU: "B", Qty: 2}}})
	var ae *apperror.Error
	if !errors.As(err, &ae) || ae.Code != "INSUFFICIENT_STOCK" || ae.SKU != "B" || ae.Available == nil || *ae.Available != 1 {
		t.Fatalf("incorrect conflict %v", err)
	}
	if after := counts(t, p); before != after {
		t.Fatalf("failed order changed data: %v -> %v", before, after)
	}
	order, err := s.Create(ctx, CreateInput{Customer: "Customer", Items: []ItemInput{{SKU: "A", Qty: 2}, {SKU: "B", Qty: 1}}})
	if err != nil {
		t.Fatal(err)
	}
	if order.Total != 40000 || order.Status != "CREATED" || len(order.Items) != 2 || order.Items[0].UnitPrice != 10000 || order.Items[1].UnitPrice != 20000 {
		t.Fatalf("wrong order %+v", order)
	}
	page, _ := inv.List(ctx, inventory.ListParams{Page: 1, Limit: 20, Filter: "all"})
	if page.Data[0].Stock != 3 || page.Data[1].Stock != 0 {
		t.Fatal("wrong final stocks")
	}
	if c := counts(t, p); c != [4]int{1, 2, 4, 3} {
		t.Fatalf("wrong writes %v", c)
	}
	inv.Update(ctx, page.Data[0].ID, inventory.ProductInput{SKU: "A", Name: "A", Price: 99999, IsActive: true})
	got, err := s.Get(ctx, order.ID)
	if err != nil || got.Items[0].UnitPrice != 10000 {
		t.Fatal("historical price changed")
	}
	_, err = inv.Update(ctx, page.Data[0].ID, inventory.ProductInput{SKU: "RENAMED", Name: "A", Price: 10000})
	if err == nil {
		t.Fatal("historical sku mutated")
	}
}
func TestInvalidOrdersWriteNothing(t *testing.T) {
	p, s, inv := fixture(t)
	ctx := context.Background()
	before := counts(t, p)
	cases := []CreateInput{{Customer: " "}, {Customer: "C"}, {Customer: "C", Items: []ItemInput{{SKU: "X", Qty: 1}}}, {Customer: "C", Items: []ItemInput{{SKU: "A", Qty: 0}}}, {Customer: "C", Items: []ItemInput{{SKU: "A", Qty: -1}}}, {Customer: "C", Items: []ItemInput{{SKU: "A", Qty: 1}, {SKU: "A", Qty: 1}}}, {Customer: "C", Items: []ItemInput{{SKU: "A", Qty: 2147483648}}}}
	for _, in := range cases {
		_, err := s.Create(ctx, in)
		var ae *apperror.Error
		if !errors.As(err, &ae) || ae.Status != 400 {
			t.Fatalf("invalid order accepted or wrong error %+v: %v", in, err)
		}
		if counts(t, p) != before {
			t.Fatal("validation wrote data")
		}
	}
	c, _ := inv.Create(ctx, inventory.ProductInput{SKU: "EXPENSIVE", Name: "Expensive", Price: 2147483647})
	inv.Adjust(ctx, c.ID, inventory.StockInput{Type: "in", Qty: 2})
	before = counts(t, p)
	_, err := s.Create(ctx, CreateInput{Customer: "C", Items: []ItemInput{{SKU: "EXPENSIVE", Qty: 2}}})
	if err == nil || counts(t, p) != before {
		t.Fatal("overflow accepted or wrote data")
	}
	if _, err = s.Get(ctx, 99999); err == nil {
		t.Fatal("missing order accepted")
	}
}
func TestConcurrentOrders(t *testing.T) {
	p := testutil.Database(t)
	inv := inventory.New(p)
	s := New(p)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	a, _ := inv.Create(ctx, inventory.ProductInput{SKU: "ONE", Name: "One", Price: 10})
	inv.Adjust(ctx, a.ID, inventory.StockInput{Type: "in", Qty: 10})
	var wg sync.WaitGroup
	results := make(chan error, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.Create(ctx, CreateInput{Customer: "C", Items: []ItemInput{{SKU: "ONE", Qty: 1}}})
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		} else {
			var ae *apperror.Error
			if !errors.As(err, &ae) || ae.Status != 409 {
				t.Fatal(err)
			}
		}
	}
	if success != 10 {
		t.Fatalf("success=%d", success)
	}
	if c := counts(t, p); c != [4]int{10, 10, 11, 0} {
		t.Fatalf("concurrency damaged data %v", c)
	}
}
func TestReverseItemOrderAndConcurrentCancel(t *testing.T) {
	p, s, inv := fixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	page, _ := inv.List(ctx, inventory.ListParams{Page: 1, Limit: 20, Filter: "all"})
	inv.Adjust(ctx, page.Data[1].ID, inventory.StockInput{Type: "in", Qty: 5})
	results := make(chan Order, 2)
	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for _, items := range [][]ItemInput{{{SKU: "A", Qty: 1}, {SKU: "B", Qty: 1}}, {{SKU: "B", Qty: 1}, {SKU: "A", Qty: 1}}} {
		wg.Add(1)
		go func(items []ItemInput) {
			defer wg.Done()
			o, e := s.Create(ctx, CreateInput{Customer: "C", Items: items})
			results <- o
			errs <- e
		}(items)
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		if e != nil {
			t.Fatal(e)
		}
	}
	order := <-results
	before := counts(t, p)
	cancelErrs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, e := s.Cancel(ctx, order.ID); cancelErrs <- e }()
	}
	wg.Wait()
	close(cancelErrs)
	success, conflict := 0, 0
	for e := range cancelErrs {
		if e == nil {
			success++
		} else {
			var ae *apperror.Error
			if errors.As(e, &ae) && ae.Status == 409 {
				conflict++
			} else {
				t.Fatal(e)
			}
		}
	}
	after := counts(t, p)
	if success != 1 || conflict != 1 || after[3] != before[3]+2 || after[2] != before[2]+2 {
		t.Fatalf("cancel duplicated stock: %v -> %v", before, after)
	}
	got, err := s.Get(ctx, order.ID)
	if err != nil || got.Status != "CANCELLED" || got.CancelledAt == nil {
		t.Fatalf("wrong cancel %+v %v", got, err)
	}
	if _, err = s.Cancel(ctx, order.ID); err == nil {
		t.Fatal("repeat cancel succeeded")
	}
}
