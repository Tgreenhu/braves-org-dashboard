name: Fetch Standings (MLB + MiLB)

on:
  schedule:
    # Two triggers to stay correct through Daylight Saving without manual
    # changes: 12:00 UTC covers 8am EDT (summer), 13:00 UTC covers 8am EST
    # (winter). The script checks the real New York clock and skips
    # whichever trigger doesn't land on 8am, so this only actually updates
    # once a day.
    - cron: '0 12 * * *'
    - cron: '0 13 * * *'
  workflow_dispatch: # lets you trigger it manually from the Actions tab

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: node scripts/fetch-standings.mjs
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
