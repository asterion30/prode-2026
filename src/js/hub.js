document.addEventListener('DOMContentLoaded', () => {
  const filterBtns = document.querySelectorAll('.btn-cyber-filter');
  const searchInput = document.getElementById('searchInput');
  const cards = document.querySelectorAll('.cyber-card');

  let activeCat = 'all';

  function applyFilters() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    cards.forEach(card => {
      const matchesCategory = activeCat === 'all' || card.dataset.category === activeCat;
      const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
      const desc = card.querySelector('.card-desc')?.textContent.toLowerCase() || '';
      const matchesSearch = !query || title.includes(query) || desc.includes(query);

      card.style.display = (matchesCategory && matchesSearch) ? 'flex' : 'none';
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.category || 'all';
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
    searchInput.addEventListener('keyup', applyFilters);
  }
});
