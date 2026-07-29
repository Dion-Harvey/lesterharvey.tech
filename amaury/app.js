/* ============================================================
   AMAURY SANDERS — scroll engine, tab navigation, reveals, lightbox
   ============================================================ */

/* ---------- Canvas frame-sequence scrub ---------- */
function initScrub(cfg) {
  const section = document.querySelector(cfg.section);
  const canvas  = section.querySelector("canvas");
  // Transparent context: until the first frame is painted the CSS poster
  // background stays visible instead of an opaque black rectangle.
  const ctx     = canvas.getContext("2d");
  const lines   = [...section.querySelectorAll(".reveal-line")];
  const fill    = section.querySelector(".progress-fill");
  const bgFill  = cfg.bg || "#0b0a0a";
  const images  = [];

  let current = -1;
  // draw() reports success so callers never record a frame that failed to paint.
  function draw(index) {
    const img = images[index];
    if (!img || !img.complete || !img.naturalWidth) return false;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const ir = img.naturalWidth / img.naturalHeight, cr = cw / ch;
    let dw, dh, dx, dy;
    if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
    else         { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
    ctx.fillStyle = bgFill; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  }

  // Preload every frame. Whichever image finishes first, only frame 0 counts as
  // the opening paint — otherwise a late-arriving frame 0 leaves the hero blank.
  let firstDrawn = false;
  function tryFirstDraw() {
    if (!firstDrawn && draw(current < 0 ? 0 : current)) firstDrawn = true;
  }
  for (let i = 0; i < cfg.frameCount; i++) {
    const img = new Image();
    img.onload = tryFirstDraw;
    img.src = cfg.framePath(i + 1);
    images[i] = img;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = canvas.clientWidth  * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(current < 0 ? 0 : current);
  }
  function update() {
    const rect = section.getBoundingClientRect();
    if (rect.bottom < -window.innerHeight || rect.top > window.innerHeight) return;
    const scrollable = rect.height - window.innerHeight;
    const p = Math.min(Math.max(-rect.top / scrollable, 0), 1);
    const idx = Math.min(cfg.frameCount - 1, Math.floor(p * (cfg.frameCount - 1)));
    // Only commit the index once it actually painted, so a not-yet-loaded frame
    // is retried on the next tick instead of freezing the hero.
    if (idx !== current && draw(idx)) { current = idx; firstDrawn = true; }
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    for (const el of lines) {
      const a = parseFloat(el.dataset.in), b = parseFloat(el.dataset.out);
      const mid = (a + b) / 2, half = (b - a) / 2;
      let o = 1 - Math.abs(p - mid) / half;
      o = Math.max(0, Math.min(1, o));
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate(-50%, -50%) translateY(${(1 - o) * 26}px)`;
    }
  }
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => resize()).observe(canvas);
  }
  resize();
  return { update, resize };
}

/* ---------- Stat counters ---------- */
function animateCount(el) {
  const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "";
  const dur = 1500, t0 = performance.now();
  function step(t) {
    const k = Math.min((t - t0) / dur, 1), eased = 1 - Math.pow(1 - k, 3);
    el.textContent = (target % 1 === 0 ? Math.round(target * eased) : (target * eased).toFixed(1)) + suffix;
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Smooth scroll + scrub loop ---------- */
  const scrubs = (window.SCRUB_SECTIONS || [])
    .filter((c) => document.querySelector(c.section))
    .map(initScrub);

  // Lenis is progressive enhancement — the site must fully work without it
  // (offline, blocked CDN, file:// quirks).
  const lenis = typeof Lenis !== "undefined" ? new Lenis({ lerp: 0.085, smoothWheel: true }) : null;
  window.__lenis = lenis;
  window.__scrubs = scrubs;
  function raf(t) { if (lenis) lenis.raf(t); scrubs.forEach((s) => s.update()); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  // Fallback for browsers that throttle rAF: keep the scrub in sync with raw scroll.
  window.addEventListener("scroll", () => scrubs.forEach((s) => s.update()), { passive: true });

  /* ---------- Tab navigation ---------- */
  const nav = document.getElementById("nav");
  const tabs = [...document.querySelectorAll(".nav-tabs .tab")];

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (e) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      const navH = nav.getBoundingClientRect().height;
      if (lenis) lenis.scrollTo(target, { offset: -navH + 1, duration: 1.5 });
      else target.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  /* Active tab tracking: pick the last section whose top has passed mid-screen. */
  const sections = tabs
    .map((t) => document.querySelector(t.getAttribute("href")))
    .filter(Boolean);
  function trackActive() {
    const probe = window.innerHeight * 0.5;
    let active = sections[0];
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= probe) active = s;
    }
    tabs.forEach((t) =>
      t.classList.toggle("is-active", t.getAttribute("href") === "#" + active.id)
    );
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
    document.querySelectorAll(".scroll-hint").forEach(
      (h) => (h.style.opacity = window.scrollY > 60 ? "0" : "1")
    );
  }
  if (lenis) lenis.on("scroll", trackActive);
  window.addEventListener("scroll", trackActive, { passive: true });
  trackActive();

  /* ---------- Scroll reveals + counters ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        if (e.target.classList.contains("stat-num")) animateCount(e.target);
        io.unobserve(e.target);
      });
    },
    { threshold: 0.2 }
  );
  document.querySelectorAll(".reveal, .stat-num").forEach((el) => io.observe(el));

  /* ---------- Lightbox for phase images ---------- */
  const cards = [...document.querySelectorAll(".phase-card")];
  const box = document.getElementById("lightbox");
  let lbIndex = -1;

  function renderLightbox() {
    const card = cards[lbIndex];
    const img = card.querySelector("img");
    const caption = card.querySelector("figcaption").textContent;
    box.innerHTML = `
      <figure>
        <img src="${img.src}" alt="${img.alt}" />
        <figcaption>
          <span class="lb-phase">${card.dataset.phase}</span>
          <b>${card.dataset.look}</b>
          ${caption}
        </figcaption>
      </figure>
      <button class="lb-close" aria-label="Close">CLOSE ✕</button>
      <button class="lb-prev" aria-label="Previous">← PREV</button>
      <button class="lb-next" aria-label="Next">NEXT →</button>`;
    box.querySelector(".lb-close").onclick = closeLightbox;
    box.querySelector(".lb-prev").onclick = () => showLightbox((lbIndex - 1 + cards.length) % cards.length);
    box.querySelector(".lb-next").onclick = () => showLightbox((lbIndex + 1) % cards.length);
  }
  function showLightbox(i) {
    lbIndex = i;
    renderLightbox();
    box.hidden = false;
    if (lenis) lenis.stop();
  }
  function closeLightbox() {
    box.hidden = true;
    lbIndex = -1;
    if (lenis) lenis.start();
  }
  cards.forEach((card, i) => card.addEventListener("click", () => showLightbox(i)));
  box.addEventListener("click", (e) => { if (e.target === box) closeLightbox(); });
  window.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showLightbox((lbIndex - 1 + cards.length) % cards.length);
    if (e.key === "ArrowRight") showLightbox((lbIndex + 1) % cards.length);
  });
});
