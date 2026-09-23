# Hotfix: navigation + nickname persistence

- Add explicit back navigation on main game, result, leaderboard and feedback views.
- Add explicit nickname Save button.
- Persist nickname locally and server-side in Supabase.
- Sync nickname changes to existing leaderboard runs for the same anonymous session.
- Auto-save on blur / Enter / leaderboard close.
- Production smoke verifies save, reload, rename and leaderboard propagation.
