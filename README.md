# Portfolio

My personal site, live at **[neftaligarcialopez.live](https://neftaligarcialopez.live)**.

It is a fake terminal that runs in the browser. You type commands, it answers, and when you ask it to open a project it goes and pulls that project's README straight off GitHub, so the site can't drift out of date with the actual repo.

No framework. No build step. No CDN. Two files and a vendor folder.

```
visitor@ngl:~$ help
visitor@ngl:~$ open homelab
```

---

## Why a terminal

I almost built the normal thing. Hero image, three project cards, a contact form nobody uses.

The problem is that a portfolio for someone going into security should look like it was made by someone going into security. I spend most of my day in a shell. Someone who types `help` and starts poking around learns more about how I work in thirty seconds than a paragraph about "passion for cybersecurity" ever would. It also forced me to write a real input handler and a real command dispatcher instead of gluing components together.

If you want the boring version of my background, type `resume`.

---

## How it works

### The loop

`app.js` is the entire application, wrapped in an IIFE under `"use strict"`. It does four things:

1. Listens for keystrokes on the input at the bottom of the screen.
2. On Enter, echoes the line back and splits it into a command and its arguments.
3. Looks the command up in a `COMMANDS` object where every key is a function.
4. That function calls `out()` however many times it needs, and each call appends one line to the screen.

That's it. Adding a command is adding a key to an object:

```js
whoami: function () { out("visitor. but a welcome one."); },
```

`out(text, cls)` builds a `div`, sets `textContent`, and appends it. Pass `"dim"` for muted secondary text or `"err"` for red. Using `textContent` rather than `innerHTML` means nothing I print can ever be interpreted as markup, which matters because some of what gets printed came from a URL bar.

There is a second helper, `outHTML()`, for the two cases that need real anchor tags and for rendering READMEs. That one uses `innerHTML`, so everything passing through it goes through DOMPurify first. Keeping the two paths separate was deliberate. I wanted it obvious at a glance which function escapes and which one doesn't, because the day I mix those up is the day I put an XSS hole in my own portfolio.

There's also a command history on the arrow keys and Ctrl+L to clear, because muscle memory is muscle memory.

### Live READMEs

Projects live in a map near the top of the file:

```js
var PROJECTS = {
  homelab: {
    repo: "Home-Network-Security-Lab",
    title: "Home Network & Security Lab",
    date: "ongoing",
    blurb: "..."
  }
};
```

`open homelab` looks that up, fetches `README.md` from `raw.githubusercontent.com`, runs it through `marked` to get HTML, sanitizes it, and prints it inside a styled block. Fetches are cached in memory for the session, keyed by `owner/repo`, so opening the same project twice doesn't hit the network again.

Two details that only exist because they bit me:

**Branch fallback.** It tries `main` first, then falls back to `master`. I have not been consistent about default branch names across repos and I got tired of wondering why one project loaded and another didn't.

**Per-project `owner`.** My capstone lives under a teammate's GitHub account. That entry sets an `owner` field and everything else falls back to my username via `p.owner || GH_USER`. Without it the fetch builds a URL for a repo I don't own and quietly 404s, which looks identical to "the README doesn't exist."

The `repos` command is separate: it hits the GitHub REST API for my full public repo list. Anonymous requests are capped at 60 per hour, so when that fails the terminal says so in plain language instead of leaving a blank line and letting you guess.

The reason I built it this way: I update a README when I change a project, because that's where my notes go anyway. If the site rendered a hardcoded copy I'd forget to update it, and a stale portfolio is worse than a thin one.

### The look

Everything visual is in a `<style>` block in `index.html`. The CRT effect is three things stacked:

- A phosphor glow from layered `text-shadow`, defined once as a `--glow` variable.
- Scanlines from a `repeating-linear-gradient` on a `::before` pseudo-element with `pointer-events: none`.
- A vignette on `::after` to fake screen curvature, plus a slow opacity flicker.

Two color schemes, green and amber, driven entirely by CSS custom properties on `:root` and `html[data-theme="amber"]`. The `theme` command flips one attribute and the whole page changes. No class juggling.

The flicker animation sits behind `@media (prefers-reduced-motion: no-preference)`, and the boot sequence checks `matchMedia` and prints instantly instead of typing itself out if you've asked for reduced motion. Same for the scanlines being decorative only. The screen is a `role="log"` with `aria-live="polite"` so output actually reaches a screen reader, and there's a `<noscript>` block with the short version of who I am for anyone with JS off.

---

## Files

```
index.html      markup, styles, CSP
app.js          all logic
CNAME           custom domain for GitHub Pages
vendor/
  marked.min.js
  purify.min.js
```

No `node_modules`. No bundler config. No lockfile.

---

## The security decisions

This is a static site, so the attack surface is small. Small is not zero, and I wanted to actually apply the things I'm studying instead of just writing about them.

**Content Security Policy.** Set in a meta tag in `index.html`:

```
default-src 'self'; script-src 'self'; base-uri 'none';
form-action 'none'; frame-ancestors 'none';
connect-src 'self' https://api.github.com https://raw.githubusercontent.com;
```

`script-src 'self'` is why `app.js` is a separate file instead of a `<script>` block. Inline script is the easiest XSS payload to land, so the policy forbids it and I had to restructure the page to obey my own rule. `connect-src` is opened exactly wide enough for the two GitHub hosts the terminal needs and nothing else, so even if something did manage to run, it has nowhere to send data. `base-uri 'none'` blocks a `<base>` tag injection from rewriting every relative URL on the page, and `form-action 'none'` means no form on this page can post anywhere, which is easy to enforce since there are no forms.

**Vendored libraries.** `marked` and `DOMPurify` are pulled from npm and committed to the repo. Loading them from a CDN means a compromised CDN gets arbitrary script execution on my site and I find out when somebody tells me. Vendoring turns a live dependency into a pinned file I can read and diff. The tradeoff is updating by hand, which is fine at this scale. It's also the reason `script-src` can stay at `'self'` with no exceptions.

**Sanitizing markdown.** A README is untrusted input. Even mine, because one of the repos I load isn't mine and could change under me. `marked` will happily turn raw HTML in a markdown file into raw HTML in my DOM, so the output goes through `DOMPurify.sanitize()` before it touches `innerHTML`. `ADD_ATTR: ["target"]` is there so links in a README can still open in a new tab, since DOMPurify strips `target` by default.

**Frame busting.** The CSP already sets `frame-ancestors 'none'`, but the first thing `app.js` does is compare `window.top` to `window.self` and break out if they differ. Belt and suspenders for older browsers that ignore the directive. If the page can't navigate the parent, it blanks its own body instead, so at worst an attacker gets an empty iframe rather than a clickable decoy.

**Cloudflare in front.** Rate limiting, WAF rules, and DDoS protection are not things you can implement in static HTML. There is no server to configure. I spent a while trying before I accepted that and moved the domain behind Cloudflare, which is the layer where those controls actually live.

---

## Things that broke

**Flexible TLS gave me a redirect loop.** Cloudflare's Flexible mode talks HTTP to the origin. GitHub Pages then redirects to HTTPS, which comes back through Cloudflare, which goes back to HTTP. Round and round until the browser gives up. The fix is Full mode. Not Flexible, not Full Strict. Also: leave the DNS records in DNS-only mode until the certificate provisions, then turn the proxy on. I did it in the other order the first time and spent an evening staring at certificate errors wondering what I'd broken.

**Cloudflare served a stale `app.js` for two days.** I pushed changes, the file on GitHub was correct, and the browser kept running old code. Hard refresh did nothing, because the cache wasn't in my browser. The script tag now loads `app.js?v=4` and I bump that number on every deploy, plus a manual purge when I'm impatient. Nothing about this was hard once I figured it out. The hard part was that my mental model of "where is the file" stopped at the origin, and there was a whole layer past that I wasn't thinking about.

---

## Running it locally

```bash
git clone https://github.com/neffyG/<this-repo>.git
cd <this-repo>
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

You need the server. Opening `index.html` from the filesystem won't work: `file://` origins break both the CSP and the GitHub fetches.

---

## Contact

Neftali Garcia Lopez, Phoenix AZ
[neftaligarcialopez2914@gmail.com](mailto:neftaligarcialopez2914@gmail.com) · [LinkedIn](https://linkedin.com/in/neftalig2914)

Or type `contact` on the site for the same thing in green.
