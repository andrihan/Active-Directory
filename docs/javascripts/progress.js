(function () {
  "use strict";

  var STORAGE_PREFIX = "ad-progress:";

  var MODULES = [
    { slug: "01-fondations", title: "Partie 1 - Le cœur d'AD DS" },
    { slug: "02-ecosysteme", title: "Partie 2 - L'écosystème de services" },
    { slug: "03-resilience", title: "Partie 3 - La résilience" },
    { slug: "04-exploitation-sre", title: "Partie 4 - L'exploitation SRE-grade" },
    { slug: "05-theorie", title: "Partie 5 - Les fondements théoriques" },
    { slug: "06-purple-team", title: "Partie 6 - Purple Team AD" },
    { slug: "06-bis-red-team", title: "Partie 6-bis - Opérations Red Team" },
    { slug: "07-bis-gouvernance", title: "Partie 7-bis - Gouvernance des outils de sécurité" },
    { slug: "07-bis-annexes", title: "Partie 7-bis (annexe) - Commandes & configurations" },
    { slug: "08-datacenter", title: "Partie 8 - Gestion de flotte & Data Center" }
  ];

  function pageKey(slug) {
    return STORAGE_PREFIX + "page:" + slug;
  }

  function sectionKey(slug, headingId) {
    return STORAGE_PREFIX + "section:" + slug + ":" + headingId;
  }

  function isChecked(key) {
    return localStorage.getItem(key) === "1";
  }

  function setChecked(key, value) {
    if (value) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  }

  function currentSlug() {
    var segments = window.location.pathname.split("/").filter(Boolean);
    var last = segments[segments.length - 1];
    return last || "index";
  }

  function buildCheckbox(key, label, onChange) {
    var wrap = document.createElement("label");
    wrap.className = "ad-progress-checkbox";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isChecked(key);
    input.addEventListener("change", function () {
      setChecked(key, input.checked);
      if (onChange) onChange(input.checked);
    });
    wrap.appendChild(input);
    if (label) {
      var span = document.createElement("span");
      span.textContent = label;
      wrap.appendChild(span);
    }
    return wrap;
  }

  function findContentRoot() {
    return (
      document.querySelector(".md-content__inner") ||
      document.querySelector("article")
    );
  }

  function injectModuleCheckbox(slug) {
    var root = findContentRoot();
    if (!root) return;
    var h1 = root.querySelector("h1");
    if (!h1) return;
    var key = pageKey(slug);
    var box = buildCheckbox(key, "Marquer ce module comme terminé");
    box.classList.add("ad-progress-module", "ad-progress-module--page");
    h1.insertAdjacentElement("afterend", box);
  }

  function injectSectionCheckboxes(slug) {
    var root = findContentRoot();
    if (!root) return;
    var headings = root.querySelectorAll("h2[id]");
    headings.forEach(function (heading) {
      var key = sectionKey(slug, heading.id);
      var box = buildCheckbox(key, "");
      box.classList.add("ad-progress-section");
      box.title = "Marquer cette section comme lue";
      heading.insertBefore(box, heading.firstChild);
    });
  }

  function renderHomepageTracker() {
    var container = document.getElementById("progress-tracker");
    if (!container) return;
    container.innerHTML = "";

    var bar = document.createElement("div");
    bar.className = "ad-progress-bar";
    var fill = document.createElement("div");
    fill.className = "ad-progress-bar-fill";
    bar.appendChild(fill);

    var summary = document.createElement("p");
    summary.className = "ad-progress-summary";

    var list = document.createElement("ul");
    list.className = "ad-progress-list";

    function refresh() {
      var done = MODULES.filter(function (m) {
        return isChecked(pageKey(m.slug));
      }).length;
      var pct = Math.round((done / MODULES.length) * 100);
      fill.style.width = pct + "%";
      summary.textContent =
        done + " / " + MODULES.length + " modules terminés (" + pct + " %)";
    }

    MODULES.forEach(function (m) {
      var li = document.createElement("li");
      var key = pageKey(m.slug);
      var box = buildCheckbox(key, "", function () {
        refresh();
      });
      box.classList.add("ad-progress-module");
      var link = document.createElement("a");
      link.href = "/" + m.slug + "/";
      link.textContent = m.title;
      li.appendChild(box);
      li.appendChild(link);
      list.appendChild(li);
    });

    container.appendChild(bar);
    container.appendChild(summary);
    container.appendChild(list);
    refresh();
  }

  function init() {
    var slug = currentSlug();
    var known = MODULES.some(function (m) {
      return m.slug === slug;
    });
    if (known) {
      injectModuleCheckbox(slug);
      injectSectionCheckboxes(slug);
    } else {
      renderHomepageTracker();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
