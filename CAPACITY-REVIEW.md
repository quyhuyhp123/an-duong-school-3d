# Capacity review: 500–1,000 concurrent visitors in one campus

Reviewed 16 November 2026. User requires one shared campus, not separate rooms.

## Verdict

The current application is not ready for 500–1,000 simultaneous participants.
Buying a larger server alone will not fix the current replication protocol or browser rendering cost.
Application runtime files were not changed by this audit.

## Reproducible local measurements

Run with Node from the project root:

```powershell
node scripts/audit-capacity.mjs
node scripts/audit-storage.mjs
```

Reports and isolated test data are under `.tools/capacity-audit/` (git-ignored).
No production/development server, real password, or live `data/` was used.
The WebSocket server runs in a separate Node process from the generator, both on the same PC.
Clients consume messages without parsing JSON or rendering 3D, so browser costs are excluded.
Each measured load phase lasts about five seconds and sends 24 movement updates per client.
These are short baseline measurements, not long-duration capacity certification.

| Connections | Outgoing payload MB/s (decimal) | Server event-loop p95 ms | Server peak RSS MB |
|---:|---:|---:|---:|
| 10 | 0.77 | 16.2 | 71.6 |
| 25 | 11.90 | 17.3 | 74.3 |
| 50 | 95.13 | 63.4 | 75.4 |

Every received movement triggers a complete player snapshot to every client.
For N players reporting five times per second, that is 5*N*N outgoing messages per second.
Each message contains N player records, so serialized payload work grows approximately as N cubed.
`send()` also serializes the same snapshot separately for each recipient.

Protocol extrapolation using synthetic, realistic-length JSON player records:

| Players | Snapshot bytes | Outgoing messages/sec | Offered outgoing payload GB/sec |
|---:|---:|---:|---:|
| 500 | 80,634 | 1,250,000 | 100.79 |
| 1,000 | 162,711 | 5,000,000 | 813.56 |

These last two rows are mathematical demand, NOT measured server throughput.
They assume all players report at five Hz and no messages are dropped; TCP/TLS overhead is excluded.
Actual delivery would fall behind or fail well before sustaining these numbers.
The audit deliberately does not flood the unmodified server with 1,000 moving clients.

## Follow-up ramp to locate the local latency boundary

The user subsequently requested a maximum-current-capacity experiment. Tested unchanged runtime
on an Intel Core Ultra 7 155H host with approximately 34 GB reported RAM. Separate server and
generator processes share this host. Movement reports are sent in synchronized 200-ms batches,
which can create higher bursts than independently phased browser clients.

| Connections | Load duration | Outgoing payload MB/s | Event-loop p95 ms | Server CPU, one-core equivalent |
|---:|---:|---:|---:|---:|
| 40 | 20 s | 49.30 | 34.1 | 18.7% |
| 50 | 20 s | 96.38 | 68.3 | 37.9% |
| 55 | 20 s | 128.34 | 79.6 | 39.7% |
| 60 | 20 s | 166.70 | 105.0 | 53.4% |
| 75 | 10 s offered load, ~13.1 s to metrics | 252.00 | 2,121.3 | 98.1% |

The local acceptance criteria were event-loop p95 <=100 ms, CPU <=85% of one core,
maximum observed per-socket bufferedAmount <=4 MiB, >=98% moves processed, and generator
offering >=4.5 movement reports/client/second. These are audit criteria, not a product SLA.
55 is the highest tested count meeting these criteria, NOT a proven absolute maximum.
60 slightly exceeds the p95 criterion in the longer run; 75 is clearly saturated, with maximum
event-loop delay of 5,427 ms. All moves were eventually processed, demonstrating that a connected
socket and eventual delivery alone do not prove a usable real-time experience.
An earlier eight-second 60-client run had p95 ~747 ms and CPU ~93%, so results vary with host load.

No browser rendering, browser JSON parsing, WAN capacity, initial GLB load, or concurrent chat/API
load is included. Internet capacity may be much lower: at 55 clients the aggregate payload alone
is approximately 1.03 Gbit/sec before overhead, or ~18.7 Mbit/sec per client.
No 500/1,000-user certification or long-duration soak test was performed.

Follow-up reports are `.tools/capacity-audit/ramp-short-report.json`,
`ramp-40-55-report.json`, `ramp-60-report.json`, and `ramp-report.json` (75 clients).
Reproduce an individual level, for example:

```powershell
$env:CAPACITY_COUNTS='55'
$env:CAPACITY_DURATION_MS='20000'
node scripts/audit-capacity.mjs --ramp
```

## Confirmed proxy problems (reproduction)

The audit sent requests from two simulated public clients using distinct X-Forwarded-For values,
over the same loopback TCP peer to model a reverse proxy.

- Wishes: first client received 201; second received 429 despite being a different forwarded client.
- Admin login: after five incorrect attempts from one forwarded client, another client received 429.
- Cause: `req.socket.remoteAddress` is used directly in `server/wishes.js` and `server/admin.js`.
- Fix: derive client IP only from a configured, trusted ingress; do not blindly trust arbitrary forwarded headers.
- A per-IP limit also groups legitimate people on a school/shared Wi-Fi. Combine user/session limits,
  per-IP abuse controls, bounded tracking maps, and appropriate expiry.

## Persistence

An isolated burst of 100 writes against a full 500-entry history completed in about 408 ms
(95th completion about 388 ms); all submitted records were present in the persisted history.
This demonstrates that the current single-process write queue avoids losing these concurrent writes.
It does not benchmark a cloud disk, failure recovery, or multiple Node instances.

A forced write failure was rejected, but the unpersisted update remained visible in the memory cache.
`jsonFile()` assigns/mutates cache before its write/rename succeeds. Read errors also fall back to
default data without distinguishing a missing file from permission errors or corrupt JSON.
Both need repair to avoid misleading state or accidental replacement of recoverable data.

For the target deployment, use a database with transactions and backups for wishes/chat/configuration.
Sessions, rate limits and shared presence must be externalized if multiple server processes are used.
Each process currently has separate player/session maps, caches and file queues.

## Browser and asset delivery

- All remote players are mounted as separate React avatar trees.
- One avatar has nine mesh parts, implying roughly 4,491 / 8,991 mesh draw submissions for
  499 / 999 remote avatars before culling and other scene work. This is a code-derived count,
  not an instrumented GPU measurement. Camera frustum culling can reduce actual draws.
- Every received state triggers JSON parsing and a React state update; every avatar allocates a
  Vector3 in every animation frame.
- No distance-based replication, avatar instancing, or avatar level of detail is implemented.
- GLB file: 20,450,184 bytes. 500 / 1,000 uncached model downloads alone transfer approximately
  10.23 / 20.45 GB; this excludes JavaScript, photos, protocol overhead and repeat visits.
- The whole previous build is approximately 53 MB. This is a build-folder total, not a measured
  per-visitor waterfall: not every file is necessarily downloaded by every visitor.
- Static production serving uses readFile per request, without explicit asset caching, ETag,
  range serving, compression, or streaming. Concurrent cold GLB reads can cause memory pressure.

## Required design for one shared campus

1. Keep one logical world; separate room membership is not required.
2. Replace broadcast-on-every-message with a bounded server tick, serialize once where possible,
   send deltas and quantized state, and coalesce stale updates for slow clients.
3. Replicate nearby players more frequently and distant players less frequently. All players remain
   in the same campus. If every player must be visible at once, use simplified distant avatars
   and measure that full-crowd scene explicitly.
4. Render shared avatar parts with instancing/shared geometry and distance-based detail.
   Avoid React tree updates for every position update and reuse frame temporaries.
5. Add incoming message limits, an online capacity cap, heartbeat/dead connection cleanup,
   outbound queue limits, origin checks and randomized reconnect backoff.
6. Fix trusted-proxy handling and persistence failures; move durable data to a transactional store.
7. Serve model/photos/hashed assets through a CDN with versioned caching and compression where
   effective. Keep APIs/WebSocket uncached and outside static-asset cache rules.
8. Use monitoring for event-loop delay, egress, connection count, queue sizes, memory,
   API error/latency and database writes.

## Deployment and acceptance

The earlier small Render plan was a demo starting point, not a 1,000-player recommendation.
Render services with attached persistent disks cannot scale to multiple instances:
https://render.com/docs/scaling
Using multiple instances additionally requires explicit shared-world routing/coordination;
adding Redis or extra instances alone does not solve full-world replication.

A possible INITIAL STAGING budget after optimization is 4–8 vCPU and 8–16 GB RAM for the realtime
tier, with CDN and a separate transactional database. This is an engineering starting hypothesis,
not a measured requirement, quoted hosting offer, or guarantee of 1,000-user capacity.

Before public release, test the actual deployment with a separate load-generator machine:

- Ramp 100 -> 250 -> 500 -> 1,000 simultaneous clients with real update rates and mixed chat/API load.
- Hold the target load for at least 30–60 minutes; test mass joins, reconnects and slow clients.
- Test a worst-case crowd at the shared spawn/event area, not only a distributed population.
- Measure server delivery lag/queues and client message parsing, not only successful connections.
- Measure frame rate and initial load on representative phones/laptops using the real 3D scene.
- Verify database persistence after restart, backup/restore, proxy limits and administrator access.
- Provisional acceptance goals: no unbounded queues/memory, no lost acknowledged writes,
  API p95 <500 ms, realtime update age p95 <250 ms, and >=30 FPS on agreed target devices.
  These are proposed acceptance targets, not achieved results.

Technical references:

- https://threejs.org/manual/pages/optimize-lots-of-objects.html
- https://github.com/websockets/ws/blob/master/doc/ws.md
