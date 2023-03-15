# Relay Robot

Relay <> GPT for fun and profit!

# Development

To run the app locally:

- `npm run dev:tsc` (starts tsc in watch mode)
- `npm run dev:express` (starts the express server)
- `npm run dev:xmtp` (starts the xmtp server)

To understand what's going on, here's a suggested reading order:

- `README.md`
- `deploy/docker-compose.yml`
- `package.json`
- `apps/*`

# App (src/)

For now we have some basic structure:

- `apps/`
  - entrypoints for the app
  - must not export anything
- `features/`
  - exactly like apps except for that they can be imported by apps
- `apis/`
  - completely gatekeep a single source of truth
  - cannot import from each other.

# Deploy (deploy/)

To run in a docker compose cluster:

- `npm run docker:up`

Scripts and configuration for deploying the app. Deployed to Digital Ocean
droplet instance.

# Monitoring (monitor/)

Scripts and configuration for deploying the monitoring service. Deployed to
Digital Ocean droplet instance.

To start, the two questions we want to answer are:

1. Is the service up?
2. Is the service struggling?

We need to answer the aforementioned questions for each of the following:

- [ ] supabase
- [ ] open ai
- [ ] xmtp
- [ ] front
- [ ] xmtp app
- [ ] express app

# Logging

- [ ] log all inbound requests
- [ ] log all open ai responses
- [ ] log all api errors
- [ ] log all slow requests
- [ ] log all uncaught entrypoint errors

# Feature Roadmap

**Coming Soon**

- [ ] device a QA AI assessment framework
- [ ] heavily favor escalation > hallucination
  - [ ] First pass: prompt engineering escalation
  - [ ] Second pass: pick a solution from the reliability whitepaper and implement it
- [ ] include wallet context in escalation

# Technical Roadmap

**Coming Soon**

- [ ] GitHub Actions to build and push Docker images.
- [ ] LetsEncrypt SSL certificate and nginx reverse proxy w/ acme companion.
- [ ] deployment playbook
- [ ] canary service
- [ ] instance monitoring

**Down the Road**

- [ ] error monitoring service
- [ ] multiple supabase environments
