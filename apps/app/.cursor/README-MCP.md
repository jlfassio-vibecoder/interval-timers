# Supabase MCP setup

This project has the Supabase MCP server configured in `mcp.json` so Cursor can review your Supabase project and use DB tools (list tables, execute SQL, apply migrations).

## 1. Connect the Supabase MCP

1. **Restart Cursor** so it picks up `.cursor/mcp.json`.
2. Open **Settings → Cursor Settings → Tools & MCP** and confirm the `supabase` server appears.
3. When you first use a Supabase MCP tool, Cursor will prompt you to log in to Supabase in the browser and grant access to your org/project.
4. (Optional) To scope the MCP to a single project, edit `mcp.json` and set the URL to:
   `https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF`

## 2. Push migrations with the CLI

### Fix "Unauthorized" when linking

If you see `Unexpected error retrieving remote project status: {"message":"Unauthorized"}` or `Cannot find project ref`:

1. **If the CLI uses an env token** (run `supabase link --debug` and you see "Using access token from env var"):  
   That token is invalid or expired. Either:
   - **Unset it** so the CLI can use browser login:
     ```bash
     unset SUPABASE_ACCESS_TOKEN
     supabase login
     ```
   - Or **set a new token**: create a [Personal Access Token](https://supabase.com/dashboard/account/tokens), then:
     ```bash
     export SUPABASE_ACCESS_TOKEN=your_new_pat
     # or one-time: supabase login --token your_new_pat
     ```

2. **Clear stale stored auth** (if you're not using an env token):  
   `supabase logout --yes`

3. **Log in again** (opens browser):

   ```bash
   supabase login
   ```

   Sign in to Supabase in the browser and authorize the CLI. Then run link and push.

4. **Login without opening the browser** (use a Personal Access Token):
   - Go to [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens) and create a token (copy it right away; it’s shown only once).
   - In the terminal:
     ```bash
     supabase login --token YOUR_PAT
     ```
   - Then run `supabase link` and `supabase db push` as usual.

### Link and push

From the project root, load your env so the CLI sees `SUPABASE_ACCESS_TOKEN` (if you store it in `.env.local`):

```bash
source .env.local
```

Then:

```bash
# Link this repo to your remote Supabase project (one-time; use your project ref from dashboard)
supabase link --project-ref dgxoyhkqdxarewmanbrq

# Push pending migrations (e.g. supabase/migrations/*.sql)
supabase db push
```

If you get "Cannot find project ref" or "not initialized", run once:

```bash
supabase init
```

Then run `supabase link --project-ref dgxoyhkqdxarewmanbrq` and `supabase db push`.
