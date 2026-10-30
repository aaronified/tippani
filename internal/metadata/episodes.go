package metadata

// A show's episodes, from the supplier the show is fetched from (TMDB or TheTVDB).
//
// An Episode is keyed by its place in the TV order, which is what a quote's season and episode
// hold. DVDSeason and DVDNumber, when the supplier publishes a DVD grouping, are where the same
// episode sits there; zero means none. A supplier's episode list is a convenience: every call
// here is best-effort, and a failure leaves the show with the episodes it already has.
//
// WHAT HAS BEEN CHECKED. The calls and field names below follow the suppliers' published API
// documentation and the shapes the tests serve. They have not been exercised against the live
// services from this build environment, which cannot reach them, so a field a supplier names
// differently shows up as an empty list, never as a wrong write.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
)

// Episode is one episode of a show.
type Episode struct {
	Season, Number          int // the TV order
	Name, Overview, AirDate string
	DVDSeason, DVDNumber    int // the DVD order, 0 when the supplier has none for it
}

const (
	maxTVDBEpisodePages = 60
	tmdbDVDGroupType    = 3 // TMDB's episode group type for a DVD release
)

// Episodes lists a show's episodes in TV order, with the DVD order folded in where TMDB has an
// episode group of that type. The season list comes from the show's own details payload (raw),
// so no extra call is made for it.
func (t *TMDB) Episodes(ctx context.Context, id int64, raw []byte) ([]Episode, error) {
	var show struct {
		Seasons []struct {
			SeasonNumber int `json:"season_number"`
		} `json:"seasons"`
	}
	if err := json.Unmarshal(raw, &show); err != nil {
		return nil, fmt.Errorf("tmdb: %w", err)
	}
	tv := strconv.FormatInt(id, 10)
	var out []Episode
	index := map[[2]int]int{}
	for _, s := range show.Seasons {
		body, err := t.get(ctx, "/tv/"+tv+"/season/"+strconv.Itoa(s.SeasonNumber), url.Values{})
		if err != nil {
			return nil, err
		}
		var r struct {
			Episodes []struct {
				EpisodeNumber int    `json:"episode_number"`
				SeasonNumber  int    `json:"season_number"`
				Name          string `json:"name"`
				Overview      string `json:"overview"`
				AirDate       string `json:"air_date"`
			} `json:"episodes"`
		}
		if err := json.Unmarshal(body, &r); err != nil {
			return nil, fmt.Errorf("tmdb: %w", err)
		}
		for _, e := range r.Episodes {
			index[[2]int{e.SeasonNumber, e.EpisodeNumber}] = len(out)
			out = append(out, Episode{Season: e.SeasonNumber, Number: e.EpisodeNumber, Name: e.Name, Overview: e.Overview, AirDate: e.AirDate})
		}
	}
	// The DVD grouping is optional: a series with none published keeps no dvd order, and a failure
	// here costs only that.
	if err := t.addDVDOrder(ctx, tv, out, index); err != nil {
		return out, nil
	}
	return out, nil
}

func (t *TMDB) addDVDOrder(ctx context.Context, tv string, eps []Episode, index map[[2]int]int) error {
	body, err := t.get(ctx, "/tv/"+tv+"/episode_groups", url.Values{})
	if err != nil {
		return err
	}
	var list struct {
		Results []struct {
			ID           string `json:"id"`
			Type         int    `json:"type"`
			EpisodeCount int    `json:"episode_count"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &list); err != nil {
		return err
	}
	best := ""
	most := -1
	for _, g := range list.Results {
		if g.Type == tmdbDVDGroupType && g.EpisodeCount > most {
			best, most = g.ID, g.EpisodeCount
		}
	}
	if best == "" {
		return nil
	}
	body, err = t.get(ctx, "/tv/episode_group/"+best, url.Values{})
	if err != nil {
		return err
	}
	var g struct {
		Groups []struct {
			Order    int `json:"order"`
			Episodes []struct {
				SeasonNumber  int `json:"season_number"`
				EpisodeNumber int `json:"episode_number"`
				Order         int `json:"order"`
			} `json:"episodes"`
		} `json:"groups"`
	}
	if err := json.Unmarshal(body, &g); err != nil {
		return err
	}
	for _, grp := range g.Groups {
		for _, e := range grp.Episodes {
			if i, ok := index[[2]int{e.SeasonNumber, e.EpisodeNumber}]; ok {
				// A group is a disc and an episode's order within it starts at 0.
				eps[i].DVDSeason, eps[i].DVDNumber = grp.Order, e.Order+1
			}
		}
	}
	return nil
}

// Episodes lists a series' episodes in TheTVDB's official (TV) order and joins its DVD order to
// them by episode id where one is published. Both lists are paged.
func (t *TVDB) Episodes(ctx context.Context, id string) ([]Episode, error) {
	type row struct {
		ID           int64  `json:"id"`
		Name         string `json:"name"`
		Overview     string `json:"overview"`
		Aired        string `json:"aired"`
		SeasonNumber int    `json:"seasonNumber"`
		Number       int    `json:"number"`
	}
	fetch := func(kind string) ([]row, error) {
		var all []row
		for page := 0; page < maxTVDBEpisodePages; page++ {
			body, err := t.authGet(ctx, "/series/"+id+"/episodes/"+kind, url.Values{"page": {strconv.Itoa(page)}})
			if err != nil {
				return nil, err
			}
			var r struct {
				Data struct {
					Episodes []row `json:"episodes"`
				} `json:"data"`
				Links struct {
					Next *int `json:"next"`
				} `json:"links"`
			}
			if err := json.Unmarshal(body, &r); err != nil {
				return nil, fmt.Errorf("tvdb: %w", err)
			}
			all = append(all, r.Data.Episodes...)
			if r.Links.Next == nil {
				break
			}
		}
		return all, nil
	}
	official, err := fetch("official")
	if err != nil {
		return nil, err
	}
	byID := map[int64]int{}
	out := make([]Episode, 0, len(official))
	for _, e := range official {
		byID[e.ID] = len(out)
		out = append(out, Episode{Season: e.SeasonNumber, Number: e.Number, Name: e.Name, Overview: e.Overview, AirDate: e.Aired})
	}
	// Not every series has a DVD order; a refusal or an empty answer leaves none.
	if dvd, err := fetch("dvd"); err == nil {
		for _, e := range dvd {
			if i, ok := byID[e.ID]; ok {
				out[i].DVDSeason, out[i].DVDNumber = e.SeasonNumber, e.Number
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Season != out[j].Season {
			return out[i].Season < out[j].Season
		}
		return out[i].Number < out[j].Number
	})
	return out, nil
}
