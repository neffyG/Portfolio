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

  var GH_USER = "neffyG";

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
    homelab: {
      repo: "Home-Network-Security-Lab",
      title: "Home Network & Security Lab",
      date: "ongoing",
      blurb: "pfSense CE firewall on VMware Workstation Pro. WAN bridged to the " +
             "physical network, LAN isolated on 10.10.10.0/24 with its own DHCP " +
             "scope. Hand-written firewall and NAT rules between segments. Remote " +
             "admin over a Tailscale mesh with key-based SSH, nothing exposed to " +
             "the internet."
    },
    endlessmoments: {
      owner: "jaimani11",
      repo: "Endless-Moments-LLC---An-AI-Powered-Universal-Loyalty-Rewards-Altcoin",
      title: "Endless Moments // Loyalty & Rewards Platform",
      date: "Aug 2025 - present",
      blurb: "My ASU senior capstone. Full-stack rewards platform on FastAPI, " +
             "React, and PostgreSQL, built in Agile sprints with Git code review. " +
             "I wrote the anomaly detection that flags irregular redemption " +
             "patterns using scikit-learn IsolationForest. Team repo."
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
    out("software engineering grad, now starting an MS in cybersecurity", "dim");
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
      out("                  names: homelab, endlessmoments");
      out("  experience      my work history");
      out("  education       degrees, coursework, certifications");
      out("  skills          networking, cloud, systems, languages");
      out("  repos           list my public GitHub repositories (live)");
      out("  resume          one-screen resume summary");
      out("  contact         how to reach me");
      out("  github          open my GitHub profile");
      out("  linkedin        open my LinkedIn");
      out("  theme <c>       switch phosphor color: green or amber");
      out("  clear           clear the screen");
      out("  banner          reprint the banner");
    },

    about: function () {
      out("I'm Neftali Garcia Lopez. Computer science out of Arizona State,");
      out("software engineering track, now starting an MS in cybersecurity there.");
      out("");
      out("Day to day I do IT and Microsoft cloud administration in healthcare:");
      out("Azure and M365 for 150+ users, PowerShell automation, endpoint policy.");
      out("At home I'm building a virtualized network and security lab on pfSense");
      out("so I stop learning firewalls from diagrams and start learning them from");
      out("rules I got wrong. Studying for Network+ and Security+.");
      out("");
      out("Every project in here is something I actually built and broke and fixed,");
      out("and the READMEs are honest about the parts that went wrong, because");
      out("that's where the learning was. Use `open <name>` to read them.");
    },

    projects: function () {
      out("projects (use `open <name>`):");
      out("");
      Object.keys(PROJECTS).forEach(function (k) {
        var p = PROJECTS[k];
        out("  " + pad(k, 13) + p.title + (p.date ? "   (" + p.date + ")" : ""));
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
      var owner = p.owner || GH_USER;   // EDC lives under a teammate's account
      out("");
      out("=== " + p.title + " ===" + (p.date ? "   " + p.date : ""));
      out(p.blurb, "dim");
      out("");
      out("loading README from github.com/" + owner + "/" + p.repo + " ...", "dim");
      loadReadme(owner, p.repo);
    },

    repos: function () {
      out("fetching public repos ...", "dim");
      loadRepos();
    },

    resume: function () {
      out("Neftali Garcia Lopez  //  Phoenix, AZ");
      out("");
      out("B.S. Computer Science (Software Engineering), Arizona State, May 2026");
      out("  then M.S. Cybersecurity, Arizona State, starting Aug 2026.");
      out("");
      out("Computer science graduate with hands-on IT support and Microsoft cloud");
      out("administration experience in healthcare. Building a self-hosted network");
      out("and security lab on pfSense, VMware, and Linux while preparing for");
      out("CompTIA Network+ and Security+.");
      out("");
      out("Dig deeper with: `experience`, `education`, `skills`, `projects`.");
      out("Reach me with `contact`.");
    },

    experience: function () {
      out("work experience:");
      out("");
      out("  IT Intern, Mission Healthcare                     Mar 2025 - present");
      out("    Phoenix, AZ");
      out("    - Administer Azure and M365 for 150+ users: account provisioning,");
      out("      license assignment, group-based access control.");
      out("    - Write PowerShell that automates routine diagnostics and patch");
      out("      deployment, cutting manual ticket handling time.");
      out("    - Configure endpoint security and device compliance policies across");
      out("      Windows and macOS, and troubleshoot connectivity and application");
      out("      issues escalated by clinical staff.");
      out("");
      out("  Technical Assistant, Hospice of the Valley        Jul 2024 - Jan 2025");
      out("    Phoenix, AZ");
      out("    - Resolved software, hardware, and peripheral issues for clinical");
      out("      staff, triaging tickets to limit disruption to patient care.");
      out("    - Deployed endpoint updates and security patches under HIPAA-aligned");
      out("      handling requirements, and documented fixes for repeat issues.");
      out("");
      out("  Instructional Aide, Arizona State University      Aug 2023 - May 2024");
      out("    Tempe, AZ");
      out("    - Supported 80+ students across C++ and Python lab sections,");
      out("      coaching debugging and algorithm design.");
      out("    - Assisted faculty with course delivery and built scripts to");
      out("      streamline grading workflows.");
    },

    work: function () { COMMANDS.experience(); },

    education: function () {
      out("education:");
      out("");
      out("  M.S. Cybersecurity, Arizona State University   Aug 2026 - exp. 2028");
      out("  B.S. Computer Science (Software Engineering)   May 2026   GPA 3.72");
      out("");
      out("  coursework: Computer Network Security, Operating Systems, Data");
      out("    Structures & Algorithms, Software QA & Testing, OO Analysis & Design.");
      out("");
      out("  certifications:");
      out("    Microsoft Azure Fundamentals (AZ-900)");
      out("    Cisco Networking Academy: Introduction to Cybersecurity");
      out("    CompTIA Network+   in progress, 2026", "dim");
      out("    CompTIA Security+  planned", "dim");
      out("");
      out("  awards: Dean's List (multiple semesters), SHPE National Convention");
      out("    Delegate.");
      out("");
      out("  activities: Society of Hispanic Professional Engineers (E-Board),");
      out("    Cybersecurity Club, capstone with Endless Moments LLC.");
    },

    edu: function () { COMMANDS.education(); },

    skills: function () {
      out("skills:");
      out("");
      out("  networking  TCP/IP, subnetting, DHCP, DNS, NAT, firewall rule");
      out("              configuration, pfSense, VLAN segmentation, Wireshark");
      out("  cloud/id    Azure, Microsoft Entra ID (Azure AD), Microsoft 365");
      out("              administration, conditional access, endpoint policy");
      out("  systems     Windows 10/11, Windows Server, Ubuntu Server, VMware");
      out("              Workstation Pro, OpenSSH, Tailscale");
      out("  languages   Python, PowerShell, C++, Java, JavaScript, Bash");
      out("  tools       Git, PostgreSQL, FastAPI, React, Nmap");
    },

    contact: function () {
      out("contact:");
      out("");
      out("  location   Phoenix, AZ");
      out("  email      neftaligarcialopez2914@gmail.com");
      out("  phone      (602) 733-8776");
      outHTML('<div class="line">  github     <a href="https://github.com/' +
              GH_USER + '" target="_blank" rel="noopener noreferrer">github.com/' +
              GH_USER + '</a></div>');
      outHTML('<div class="line">  linkedin   <a href="https://linkedin.com/in/neftalig2914" ' +
              'target="_blank" rel="noopener noreferrer">linkedin.com/in/neftalig2914</a></div>');
    },

    linkedin: function () {
      out("opening linkedin.com/in/neftalig2914 ...", "dim");
      window.open("https://linkedin.com/in/neftalig2914", "_blank", "noopener,noreferrer");
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

  function loadReadme(owner, repo) {
    var key = owner + "/" + repo;
    if (cache.readmes[key]) { renderReadme(cache.readmes[key]); return; }
    // raw.githubusercontent gives me the plain markdown directly. I try main
    // then master since I'm not always consistent about default branch names.
    tryReadme(owner, repo, "main")
      .catch(function () { return tryReadme(owner, repo, "master"); })
      .then(function (md) {
        cache.readmes[key] = md;
        renderReadme(md);
      })
      .catch(function () {
        out("no README found for " + key + " yet.", "err");
        out("(add a README.md to that repo and it'll show up here automatically)", "dim");
      });
  }

  function tryReadme(owner, repo, branch) {
    var url = "https://raw.githubusercontent.com/" + owner + "/" + repo +
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
