# Part Finder (live site search)

Photo -> Claude identifies the product -> Claude searches ONLY your two sites -> part numbers + links.

## Run locally
    npm install
    cp .env.example .env     # add your ANTHROPIC_API_KEY, check SITE_DOMAINS
    node --env-file=.env server.js
Open http://localhost:3000 (use your phone on the same network, or deploy).

## Deploy
Any Node host works (Render, Railway, Fly.io). Set the env vars from .env.example
in the host's dashboard. Camera access needs HTTPS, which these hosts provide.

## Notes
- Web search is restricted to SITE_DOMAINS via the API's allowed_domains.
- Links in results are checked against the search results and your domains.
- Web search is billed per search on top of normal token usage.
