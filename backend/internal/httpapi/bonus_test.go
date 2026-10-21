package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"stockflow/internal/inventory"
	"stockflow/internal/orders"
	"stockflow/internal/testutil"
)

func TestIdempotencyHTTP(t *testing.T) {
	pool := testutil.Database(t)
	router := NewRouter(inventory.New(pool), orders.New(pool))
	call := func(method, path, body string, key []string, want int) map[string]json.RawMessage {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if key != nil {
			req.Header["Idempotency-Key"] = key
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("%s %s: status%d want%d %s", method, path, res.Code, want, res.Body.String())
		}
		var data map[string]json.RawMessage
		if res.Body.Len() > 0 {
			if err := json.Unmarshal(res.Body.Bytes(), &data); err != nil {
				t.Fatal(err)
			}
		}
		return data
	}
	call("POST", "/api/products", `{"sku":"A","name":"Paper","price":10000}`, nil, 201)
	call("POST", "/api/products/1/stock", `{"type":"in","qty":5}`, nil, 200)
	body := `{"customer":"C","items":[{"sku":"A","qty":2}]}`
	first := call("POST", "/api/orders", body, []string{"checkout-http"}, 201)
	replay := call("POST", "/api/orders", body, []string{"checkout-http"}, 201)
	if string(first["id"]) != string(replay["id"]) {
		t.Fatal("HTTP retries created another order")
	}
	changed := `{"customer":"Changed","items":[{"sku":"A","qty":2}]}`
	conflict := call("POST", "/api/orders", changed, []string{"checkout-http"}, 409)
	var e struct {
		Code string `json:"code"`
	}
	json.Unmarshal(conflict["error"], &e)
	if e.Code != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("wrong conflict %s", conflict["error"])
	}
	for _, key := range [][]string{{""}, {"bad key"}, {strings.Repeat("a", 129)}, {"one", "two"}} {
		call("POST", "/api/orders", body, key, 400)
	}
}
