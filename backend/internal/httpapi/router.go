package httpapi

import (
	"context"
	"net/http"
	"time"

	"stockflow/internal/apperror"
	"stockflow/internal/inventory"
	"stockflow/internal/orders"
)

type api struct {
	inventory *inventory.Service
	orders    *orders.Service
}

func NewRouter(inv *inventory.Service, ord *orders.Service) http.Handler {
	a := &api{inventory: inv, orders: ord}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := inv.Ready(ctx); err != nil {
			writeError(w, apperror.New(503, "NOT_READY", "Database belum siap."))
			return
		}
		writeJSON(w, 200, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/products", a.listProducts)
	mux.HandleFunc("POST /api/products", a.createProduct)
	mux.HandleFunc("GET /api/products/summary", a.summary)
	mux.HandleFunc("PUT /api/products/{id}", a.updateProduct)
	mux.HandleFunc("DELETE /api/products/{id}", a.deleteProduct)
	mux.HandleFunc("POST /api/products/{id}/stock", a.adjustStock)
	mux.HandleFunc("GET /api/products/{id}/movements", a.movements)
	mux.HandleFunc("POST /api/orders", a.createOrder)
	mux.HandleFunc("GET /api/orders/{id}", a.getOrder)
	mux.HandleFunc("POST /api/orders/{id}/cancel", a.cancelOrder)
	for _, path := range []string{"/api/products", "/api/products/{id}", "/api/products/{id}/stock", "/api/products/{id}/movements", "/api/orders", "/api/orders/{id}", "/api/orders/{id}/cancel"} {
		mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
			writeError(w, apperror.New(405, "METHOD_NOT_ALLOWED", "Metode HTTP tidak didukung."))
		})
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { writeError(w, apperror.Missing()) })
	return mux
}
