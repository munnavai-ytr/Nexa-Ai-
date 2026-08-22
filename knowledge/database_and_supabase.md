# Database Connections, Query Optimization & Supabase Integration Guide

This manual details relational database management best practices, SQL execution optimization techniques, and Supabase security configurations, with side-by-side **Bad Code vs. Good Code** scenarios.

---

## 1. Supabase Security: Row Level Security (RLS) & Client Initialization

### The Pitfall: Initializing SDKs using Secret Admin Service Roles inside Client Components
Supabase provides two primary API keys: a client-side public `anon` key, and an administrative secret `service_role` key. The `service_role` key bypasses all Row Level Security (RLS) rules entirely. If you expose or utilize the `service_role` key on the client side, any end user can intercept it and gain full admin read/write access to your entire database.

### Bad Code (Anti-Pattern)
```typescript
// ❌ Critical Security Bug: Initializing client with secret admin service role key on browser
import { createClient } from "@supabase/supabase-js";

export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // ❌ LEAKING THE ADMIN SECRET ROLE! Anyone can read this from their browser DevTools.
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY! 
);
```

### Good Code (Best Practice)
```typescript
// ✅ Solution: Always use the standard public 'anon_key' for client components.
import { createClient } from "@supabase/supabase-js";

export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // ✅ Secure anonymous key bound to RLS policies
);

// ✅ Solution for Server-Only Administrative Operations (e.g., API Routes / Server Actions):
export function getAdminSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Keep private in server-side memory
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is private and missing on server environment");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
}
```

### Step-by-Step Logic Solution
1. **Enforce RLS policies**: In the Supabase dashboard, always toggle Row Level Security **ON** for all public tables.
2. **Expose Anon Keys Only**: Ensure keys prefixed with `NEXT_PUBLIC_` are limited to non-sensitive identifiers and standard anonymous keys.
3. **Private Admin Operations**: Confine administrative queries (using the secret service role key) strictly within secure server-side API endpoints (`app/api/*`) or server actions.

---

## 2. SQL Optimization: Selective Column Queries vs. Star Selection

### The Pitfall: Blindly executing `SELECT *` on Wide Tables
Executing `SELECT *` reads every single row attribute from the storage disk and transfers that entire volume of data over the network network. If the table holds large text columns, JSON blobs, or metadata objects, this severely impacts performance and memory.

### Bad Code (Anti-Pattern)
```sql
-- ❌ Slow Query: Reads unnecessary columns, files, and json blobs over network
SELECT * 
FROM developer_projects
ORDER BY created_at DESC
LIMIT 50;
```

### Good Code (Best Practice)
```sql
-- ✅ Fast Query: Read only the precise parameters required for rendering
SELECT id, name, category, created_at
FROM developer_projects
ORDER BY created_at DESC
LIMIT 50;
```

### Step-by-Step Logic Solution
1. **Establish Indexes**: Always create structural indexes on attributes frequently used for ordering or filtering (`created_at` in our example):
   `CREATE INDEX idx_projects_created_at ON developer_projects(created_at DESC);`
2. **Explicit selection list**: Always write explicit column names in your SELECT targets instead of using the general wildcard symbol `*`.

---

## 3. Connection Pooling & Connection Exhaustion

### The Pitfall: Creating a new connection pool instance on every server invocation
Serverless backends (such as AWS Lambda, Cloud Run, or Vercel Edge functions) spin up and spin down instantly in response to web traffic. If your server-side database driver script initializes a new client connection pool *at module load time or during every query call*, fast sequential requests will quickly exhaust PostgreSQL's max connections limits, throwing `Connection timeout` or `Too many clients` exceptions.

### Bad Code (Anti-Pattern)
```typescript
// app/api/db/query/route.ts
import { Client } from "pg";

export async function POST(req: Request) {
  // ❌ Connection Exhaustion Bug: Creates a raw network client on every single request
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });
  await dbClient.connect();
  
  const results = await dbClient.query("SELECT id, name FROM categories;");
  
  // ❌ If processing errors out before close, connection hangs open!
  await dbClient.end(); 
  
  return Response.json(results.rows);
}
```

### Good Code (Best Practice)
```typescript
// app/api/db/query/route.ts
import { Pool } from "pg";

// ✅ Solution: Initialize a global reusable singleton Connection Pool outside the handler
let cachedPool: Pool | null = null;

function getDbPool(): Pool {
  if (!cachedPool) {
    cachedPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10, // Restrict connection limit per container instance
      idleTimeoutMillis: 30000, // Terminate idle clients automatically
    });
  }
  return cachedPool;
}

export async function POST(req: Request) {
  const pool = getDbPool();
  
  // ✅ Acquire client safely from connection pool
  const client = await pool.connect();
  try {
    const results = await client.query("SELECT id, name FROM categories;");
    return Response.json(results.rows);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  } finally {
    // ✅ Release connection back to the pool immediately under any execution scenario
    client.release();
  }
}
```
