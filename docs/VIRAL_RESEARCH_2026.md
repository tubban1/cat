# Viral game research — 2026-09

The goal is not to "add more features". The goal is to maximize:

1. instant comprehension,
2. immediate replay,
3. share/challenge propagation,
4. reasons to return,
5. monetization only after retention proves itself.

## External evidence

### Retention is the hard constraint
GameAnalytics 2026 benchmarks report median D1 retention around 22% in 2025 and median D30 around 0.68–0.79%, while the top 1% reaches roughly 13–15% D30. This means a viral spike without retention is not a durable business.

Source:
https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks

### Very short experiences often bounce
GameAnalytics' 2025 Roblox benchmark shows 0–3 minute experiences have very weak median D1 retention (~4.3%) and D7 (~0.4%), while stronger session-depth cohorts perform better. Our browser game should keep the instant hook but add meta systems that extend play and bring players back.

Source:
https://www.gameanalytics.com/reports/2025-roblox-report

### Leaderboards/challenges have evidence as engagement mechanics
A systematic review of gamification research found generally positive engagement effects and specifically noted preliminary evidence that leaderboards can be particularly effective because social comparison makes achievement meaningful.

Source:
https://pmc.ncbi.nlm.nih.gov/articles/PMC5376078/

### Audio should be gameplay-synchronous
A 2026 study with 90 players found that synchronizing soundtrack and player actions increased flow, positive affect, physiological arousal, and post-practice performance compared with desynchronized audio.

Source:
https://www.sciencedirect.com/science/article/abs/pii/S1875952126001333

### Short-form social discovery is powered by posting
TikTok/Newzoo research across 1,166 gamers in the US and UK reported that 69% of TikTok users who use TikTok in their gaming purchase journey post about games on TikTok. This supports building shareable moments, not just a generic Share button.

Source:
https://ads.tiktok.com/business/zh/blog/journey-of-a-launch-newzoo

### Sound itself can become a discovery vector
TikTok/Luminate's 2025 music report found 84% of tracks entering the Billboard Global 200 in 2024 had gone viral on TikTok first. This is not direct evidence about games, but it supports creating a recognizable, reusable sound signature for short-form clips.

Source:
https://newsroom.tiktok.com/tiktok-and-luminate-release-latest-music-impact-report?lang=en

## Product hypotheses for DON'T WAKE THE CAT

### P0 — Hook
**Hypothesis:** first meaningful action within 2 seconds improves game_start / page_view.

Implementation:
- fish is immediately draggable;
- one-sentence rule;
- no tutorial modal;
- visible danger state.

Metric:
- first_interaction / page_view
- first_fish / game_start
- time_to_first_interaction

### P0 — Replay
**Hypothesis:** "I nearly had it" beats generic Game Over.

Implementation:
- reaction latency after eye contact;
- score/rank movement;
- instant Retry;
- endless difficulty rather than a fixed end.

Metric:
- retry / run_end
- plays per player
- second-game rate

### P0 — Social challenge
**Hypothesis:** explicit person-to-person challenge produces more inbound starts than a generic share.

Implementation:
- beat=N links;
- challenger nickname;
- friend target shown before first move;
- challenge success state.

Metric:
- challenge_open / challenge_copy
- inbound game_start / challenge_open
- challenge_beat / challenge_open

### P0 — Shareable moment
**Hypothesis:** a surprising caught animation + recognizable audio signature increases completed shares.

Implementation candidates:
- 4–6 caught reactions;
- 9:16 result card/replay;
- cat face + score + reaction ms;
- unique audio sting.

Metric:
- share_complete / run_end
- downstream opens per completed share

### P1 — Daily common challenge
**Hypothesis:** everyone facing the same "Cat of the Day" makes scores socially comparable and creates return behavior.

Implementation:
- deterministic daily cat;
- deterministic daily difficulty seed;
- daily leaderboard resets;
- "今天全世界都在挑战这只猫".

Metric:
- D1 return
- daily challenge starts
- daily leaderboard opens

### P1 — Collection / rare cats
**Hypothesis:** collection converts a one-joke game into a meta loop.

Implementation:
- cat album;
- common/rare cats;
- no pay-to-win;
- one rare encounter can be shared.

Metric:
- sessions per player
- D1/D7 retention
- rare-cat share rate

### P1 — Near-rival leaderboard
**Hypothesis:** a local comparison ("you are #87; #86 is 1 fish ahead") is more motivating than a huge global top-100 list.

Metric:
- leaderboard -> retry conversion
- retry rate by rank gap

### P1 — Dynamic audio
**Hypothesis:** synchronized music/SFX raises session depth and replay without increasing unfairness.

Implementation:
- adaptive tempo as score rises;
- distinct fake cue;
- unmistakable real warning/freeze cue;
- success triad;
- caught impact;
- user-controlled mute saved locally.

A/B:
- audio engine ON vs control where only minimal cues play.

Guardrail:
- unfair feedback
- quit immediately after first warning

## What not to assume

- A harder game is not automatically more viral.
- More fake cues are not automatically better.
- A leaderboard is not sufficient by itself.
- More animations can hurt load time and first interaction.
- Ads should not be added before retention and replay prove themselves.
- Viral growth should be measured by downstream players generated per player, not by share-button clicks.

## North-star model

Virality:

K = challenges_or_shares_per_player
    × open_rate_per_share
    × game_start_rate_after_open

Retention:

R = returning_unique_players / eligible_unique_players

Business:

LTV = retained sessions
      × monetizable opportunities per session
      × revenue per opportunity

Optimize in this order:

1. first interaction
2. second game
3. share/challenge downstream starts
4. D1/D7 return
5. only then monetization
