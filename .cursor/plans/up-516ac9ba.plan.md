<!-- 516ac9ba-5f88-4c46-b989-c98f529ebd9c 7c699440-0ed5-470a-ab4d-395bea76ac23 -->
# Upstash Transcript Cache Plan

1. Configure Upstash client

- Add `@upstash/redis` dependency if missing
- Load `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from env

2. Implement caching helpers in `youtube-transcript-generator/index.js`

- Key format `yt:transcript:<videoId>` storing JSON {duration,title,transcript}
- TTL unlimited per user choice

3. Wrap `/simple-transcript` logic with cache

- Before fetching, try `redis.get(key)` and return if present
- After successful fetch, `redis.set(key, data)` (no expiry)

4. Verify behavior locally

- Run server, hit endpoint twice; second call should log cache hit

Todos:

- setup-redis: add @upstash client setup in app
- add-cache-logic: read/write cache around transcript fetch