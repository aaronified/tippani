package store

import (
	"database/sql"
	"errors"
)

// GetSetting reads one value from the settings table (migration 0005);
// a missing key is "" — absent and cleared look the same to callers.
func (s *Store) GetSetting(key string) (string, error) {
	var v string
	err := s.DB.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return v, err
}

// SetSetting upserts a settings value; "" deletes the row (clears the key).
func (s *Store) SetSetting(key, value string) error {
	if value == "" {
		_, err := s.DB.Exec(`DELETE FROM settings WHERE key = ?`, key)
		return err
	}
	_, err := s.DB.Exec(
		`INSERT INTO settings (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}
