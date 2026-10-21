package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"

	"stockflow/internal/apperror"
)

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if status != 204 {
		json.NewEncoder(w).Encode(data)
	}
}
func writeError(w http.ResponseWriter, err error) {
	var ae *apperror.Error
	if !errors.As(err, &ae) {
		log.Printf("request failed: %v", err)
		ae = apperror.New(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Silakan coba lagi.")
	}
	writeJSON(w, ae.Status, map[string]interface{}{"error": ae})
}
func decode(w http.ResponseWriter, r *http.Request, out interface{}) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	defer r.Body.Close()
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		return apperror.Invalid("JSON tidak valid. Periksa nama field, tipe, dan batas ukuran 1 MiB.")
	}
	var extra interface{}
	if err := d.Decode(&extra); err != io.EOF {
		return apperror.Invalid("Body harus berisi tepat satu objek JSON.")
	}
	return nil
}
func pathID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil || id <= 0 {
		return 0, apperror.Invalid("ID harus berupa integer positif.")
	}
	return id, nil
}
func respond(w http.ResponseWriter, status int, data interface{}, err error) {
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, status, data)
}
