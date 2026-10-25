document.addEventListener('DOMContentLoaded', () => {
  // Manejador de copiado de snippets
  const copyButtons = document.querySelectorAll('.btn-copy');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.dataset.copy || btn.closest('.install-snippet-box')?.querySelector('.cmd-text')?.textContent?.trim() || '';
      if (!textToCopy) return;

      navigator.clipboard.writeText(textToCopy).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="ph-bold ph-check"></i> ¡Copiado!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  });

  // Filtros de categoría
  const filterBtns = document.querySelectorAll('.btn-cyber-filter');
  const searchInput = document.getElementById('searchLabInput');
  const cards = document.querySelectorAll('.lab-card');

  let activeCat = 'all';

  function applyLabFilters() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    cards.forEach(card => {
      const matchesCategory = activeCat === 'all' || card.dataset.category === activeCat;
      const title = card.querySelector('.project-title')?.textContent.toLowerCase() || '';
      const desc = card.querySelector('.project-description')?.textContent.toLowerCase() || '';
      const tags = card.querySelector('.project-tags')?.textContent.toLowerCase() || '';
      const meta = card.querySelector('.project-meta-id')?.textContent.toLowerCase() || '';
      const matchesSearch = !query || title.includes(query) || desc.includes(query) || tags.includes(query) || meta.includes(query);

      card.style.display = (matchesCategory && matchesSearch) ? 'flex' : 'none';
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.category || 'all';
      applyLabFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', applyLabFilters);
    searchInput.addEventListener('keyup', applyLabFilters);
  }

  // Modal SophosQuick
  const openSophosBtn = document.getElementById('btnOpenSophosModal');
  const closeSophosBtn = document.getElementById('btnCloseSophosModal');
  const closeSophosBottomBtn = document.getElementById('btnCloseSophosModalBottom');
  const sophosModal = document.getElementById('sophosModal');

  if (sophosModal) {
    const openModal = () => sophosModal.classList.add('active');
    const closeModal = () => sophosModal.classList.remove('active');

    openSophosBtn?.addEventListener('click', openModal);
    closeSophosBtn?.addEventListener('click', closeModal);
    closeSophosBottomBtn?.addEventListener('click', closeModal);

    sophosModal.addEventListener('click', (e) => {
      if (e.target === sophosModal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sophosModal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  // Modal OSI Layer 8 (ILP)
  const openOsiBtn = document.getElementById('btnOpenOsiModal');
  const closeOsiBtn = document.getElementById('btnCloseOsiModal');
  const closeOsiBottomBtn = document.getElementById('btnCloseOsiModalBottom');
  const osiModal = document.getElementById('osiModal');

  if (osiModal) {
    const openOsi = () => osiModal.classList.add('active');
    const closeOsi = () => osiModal.classList.remove('active');

    openOsiBtn?.addEventListener('click', openOsi);
    closeOsiBtn?.addEventListener('click', closeOsi);
    closeOsiBottomBtn?.addEventListener('click', closeOsi);

    osiModal.addEventListener('click', (e) => {
      if (e.target === osiModal) closeOsi();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && osiModal.classList.contains('active')) {
        closeOsi();
      }
    });
  }

  // Opcional: Fetch dinámico a GitHub API para mantener siempre el último tag
  const sophosBadge = document.getElementById('sophosVersionBadge');
  if (sophosBadge) {
    fetch('https://api.github.com/repos/asterion30/SophosQuick/releases/latest')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.tag_name) {
          sophosBadge.textContent = `${data.tag_name} (Latest)`;
        }
      })
      .catch(() => {
        // Silencioso fallback
      });
  }
});
