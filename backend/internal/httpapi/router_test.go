package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"stockflow/internal/inventory"
	"stockflow/internal/orders"
	"stockflow/internal/testutil"
)

func TestHTTPContract(t *testing.T) {
	p := testutil.Database(t)
	h := NewRouter(inventory.New(p), orders.New(p))
	call := func(method, path, body string, want int) map[string]any {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, want, w.Body.String())
		}
		result := map[string]any{}
		if w.Body.Len() > 0 {
			if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
		}
		return result
	}
	product := call("POST", "/api/products", `{"sku":"A","name":"Paper","price":10000}`, 201)
	if product["is_active"] != true {
		t.Fatal("active must default true")
	}
	id := int(product["id"].(float64))
	path := fmt.Sprintf("/api/products/%d", id)
	call("GET", "/api/products?search=paper&page=1&limit=20&filter=all", "", 200)
	call("GET", "/api/products/summary", "", 200)
	call("POST", path+"/stock", `{"type":"in","qty":5,"note":"receipt"}`, 200)
	conflict := call("POST", path+"/stock", `{"type":"out","qty":6}`, 409)["error"].(map[string]any)
	if conflict["code"] != "INSUFFICIENT_STOCK" || conflict["available"] != float64(5) {
		t.Fatal("conflict lost details")
	}
	call("GET", path+"/movements", "", 200)
	call("PUT", path, `{"sku":"A","name":"Paper updated","price":12000,"is_active":false}`, 200)
	call("DELETE", path, "", 409)
	o := call("POST", "/api/orders", `{"customer":"Customer","items":[{"sku":"A","qty":5}]}`, 201)
	if o["total"] != float64(60000) {
		t.Fatal("order total not server computed")
	}
	conflict = call("POST", "/api/orders", `{"customer":"Customer","items":[{"sku":"A","qty":1}]}`, 409)["error"].(map[string]any)
	if conflict["available"] != float64(0) || conflict["sku"] != "A" {
		t.Fatal("zero stock or sku missing")
	}
	orderPath := fmt.Sprintf("/api/orders/%d", int(o["id"].(float64)))
	call("GET", orderPath, "", 200)
	call("POST", orderPath+"/cancel", "", 200)
	call("POST", orderPath+"/cancel", "", 409)
	b := call("POST", "/api/products", `{"sku":"B","name":"Unused","price":0}`, 201)
	call("DELETE", fmt.Sprintf("/api/products/%d", int(b["id"].(float64))), "", 204)
	call("PUT", "/api/products/99999", `{"sku":"X","name":"X","price":0}`, 404)
	for _, path := range []string{"/api/products?page=0", "/api/products?limit=101", "/api/products?filter=other", "/api/products/no/stock"} {
		method := "GET"
		body := ""
		if strings.HasSuffix(path, "/stock") {
			method = "POST"
			body = `{"type":"in","qty":1}`
		}
		call(method, path, body, 400)
	}
	for _, body := range []string{`{"customer":"C","items":[{"sku":"A","qty":1.5}]}`, `{"customer":"C","items":[{"sku":"A","qty":1,"unit_price":1}]}`, `{} {}`, `{`, strings.Repeat("x", 1048577)} {
		call("POST", "/api/orders", body, 400)
	}
	call("GET", "/unknown", "", 404)
	call("PATCH", "/api/products", "", 405)
}
func TestNoBodyOnDelete(t *testing.T) {
	p := testutil.Database(t)
	h := NewRouter(inventory.New(p), orders.New(p))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/products", bytes.NewBufferString(`{"sku":"B","name":"B","price":0}`)))
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/products/1", nil))
	if w.Code != 204 || w.Body.Len() != 0 {
		t.Fatalf("delete response %d %s", w.Code, w.Body.String())
	}
}

func TestProductPriceMustBePresentAndInteger(t *testing.T) {
	p := testutil.Database(t)
	h := NewRouter(inventory.New(p), orders.New(p))
	for _, body := range []string{`{"sku":"P","name":"Paper"}`, `{"sku":"P","name":"Paper","price":null}`, `{"sku":"P","name":"Paper","price":1.5}`, `{"sku":"P","name":"Paper","price":-1}`} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("POST", "/api/products", strings.NewReader(body)))
		if w.Code != 400 {
			t.Errorf("body %s: want400 got%d", body, w.Code)
		}
	}
}
