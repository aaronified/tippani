import { describe, expect, it } from 'vitest'
import { episodeLabel } from '../../src/text.js'

// What a line's episode is called on a card. The function is the observable unit: every card prints it.
describe('the episode label of a line', () => {
  it('is the stored season and episode, and nothing for a film', () => {
    expect(episodeLabel({ season: 1, episode: 4 })).toBe('S1E4')
    expect(episodeLabel({ season: 0, episode: 2 })).toBe('S0E2')
    expect(episodeLabel({ season: 2 })).toBe('S2')
    expect(episodeLabel({ season: null, episode: null })).toBe('')
  })
  it('is the place in the shown order when the series shows another', () => {
    expect(episodeLabel({ season: 1, episode: 4, shown_season: 2, shown_episode: 1 })).toBe('S2E1')
    // season 0 is a real season in the shown order too
    expect(episodeLabel({ season: 1, episode: 4, shown_season: 0, shown_episode: 3 })).toBe('S0E3')
  })
})
