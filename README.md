# Proof — Deployment Guide

A public document search tool: visitors ask a question on the home page,
the AI answers using only your indexed documents, and cites its sources.
You manage the document library from a password-protected /admin.html page.

## What you need before starting
- A free Vercel account (vercel.com) — sign up with GitHub, it's the easiest path
- A free GitHub account (github.com), to hold this code
- Your Anthropic API key (console.anthropic.com → API Keys)
- A password you'll use to protect the admin page (pick anything, write it down)

## 1. Get the code onto GitHub
1. Go to github.com → New repository → name it e.g. `proof-search` → Create.
2. On your computer, unzip the `proof-website` folder you downloaded.
3. Upload all the files in it to that new GitHub repo (GitHub's web UI has an
   "Add file → Upload files" button — drag the whole folder's contents in).

## 2. Import the project into Vercel
1. Go to vercel.com → Add New → Project.
2. Choose "Import Git Repository" and pick the `proof-search` repo you just made.
3. Framework Preset: leave as "Other". Click Deploy.
   (It will deploy successfully but won't fully work yet — that's expected,
   the database and API key aren't connected yet.)

## 3. Add the database (Vercel KV)
1. In your new Vercel project, go to the "Storage" tab.
2. Click Create Database → KV → give it any name → Create.
3. When asked which project to connect it to, choose this one.
   This automatically adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN`
   environment variables for you — you don't need to type those yourself.

## 4. Add your API key and admin password
1. In the project, go to Settings → Environment Variables.
2. Add:
   - `ANTHROPIC_API_KEY` → paste your key from console.anthropic.com
   - `ADMIN_PASSWORD` → the password you picked for /admin.html
3. Save, then go to the "Deployments" tab and redeploy (so the new
   variables take effect) — click the "..." menu on the latest deployment
   → Redeploy.

## 5. Add your documents
1. Visit `https://your-project-name.vercel.app/admin.html`
2. Enter your admin password.
3. Drag in your PDFs, DOCX, or TXT files. Each one is extracted and indexed
   automatically — you'll see a progress bar for batches of 100+.

## 6. Try the public search page
Visit `https://your-project-name.vercel.app/` — that's the page your
customers will use. Ask it something covered by the documents you uploaded.

## 7. Put it on your own domain (optional)
You can point a subdomain like `search.monstersink.us` at this Vercel
project without moving monstersink.us itself off GoDaddy:
1. In Vercel: Project → Settings → Domains → add `search.monstersink.us`.
2. Vercel will show you a CNAME record to add.
3. In GoDaddy: DNS settings for monstersink.us → add that CNAME record.
4. Propagation usually takes a few minutes to a few hours.

## Notes on cost and limits
- Every public question triggers one AI call. Answers are capped at 1,000
  tokens and only send the most relevant excerpts (not your whole library),
  so individual questions are cheap — but traffic adds up. Check usage at
  console.anthropic.com periodically.
- A built-in limit caps each visitor to 20 questions per hour to prevent
  abuse from running up your bill. You can change the number `20` near the
  top of `api/ask.js` if you want it looser or tighter.
- Vercel's free (Hobby) plan and the free KV tier comfortably cover
  low-to-moderate traffic. If this gets genuinely popular, you'll want to
  check Vercel's pricing for the next tier up.
- Search is keyword/stem-based, not true semantic search — it's good at
  catching word variants (price/priced/pricing) but won't always catch
  pure synonyms (e.g. "cost" finding "price") unless both words happen to
  appear near each other in a document.
