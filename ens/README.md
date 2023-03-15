# Relay Robot

Relay <> GPT for fun and profit!

# Development

In parallel run:

- `npm run dev:tsc` (starts tsc in watch mode)
- `npm run dev:express` (starts the express server)
- `npm run dev:xmtp` (starts the xmtp server)

# Project Structure

## src/

For now we have some basic structure:

- app files that are the entrypoints for the app
- app files must not export anything
- api files that completely gatekeep a single source of truth
- api files cannot import from each other.

Any time we need to share code between api files, we should move it into an app
file or a feature file. A feature file is exactly like an app file except for
that it can be imported by app files.

## deploy/

Scripts and configuration for deploying the app. Deployed to Digital Ocean
droplet instance.

- [ ] GitHub Actions to build and push Docker images.

## monitor/

Scripts and configuration for deploying the monitoring service. Deployed to
Digital Ocean droplet instance.

Canary service for:

- [ ] supabase
- [ ] open ai
- [ ] xmtp app
- [ ] express app

# Feature Roadmap

- [ ] device a QA AI assessment framework
- [ ] heavily favor escalation > hallucination
  - [ ] First pass: prompt engineering escalation
  - [ ] Second pass: pick a solution from the reliability whitepaper and implement it
- [ ] include wallet context in escalation

# Production Roadmap

- [ ] deployment playbook
- [ ] canary service
- [ ] instance monitoring
- [ ] log all api errors
- [ ] log all slow requests
- [ ] log all uncaught entrypoint errors

# Down the Road

- [ ] error monitoring service
- [ ] multiple supabase environments
