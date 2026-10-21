package apperror

import (
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Error struct {
	Status    int               `json:"-"`
	Code      string            `json:"code"`
	Message   string            `json:"message"`
	SKU       string            `json:"sku,omitempty"`
	Available *int64            `json:"available,omitempty"`
	Fields    map[string]string `json:"fields,omitempty"`
}

func (e *Error) Error() string { return e.Message }
func New(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}
func Invalid(message string) *Error { return New(400, "VALIDATION_ERROR", message) }
func Missing() *Error               { return New(404, "NOT_FOUND", "Data tidak ditemukan.") }
func Insufficient(sku string, available int64) *Error {
	return &Error{Status: 409, Code: "INSUFFICIENT_STOCK", Message: "Stok tidak mencukupi.", SKU: sku, Available: &available}
}
func FromDB(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return Missing()
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		switch pg.Code {
		case "23505":
			return New(409, "SKU_EXISTS", "SKU sudah digunakan.")
		case "23503":
			return New(409, "PRODUCT_HAS_HISTORY", "Produk masih direferensikan oleh riwayat.")
		case "22003", "23514":
			return Invalid("Nilai di luar batas yang diperbolehkan.")
		}
	}
	return err
}
