package httpapi

import (
	"net/http"
	"strconv"

	"stockflow/internal/apperror"
	"stockflow/internal/inventory"
)

func (a *api) listProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, limit := 1, 20
	var err error
	if q.Has("page") {
		page, err = strconv.Atoi(q.Get("page"))
		if err != nil {
			writeError(w, apperror.Invalid("Page tidak valid."))
			return
		}
	}
	if q.Has("limit") {
		limit, err = strconv.Atoi(q.Get("limit"))
		if err != nil {
			writeError(w, apperror.Invalid("Limit tidak valid."))
			return
		}
	}
	filter := q.Get("filter")
	if filter == "" {
		filter = "all"
	}
	result, err := a.inventory.List(r.Context(), inventory.ListParams{Search: q.Get("search"), Filter: filter, Page: page, Limit: limit})
	respond(w, 200, result, err)
}
func (a *api) summary(w http.ResponseWriter, r *http.Request) {
	result, err := a.inventory.Summary(r.Context())
	respond(w, 200, result, err)
}
func (a *api) createProduct(w http.ResponseWriter, r *http.Request) {
	in, err := decodeProduct(w, r)
	if err != nil {
		writeError(w, err)
		return
	}
	p, err := a.inventory.Create(r.Context(), in)
	respond(w, 201, p, err)
}
func (a *api) updateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	in, err := decodeProduct(w, r)
	if err != nil {
		writeError(w, err)
		return
	}
	p, err := a.inventory.Update(r.Context(), id, in)
	respond(w, 200, p, err)
}
func (a *api) deleteProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err == nil {
		err = a.inventory.Delete(r.Context(), id)
	}
	respond(w, 204, nil, err)
}
func (a *api) adjustStock(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var in inventory.StockInput
	if err = decode(w, r, &in); err != nil {
		writeError(w, err)
		return
	}
	p, err := a.inventory.Adjust(r.Context(), id, in)
	respond(w, 200, p, err)
}
func (a *api) movements(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	data, err := a.inventory.Movements(r.Context(), id)
	respond(w, 200, map[string]interface{}{"data": data}, err)
}

func decodeProduct(w http.ResponseWriter, r *http.Request) (inventory.ProductInput, error) {
	var body struct {
		SKU      string `json:"sku"`
		Name     string `json:"name"`
		Price    *int64 `json:"price"`
		IsActive *bool  `json:"is_active"`
	}
	if err := decode(w, r, &body); err != nil {
		return inventory.ProductInput{}, err
	}
	if body.Price == nil {
		return inventory.ProductInput{}, apperror.Invalid("Harga wajib diisi sebagai integer, termasuk 0 untuk produk gratis.")
	}
	active := true
	if body.IsActive != nil {
		active = *body.IsActive
	}
	return inventory.ProductInput{SKU: body.SKU, Name: body.Name, Price: *body.Price, IsActive: active}, nil
}
