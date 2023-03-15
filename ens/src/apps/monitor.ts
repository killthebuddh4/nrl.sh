export {};

/*

# Overview

For each canary, we ping intermittently, log the results, and create an
emergeny alert given some threshold. Each canary just decides "is this service
down?" and if it is creates an emergency alert.
 
# Robot Application

For this we deploy a monitoring app that pings each app intermittently and
publishes the results.

- [ ] app.http.ts
- [ ] app.xmtp.ts

# Integrations

For this we can use either tools that the integration provider provides or our
own monitoring app that pings each app intermittently and publishes the results.

- [ ] supabase
- [ ] xmtp
- [ ] open ai
- [ ] front

*/
