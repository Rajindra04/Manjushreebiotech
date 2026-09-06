/* Manjushree Biotech — shared behavior. No build step, no backend:
   just the mobile nav toggle so this stays a plain static site. */
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.mobile-menu');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', function () { menu.classList.toggle('open'); });
  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { menu.classList.remove('open'); });
  });
});
