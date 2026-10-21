package httpapi

import (
	"net/http"
	"stockflow/internal/apperror"
	"strconv"

	"stockflow/internal/orders"
)

func (a *api) createOrder(w http.ResponseWriter, r *http.Request) {
	var in orders.CreateInput
	if err := decode(w, r, &in); err != nil {
		writeError(w, err)
		return
	}
	keys := r.Header.Values("Idempotency-Key")
	key := ""
	if len(keys) > 0 {
		if len(keys) != 1 || keys[0] == "" {
			writeError(w, apperror.Invalid("Gunakan satu Idempotency-Key yang tidak kosong."))
			return
		}
		key = keys[0]
	}
	o, err := a.orders.CreateWithKey(r.Context(), in, key)
	respond(w, 201, o, err)
}
func (a *api) getOrder(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	o, err := a.orders.Get(r.Context(), id)
	respond(w, 200, o, err)
}
func (a *api) cancelOrder(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	o, err := a.orders.Cancel(r.Context(), id)
	respond(w, 200, o, err)
}

func (a *api) listOrders(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page, limit := 1, 10
	var err error
	if query.Has("page") {
		page, err = strconv.Atoi(query.Get("page"))
		if err != nil {
			writeError(w, apperror.Invalid("Page tidak valid."))
			return
		}
	}
	if query.Has("limit") {
		limit, err = strconv.Atoi(query.Get("limit"))
		if err != nil {
			writeError(w, apperror.Invalid("Limit tidak valid."))
			return
		}
	}
	result, err := a.orders.List(r.Context(), orders.ListParams{Search: query.Get("search"), Status: query.Get("status"), Page: page, Limit: limit})
	respond(w, 200, result, err)
}

func (a *api) dailySales(w http.ResponseWriter, r *http.Request) {
	report, err := a.orders.DailySales(r.Context(), r.URL.Query().Get("date"))
	respond(w, 200, report, err)
}
