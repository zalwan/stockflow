package httpapi

import (
	"net/http"

	"stockflow/internal/orders"
)

func (a *api) createOrder(w http.ResponseWriter, r *http.Request) {
	var in orders.CreateInput
	if err := decode(w, r, &in); err != nil {
		writeError(w, err)
		return
	}
	o, err := a.orders.Create(r.Context(), in)
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
