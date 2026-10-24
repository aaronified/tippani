# ADR-0510: The Occasions breakdown was added because the server already computed it, and removed

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** Reversed. `Speakers` and `Occasions` breakdowns were computed server-side from 1.5.0; the UI rendered Occasions from 1.7.2; it was removed in 1.7.4. **Why I was wrong.** It was added because the server had been computing it and nothing rendered it — which is an argument about the *gap*, not about the value. That is the whole mistake, and it is worth keeping because "the data is already there" is a persuasive-sounding reason that answers no question a reader has. An occasion is a locator, and a leaderboard of rallies answers nothing the speaker list does not answer better. The count survives where it belongs, as a speaker's works. Mine, both the addition and the removal.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
