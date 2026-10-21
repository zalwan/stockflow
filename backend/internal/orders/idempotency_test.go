package orders

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"

	"stockflow/internal/apperror"
	"stockflow/internal/inventory"
)

func TestIdempotentOrderReplayAndConflict(t *testing.T) {
	pool, s, inv := fixture(t)
	ctx := context.Background()
	input := CreateInput{Customer: "Customer", Items: []ItemInput{{SKU: "A", Qty: 2}, {SKU: "B", Qty: 1}}}
	first, err := s.CreateWithKey(ctx, input, "checkout-1")
	if err != nil {
		t.Fatal(err)
	}
	after := counts(t, pool)
	// Item order and surrounding whitespace do not change the purchase.
	replay, err := New(pool).CreateWithKey(ctx, CreateInput{Customer: " Customer ", Items: []ItemInput{{SKU: " B ", Qty: 1}, {SKU: "A", Qty: 2}}}, "checkout-1")
	if err != nil || !sameResponse(first, replay) || counts(t, pool) != after {
		t.Fatalf("replay changed purchase: %+v %v", replay, err)
	}
	changed := CreateInput{Customer: "Other", Items: []ItemInput{{SKU: "A", Qty: 2}, {SKU: "B", Qty: 1}}}
	_, err = s.CreateWithKey(ctx, changed, "checkout-1")
	var ae *apperror.Error
	if !errors.As(err, &ae) || ae.Code != "IDEMPOTENCY_KEY_REUSED" || ae.Status != 409 || counts(t, pool) != after {
		t.Fatalf("payload conflict: %v", err)
	}
	// Replay preserves the original response even after prices/status change.
	inv.Update(ctx, 1, inventory.ProductInput{SKU: "A", Name: "A", Price: 100, IsActive: true})
	if _, err = s.Cancel(ctx, first.ID); err != nil {
		t.Fatal(err)
	}
	after = counts(t, pool)
	replay, err = New(pool).CreateWithKey(ctx, input, "checkout-1")
	if err != nil || !sameResponse(first, replay) || counts(t, pool) != after {
		t.Fatalf("historical replay: %+v %v", replay, err)
	}
}

func TestIdempotentOrderFailureDoesNotReserveKey(t *testing.T) {
	pool, s, _ := fixture(t)
	ctx := context.Background()
	before := counts(t, pool)
	_, err := s.CreateWithKey(ctx, CreateInput{Customer: "C", Items: []ItemInput{{SKU: "A", Qty: 6}}}, "retry-failed")
	if err == nil || counts(t, pool) != before {
		t.Fatal("failed order wrote business data")
	}
	var n int
	if err = pool.QueryRow(ctx, "SELECT count(*) FROM order_requests").Scan(&n); err != nil || n != 0 {
		t.Fatalf("failure retained key: %d %v", n, err)
	}
	if _, err = s.CreateWithKey(ctx, CreateInput{Customer: "C", Items: []ItemInput{{SKU: "A", Qty: 1}}}, "retry-failed"); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{" ", strings.Repeat("a", 129), "bad key", "bad\tkey"} {
		_, err = s.CreateWithKey(ctx, CreateInput{Customer: "C", Items: []ItemInput{{SKU: "A", Qty: 1}}}, key)
		var ae *apperror.Error
		if !errors.As(err, &ae) || ae.Status != 400 {
			t.Fatalf("invalid key accepted %q: %v", key, err)
		}
	}
}

func TestConcurrentIdempotentOrders(t *testing.T) {
	pool, s, _ := fixture(t)
	ctx := context.Background()
	input := CreateInput{Customer: "Concurrent", Items: []ItemInput{{SKU: "A", Qty: 1}}}
	before := counts(t, pool)
	var wg sync.WaitGroup
	ids := make(chan int64, 12)
	errs := make(chan error, 12)
	for range 12 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			o, e := New(pool).CreateWithKey(ctx, input, "one-purchase")
			ids <- o.ID
			errs <- e
		}()
	}
	wg.Wait()
	close(ids)
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	var id int64
	for got := range ids {
		if id == 0 {
			id = got
		}
		if got != id {
			t.Fatalf("duplicate orders %d/%d", id, got)
		}
	}
	after := counts(t, pool)
	if after != [4]int{before[0] + 1, before[1] + 1, before[2] + 1, before[3] - 1} {
		t.Fatalf("duplicate writes: %v -> %v", before, after)
	}
	// Unkeyed requests remain separate purchases.
	a, err := s.Create(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.Create(ctx, input)
	if err != nil || a.ID == b.ID {
		t.Fatal("unkeyed requests were deduplicated")
	}
}

func sameResponse(a, b Order) bool {
	first, _ := json.Marshal(a)
	second, _ := json.Marshal(b)
	return string(first) == string(second)
}
