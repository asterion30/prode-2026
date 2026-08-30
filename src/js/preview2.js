document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.mecha-tab-btn');
  const cards = document.querySelectorAll('.mecha-card');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat || 'all';

      cards.forEach(card => {
        if (cat === 'all' || card.dataset.cat === cat) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
});
