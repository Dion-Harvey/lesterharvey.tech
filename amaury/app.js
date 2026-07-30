/* ============================================================
   AMAURY SANDERS — film hero, tab navigation, reveals, lightbox
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- Hero film ---------- */
  const film = document.getElementById("film");
  if (film) {
    // Autoplay is only permitted while muted; browsers reject the promise otherwise.
    const tryPlay = () => {
      const p = film.play();
      if (p && p.catch) p.catch(() => { /* poster stays visible; user can tap */ });
    };
    tryPlay();
    // Some mobile browsers refuse until the first interaction.
    document.addEventListener("touchstart", tryPlay, { once: true, passive: true });
    document.addEventListener("click", tryPlay, { once: true });

    const btn = document.getElementById("sound-btn");
    const label = document.getElementById("sound-label");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        film.muted = !film.muted;
        if (!film.muted) film.volume = 1;
        label.textContent = film.muted ? "Sound on" : "Sound off";
        btn.setAttribute("aria-pressed", String(!film.muted));
        tryPlay();
      });
    }
  }

  /* ---------- Smooth scroll (progressive enhancement) ---------- */
  const lenis = typeof Lenis !== "undefined" ? new Lenis({ lerp: 0.09, smoothWheel: true }) : null;
  window.__lenis = lenis;
  if (lenis) {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* ---------- Tab navigation ---------- */
  const nav = document.getElementById("nav");
  const tabs = [...document.querySelectorAll(".nav-tabs .tab")];

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (e) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      const offset = target.id === "home" ? 0 : -nav.getBoundingClientRect().height + 1;
      if (lenis) lenis.scrollTo(target, { offset, duration: 1.2 });
      else target.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  const sections = tabs
    .map((t) => document.querySelector(t.getAttribute("href")))
    .filter(Boolean);

  function trackActive() {
    const probe = window.innerHeight * 0.4;
    let active = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= probe) active = s;
    tabs.forEach((t) =>
      t.classList.toggle("is-active", t.getAttribute("href") === "#" + active.id)
    );
    // Solid header once the film has scrolled by.
    const hero = document.getElementById("home");
    const past = hero ? hero.getBoundingClientRect().bottom <= nav.getBoundingClientRect().height : window.scrollY > 40;
    nav.classList.toggle("is-solid", past);
  }
  if (lenis) lenis.on("scroll", trackActive);
  window.addEventListener("scroll", trackActive, { passive: true });
  window.addEventListener("resize", trackActive);
  trackActive();

  /* ---------- Scroll reveals ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- Lightbox ---------- */
  const cards = [...document.querySelectorAll(".phase-card, .ill-item")];
  const box = document.getElementById("lightbox");
  let lbIndex = -1;

  function render() {
    const card = cards[lbIndex];
    const img = card.querySelector("img");
    const isArt = card.classList.contains("ill-item");
    // Artwork opens as the original transparent PNG, shown alone on white.
    const src = img.dataset.full || img.src;
    const cap = card.querySelector("figcaption");
    const text = cap && !cap.classList.contains("visually-hidden") ? cap.textContent : "";
    box.classList.toggle("is-art", isArt);
    box.innerHTML = `
      <figure>
        <img src="${src}" alt="${img.alt}" />
        ${isArt ? "" : `<figcaption>
          <span class="lb-phase">${card.dataset.phase || ""}</span>
          <b>${card.dataset.look || ""}</b>
          ${text}
        </figcaption>`}
      </figure>
      <button class="lb-close" type="button">Close</button>
      <button class="lb-prev" type="button">← Prev</button>
      <button class="lb-next" type="button">Next →</button>`;
    box.querySelector(".lb-close").onclick = close;
    box.querySelector(".lb-prev").onclick = () => show((lbIndex - 1 + cards.length) % cards.length);
    box.querySelector(".lb-next").onclick = () => show((lbIndex + 1) % cards.length);
  }
  function show(i) { lbIndex = i; render(); box.hidden = false; if (lenis) lenis.stop(); }
  function close() { box.hidden = true; lbIndex = -1; if (lenis) lenis.start(); }

  cards.forEach((card, i) => card.addEventListener("click", () => show(i)));
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  window.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show((lbIndex - 1 + cards.length) % cards.length);
    if (e.key === "ArrowRight") show((lbIndex + 1) % cards.length);
  });
});
