# Hosting FinVora

FinVora builds into ONE file: index.html (about 1.2 MB). It needs no server, no database and no login, so any static host works. A ready-built copy is already in the site folder.

Choose one of the four options below.

## Option 1: Netlify Drop (fastest, about 1 minute, no coding)
1. Go to app.netlify.com/drop and sign in (free).
2. Drag the whole site folder onto the page.
3. You get a live link straight away, like random-name.netlify.app. Rename it in Site settings, for example finvora.netlify.app.

To update later, drag the new site folder onto the same site's Deploys page.

## Option 2: GitHub Pages (free, updates automatically)
1. Create a new repository on GitHub, for example ujwal373/finvora.
2. Upload everything in this folder (not node_modules), or push it with git:
   git init
   git add .
   git commit -m "FinVora v8"
   git branch -M main
   git remote add origin https://github.com/ujwal373/finvora.git
   git push -u origin main
3. In the repository, open Settings, then Pages, and set Source to "GitHub Actions".
4. The included workflow (.github/workflows/deploy.yml) installs, tests, builds and publishes the game. After a couple of minutes it is live at https://ujwal373.github.io/finvora/
5. Every later push to main republishes it automatically.

Quick alternative without the workflow: put site/index.html in a repository on its own, then in Settings, Pages, choose "Deploy from a branch", main, root.

## Option 3: Vercel or Cloudflare Pages
1. Import the GitHub repository from Option 2.
2. Build command: npm run build. Output folder: dist. Use Node 22 (vercel.json and netlify.toml already contain these settings).
3. Cloudflare Pages can also take the site folder by direct upload.

## Option 4: Your own domain
On any of these hosts, add a custom domain (for example finvora.in) in the domain settings and follow the DNS instructions. HTTPS is free and automatic.

## Building it yourself
Needs Node.js 22.
   npm install
   npm test
   npm run build
The game appears in dist/index.html.

## Notes
1. Saves are kept in each player's own browser (IndexedDB). Clearing browser data or switching devices starts a new game. Cloud save with Supabase login is the next planned step.
2. Never put a Supabase secret or service_role key in this project. Only the public publishable (anon) key may go in .env.local, and the code refuses secret keys anyway.
3. FinVora is an educational simulation. All money is virtual, every price is simulated, and nothing in it is financial advice.
