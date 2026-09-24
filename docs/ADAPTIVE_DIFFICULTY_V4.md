# Adaptive Difficulty Engine V4

V4 replaces a single linear "make timings shorter" difficulty curve with a personalized, online-learning controller.

## Goals

The engine should make a skilled player feel that the cat is learning their habits, while preserving a readable and fair danger signal.

It does **not** optimize raw death rate. The intended outcome is:

- higher replay depth,
- more near-misses,
- fewer trivial high-score runs,
- no explosion in "unfair" feedback.

## 1. Bayesian-style player model

Each anonymous session keeps a small skill vector:

- reaction time mean and variance,
- deception resistance,
- uncertainty tolerance,
- motor-control stability,
- sustained-pressure skill.

No account or sensitive identity data is needed.

The reaction model is used as a distribution, not a single threshold. The client converts a target failure probability into a personalized warning window with an inverse-normal quantile.

## 2. Target failure curve

The failure target rises gradually with score:

- opening: low target failure,
- mid-game: materially harder,
- late-game: around the player's competence boundary,
- ceiling: capped by a fairness guardrail.

New players receive a lower ceiling until enough observations exist.

## 3. Hazard scheduler

Cue timing is no longer sampled from a simple uniform wait.

A hazard function changes the probability of a cue as a function of:

- time since the last cue,
- current score pressure,
- fish progress,
- selected adaptive strategy.

This removes learnable "safe timing" patterns without making the real danger cue ambiguous.

## 4. Contextual Thompson Sampling

Five strategy arms compete:

| Arm | Attacks |
|---|---|
| reflex | raw reaction speed |
| deception | fake-cue recognition |
| uncertainty | timing predictability |
| control | fine pointer/touch control |
| pressure | repeated high-pressure decisions |

Every arm has a Beta posterior. The server samples from the posterior and combines it with the player's current vulnerability vector.

The last-used arm is softly penalized so the game does not attack only one dimension forever.

## 5. Online update

At the end of a run, the browser sends a compact summary:

- reaction samples,
- fake cue count,
- false-stop count,
- real cue count,
- survived looks,
- drag-speed mean / coefficient of variation,
- near-miss latency,
- session duration.

The API verifies the server-issued run token before updating the model.

Each run can update the model only once.

## 6. Fairness guardrails

Hard limits remain outside the learning algorithm:

- warning window never below 150 ms,
- fake probability never above 68%,
- at most two fake-cue episodes before a forced real cue,
- pointer/touch movement thresholds have minimum floors,
- new players have a lower target-failure ceiling,
- explicit "unfair" feedback suppresses the responsible bandit arm.

This prevents the optimizer from discovering degenerate strategies such as impossible timings.

## 7. Global A/B + personal adaptation

The existing difficulty A/B test remains as the outer envelope.

Inside that envelope, V4 chooses a personalized arm and personalized timing. This gives us two levels of learning:

1. population-level A/B experiment,
2. player-level adaptive controller.

## 8. Observability

The daily growth report now includes:

- number of modeled players,
- average reaction estimate,
- average skill vector,
- arm exposures / updates,
- Thompson posterior mean,
- unfair-feedback rate by arm.

Production smoke tests validate:

- adaptive bootstrap,
- arm persistence on the run,
- token-protected adaptive update,
- duplicate-update rejection,
- cleanup without polluting global bandit counters.
