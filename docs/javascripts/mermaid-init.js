document.addEventListener("DOMContentLoaded", function () {
  if (!window.mermaid) return;
  var scheme = document.body.getAttribute("data-md-color-scheme");
  mermaid.initialize({
    startOnLoad: true,
    theme: scheme === "slate" ? "dark" : "default",
    securityLevel: "loose"
  });
});
