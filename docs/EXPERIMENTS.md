# Viral experiment plan

The shipped build starts a stable 50/50 experiment per browser.

## Variant A
- fake cue probability: 30%
- real anticipation: ~520 ms before difficulty adjustment

## Variant B
- fake cue probability: 43%
- real anticipation: ~445 ms before difficulty adjustment

The variant is stored locally and attached to Vercel custom events and user feedback.

## Primary funnel

1. page view
2. Game Start
3. Eyes Open
4. Look Survived
5. Fish Stolen
6. Run End
7. Retry
8. Share / Challenge Copy
9. Challenge Open
10. Challenge Beat
11. Feedback Submitted

## Decision rules

Do not choose a winner from raw page views.

### Core readability
Primary:
- Fish Stolen / Game Start

Guardrail:
- first Run End before first Fish Stolen

### Tension
Primary:
- Retry / Run End
- attempts per session

Guardrail:
- feedback marked Unfair

### Virality
Primary:
- Challenge Open per Challenge Copy
- Challenge Beat per Challenge Open

Secondary:
- Share per Run End

The useful viral coefficient is:

K = shares_or_challenges_per_player × inbound_open_rate × inbound_game_start_rate

## Feedback interpretation

“Too easy” and “Unfair” are opposite failure modes.
Do not optimize only for retry rate if Unfair feedback rises sharply.

## Things intentionally not assumed

- more death animations are not automatically better
- 3D is not automatically better
- harder is not automatically more addictive
- global leaderboards are not automatically motivating
- AI/LLM does not belong in V1 unless a measured user need appears
