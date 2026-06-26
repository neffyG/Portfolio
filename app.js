/* ============================================================================
   app.js - the workstation.
   All of the portfolio's logic lives here so the page can run a strict CSP
   with script-src 'self' and no inline scripts. marked + DOMPurify are loaded
   before this file (vendored, not from a CDN).
   ============================================================================ */

/* --- frame-buster -----------------------------------------------------------
   If this page ever gets loaded inside an iframe on someone else's site,
   break out of it. The CSP already sets frame-ancestors 'none', this is the
   belt to that suspenders, for older browsers that ignore the header. */
(function () {
  if (window.top !== window.self) {
    try { window.top.location = window.self.location; }
    catch (e) { document.body.innerHTML = ""; }
  }
})();

(function () {
  "use strict";

  var GH_USER = "neftaligarcialopez29";

  var screenEl = document.getElementById("screen");
  var inputEl = document.getElementById("cmd");
  var promptEl = document.getElementById("prompt");
  var clockEl = document.getElementById("clock");

  /* in-memory cache so re-running `repos` or re-opening a project doesn't hit
     the GitHub API again. resets on reload, which is fine, GitHub's unauthed
     rate limit is 60/hr and this keeps me well under it. */
  var cache = { repos: null, readmes: {} };

  var history = [];
  var histIndex = -1;

  /* projects I want featured up front, mapped to their repo names on GitHub.
     The terminal can `open` any of these and it'll pull the live README. */
  var PROJECTS = {
    vulnscan: {
      repo: "vulnscan-pro",
      title: "VulnScan Pro",
      blurb: "Automated vulnerability scanner. Wraps nmap, matches service " +
             "versions against the NVD CVE feed, generates HTML reports. Dockerized."
    },
    cybershield: {
      repo: "cybershield-firewall",
      title: "CyberShield Firewall",
      blurb: "Stateful packet filter on Linux NFQUEUE. Connection tracking, a " +
             "token-bucket rate limiter for floods, SQLite logging, Flask dashboard."
    },
    honeywatch: {
      repo: "honey-watch",
      title: "Honey Watch Intrusion Lab",
      blurb: "Cowrie + Dionaea honeypots feeding an ELK stack. Captures real " +
             "attacks, geolocates sources, summarizes payloads from the raw logs."
    },
    edccoin: {
      repo: "edc-coin",
      title: "EDC Coin",
      blurb: "My earlier project. Pulled in live via the GitHub README below."
    }
  };

  /* ---------- output helpers ---------- */
  function out(text, cls) {
    var div = document.createElement("div");
    div.className = "line" + (cls ? " " + cls : "");
    div.textContent = text;
    screenEl.appendChild(div);
    scrollDown();
  }

  function outHTML(html, cls) {
    var div = document.createElement("div");
    div.className = (cls || "");
    // everything that comes from GitHub goes through DOMPurify first. the
    // README is untrusted markdown from a public API, treat it like input.
    div.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
    screenEl.appendChild(div);
    scrollDown();
  }

  function scrollDown() { screenEl.scrollTop = screenEl.scrollHeight; }

  /* ---------- the banner ---------- */
  function banner() {
    var art = [
      "  _ _  ___ _    ",
      " | \\ |/ __| |   ",
      " | .` | (_ | |__ ",
      " |_|\\_|\\___|____|",
      ""
    ].join("\n");
    out(art, "banner");
    out("neftali garcia lopez // computer science @ arizona state", "dim");
    out("software engineering track, headed for an MS in cybersecurity", "dim");
    out("");
    out("type `help` to see what this terminal can do.");
    out("");
  }

  /* ---------- commands ---------- */
  var COMMANDS = {
    help: function () {
      out("available commands:");
      out("  about           who I am");
      out("  projects        list my projects");
      out("  open <name>     open a project (loads its live README from GitHub)");
      out("                  names: vulnscan, cybershield, honeywatch, edccoin");
      out("  repos           list my public GitHub repositories (live)");
      out("  resume          quick resume summary");
      out("  contact         how to reach me");
      out("  github          open my GitHub profile");
      out("  theme <c>       switch phosphor color: green or amber");
      out("  clear           clear the screen");
      out("  banner          reprint the banner");
    },

    about: function () {
      out("I'm Neftali Garcia Lopez, a computer science student at Arizona State");
      out("on the software engineering track, and I'm planning to do an MS in");
      out("cybersecurity after I graduate.");
      out("");
      out("I build security tools because I learn a topic best by making a small");
      out("version of it myself. A scanner, a firewall, a honeypot lab. Every");
      out("project in here is something I actually built and broke and fixed, and");
      out("the READMEs are honest about the parts that went wrong, because that's");
      out("where the learning was. Use `open <name>` to read them.");
    },

    projects: function () {
      out("projects (use `open <name>`):");
      out("");
      Object.keys(PROJECTS).forEach(function (k) {
        var p = PROJECTS[k];
        out("  " + pad(k, 13) + p.title);
        out("  " + pad("", 13) + p.blurb, "dim");
        out("");
      });
    },

    ls: function () { COMMANDS.projects(); },

    open: function (args) {
      var name = (args[0] || "").toLowerCase();
      if (!PROJECTS[name]) {
        out("open: unknown project '" + (args[0] || "") + "'", "err");
        out("try: " + Object.keys(PROJECTS).join(", "), "dim");
        return;
      }
      var p = PROJECTS[name];
      out("");
      out("=== " + p.title + " ===");
      out(p.blurb, "dim");
      out("");
      out("loading README from github.com/" + GH_USER + "/" + p.repo + " ...", "dim");
      loadReadme(p.repo);
    },

    repos: function () {
      out("fetching public repos ...", "dim");
      loadRepos();
    },

    resume: function () {
      out("Neftali Garcia Lopez");
      out("Computer Science, Arizona State University (Software Engineering)");
      out("");
      out("Focus: application + network security, detection, secure tooling.");
      out("Selected projects: VulnScan Pro, CyberShield Firewall, Honey Watch.");
      out("");
      out("For the full resume, reach out via `contact`.");
    },

    contact: function () {
      out("github   github.com/" + GH_USER);
      outHTML('<div class="line">profile  <a href="https://github.com/' +
              GH_USER + '" target="_blank" rel="noopener noreferrer">open in a new tab</a></div>');
    },

    github: function () {
      out("opening github.com/" + GH_USER + " ...", "dim");
      window.open("https://github.com/" + GH_USER, "_blank", "noopener,noreferrer");
    },

    theme: function (args) {
      var c = (args[0] || "").toLowerCase();
      if (c === "amber") {
        document.documentElement.setAttribute("data-theme", "amber");
        out("phosphor set to amber.");
      } else if (c === "green") {
        document.documentElement.removeAttribute("data-theme");
        out("phosphor set to green.");
      } else {
        out("usage: theme green | amber", "err");
      }
    },

    clear: function () { screenEl.innerHTML = ""; },

    banner: function () { banner(); },

    whoami: function () { out("visitor. but a welcome one."); },

    sudo: function () {
      out("nice try.", "dim");
    }
  };

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += " ";
    return s;
  }

  /* ---------- GitHub data loading ---------- */
  function loadRepos() {
    if (cache.repos) { renderRepos(cache.repos); return; }
    fetch("https://api.github.com/users/" + GH_USER + "/repos?sort=updated&per_page=100", {
      headers: { "Accept": "application/vnd.github+json" }
    })
      .then(function (r) {
        if (!r.ok) throw new Error("GitHub returned " + r.status);
        return r.json();
      })
      .then(function (repos) {
        cache.repos = repos;
        renderRepos(repos);
      })
      .catch(function (e) {
        // unauthed GitHub is rate limited to 60/hr. if I hit it, say so plainly
        // instead of leaving a confusing blank.
        out("could not load repos: " + e.message, "err");
        out("(GitHub limits anonymous requests; try again in a bit)", "dim");
      });
  }

  function renderRepos(repos) {
    if (!repos.length) { out("no public repos yet.", "dim"); return; }
    out("");
    repos.forEach(function (r) {
      out("  " + r.name + (r.language ? "  [" + r.language + "]" : ""));
      if (r.description) out("    " + r.description, "dim");
    });
    out("");
  }

  function loadReadme(repo) {
    if (cache.readmes[repo]) { renderReadme(cache.readmes[repo]); return; }
    // raw.githubusercontent gives me the plain markdown directly. I try main
    // then master since I'm not always consistent about default branch names.
    tryReadme(repo, "main")
      .catch(function () { return tryReadme(repo, "master"); })
      .then(function (md) {
        cache.readmes[repo] = md;
        renderReadme(md);
      })
      .catch(function () {
        out("no README found for " + repo + " yet.", "err");
        out("(once I push the repo public, it'll show up here automatically)", "dim");
      });
  }

  function tryReadme(repo, branch) {
    var url = "https://raw.githubusercontent.com/" + GH_USER + "/" + repo +
              "/" + branch + "/README.md";
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("not on " + branch);
      return r.text();
    });
  }

  function renderReadme(md) {
    // marked turns markdown to HTML, DOMPurify cleans it (done inside outHTML).
    var html = marked.parse(md);
    outHTML('<div class="readme">' + html + "</div>");
  }

  /* ---------- the prompt loop ---------- */
  function run(raw) {
    var line = raw.trim();
    echoCommand(line);
    if (!line) return;

    history.push(line);
    histIndex = history.length;

    var parts = line.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var args = parts.slice(1);

    if (COMMANDS[cmd]) {
      COMMANDS[cmd](args);
    } else {
      out(cmd + ": command not found. type `help`.", "err");
    }
    out("");
  }

  function echoCommand(line) {
    var div = document.createElement("div");
    div.className = "line";
    div.textContent = promptEl.textContent + " " + line;
    screenEl.appendChild(div);
  }

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      run(inputEl.value);
      inputEl.value = "";
    } else if (e.key === "ArrowUp") {
      if (histIndex > 0) { histIndex--; inputEl.value = history[histIndex]; }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (histIndex < history.length - 1) {
        histIndex++; inputEl.value = history[histIndex];
      } else { histIndex = history.length; inputEl.value = ""; }
      e.preventDefault();
    } else if (e.key === "l" && e.ctrlKey) {
      COMMANDS.clear(); e.preventDefault();
    }
  });

  // keep focus on the input so visitors can just start typing
  document.addEventListener("click", function () { inputEl.focus(); });

  /* ---------- clock in the top bar ---------- */
  function tickClock() {
    var d = new Date();
    clockEl.textContent = d.toTimeString().slice(0, 8);
  }
  setInterval(tickClock, 1000);
  tickClock();

  /* ---------- boot ---------- */
  function boot() {
    var lines = [
      "phosphor workstation v2.0",
      "POST ... ok",
      "loading profile: neftali garcia lopez",
      "vendored libs: marked, dompurify ... ok",
      "csp: active   frame-buster: armed",
      ""
    ];
    var reduce = window.matchMedia &&
                 window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      lines.forEach(function (l) { out(l, "dim"); });
      banner();
      inputEl.focus();
      return;
    }
    var i = 0;
    (function next() {
      if (i < lines.length) {
        out(lines[i++], "dim");
        setTimeout(next, 180);
      } else {
        banner();
        inputEl.focus();
      }
    })();
  }

  boot();
})();
