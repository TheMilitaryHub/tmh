(() => {
  const root = document.documentElement;
  if (!root.classList.contains('js-reveal')) return;
  const els = [...document.querySelectorAll('.reveal')];
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.04 });
  els.forEach(el => io.observe(el));
})();
