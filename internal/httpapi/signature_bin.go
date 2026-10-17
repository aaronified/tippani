package httpapi

import "encoding/json"

// ---- the bin ----------------------------------------------------------------
//
// A BINNED PERSON'S SIGNATURE IS PARKED WITH THEIR PORTRAIT, EXCEPT WHERE ANOTHER
// PERSON STILL NAMES THE FILE. Two readers with the same signature share one file,
// so parking it for one would break the other's. It is listed in the bin row's
// `files` either way: that list is what tells signatureNamed that a bin row still
// holds a claim on the name, so one reader emptying their bin cannot delete a file
// another reader's bin is waiting to restore.

// binnedSignature is the signature file a binned person's snapshot holds, "" for none.
func binnedSignature(row map[string]any) string {
	name, _ := row["signature_path"].(string)
	if !coverFile.MatchString(name) {
		return ""
	}
	return name
}

// parkSignature moves a binned person's signature into the bin's corner unless a
// person row still names it. Under the signature lock, so a reader storing the same
// file cannot be between its store and its commit while this renames it away.
func (s *Server) parkSignature(name string) {
	if name == "" {
		return
	}
	signatureFiles.Lock()
	defer signatureFiles.Unlock()
	var n int
	if err := s.Store.DB.QueryRow(`SELECT count(*) FROM people WHERE signature_path = ?`, name).Scan(&n); err != nil || n > 0 {
		return // named, or unknown: keeping it is the safe answer
	}
	s.parkFiles([]string{name})
}

// binSignatures are the signature files a bin row's payload holds, by the row's
// kind: a person's snapshot has one, an account's has one per person. Only these are
// ever released by releaseSignatures: a name in `files` in general may be a cover
// or a portrait that other rows share, and nothing here may delete one of those.
func binSignatures(kind, payload string) []string {
	var out []string
	switch kind {
	case "person-delete":
		var u struct {
			Row map[string]any `json:"row"`
		}
		if json.Unmarshal([]byte(payload), &u) == nil {
			if n := binnedSignature(u.Row); n != "" {
				out = append(out, n)
			}
		}
	case "account":
		var snap map[string][]map[string]any
		if json.Unmarshal([]byte(payload), &snap) == nil {
			for _, row := range snap["people"] {
				if n := binnedSignature(row); n != "" {
					out = append(out, n)
				}
			}
		}
	}
	return out
}

// releaseSignatures is what emptying a bin row owes a signature that stayed in the
// cover store because somebody else named it: once nothing does, it goes. Called
// after the bin row is deleted, so the row does not hold its own file.
func (s *Server) releaseSignatures(names []string) {
	for _, n := range names {
		s.removeSignatureFile(n)
	}
}

// userSignatureFiles are the signature files the account's people name, for the
// account's bin entry: collected before the rows cascade away.
func (s *Server) userSignatureFiles(uid int64) []string {
	rows, err := s.Store.DB.Query(`SELECT DISTINCT signature_path FROM people WHERE user_id = ? AND signature_path <> ''`, uid)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var n string
		if rows.Scan(&n) == nil && coverFile.MatchString(n) {
			out = append(out, n)
		}
	}
	return out
}

// listedNames is the arguments that are not "", in order.
func listedNames(names ...string) []string {
	var out []string
	for _, n := range names {
		if n != "" {
			out = append(out, n)
		}
	}
	return out
}
