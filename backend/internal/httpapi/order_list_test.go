package httpapi

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"stockflow/internal/inventory"
	"stockflow/internal/orders"
	"stockflow/internal/testutil"
	"testing"
)

func TestOrderListHTTP(t *testing.T) {
	pool := testutil.Database(t)
	inv := inventory.New(pool)
	ord := orders.New(pool)
	ctx := context.Background()
	p, err := inv.Create(ctx, inventory.ProductInput{SKU: "P", Name: "Paper", Price: 10000, IsActive: true})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = inv.Adjust(ctx, p.ID, inventory.StockInput{Type: "in", Qty: 5}); err != nil {
		t.Fatal(err)
	}
	if _, err = ord.Create(ctx, orders.CreateInput{Customer: "Zalwan", Items: []orders.ItemInput{{SKU: "P", Qty: 2}}}); err != nil {
		t.Fatal(err)
	}
	h := NewRouter(inv, ord)
	for _, path := range []string{"/api/orders", "/api/orders?search=zALwAn&status=CREATED&page=1&limit=10", "/api/orders?search=%230001"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
		}
		var got orders.OrderPage
		if err = json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if got.Page != 1 || got.Limit != 10 || got.Total != 1 || len(got.Data) != 1 || got.Data[0].Customer != "Zalwan" || got.Data[0].ItemCount != 1 || got.Data[0].UnitCount != 2 || got.Data[0].Total != 20000 {
			t.Fatalf("wrong response %+v", got)
		}
	}
	for _, path := range []string{"/api/orders?status=unknown", "/api/orders?page=0", "/api/orders?limit=101", "/api/orders?page=no", "/api/orders?limit=no"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 400 {
			t.Fatalf("%s accepted: %d", path, w.Code)
		}
	}
}
