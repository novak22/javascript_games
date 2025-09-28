(() => {
  const year = new Date().getFullYear();
  document.querySelectorAll('.js-year').forEach((el) => {
    el.textContent = year;
  });
})();
