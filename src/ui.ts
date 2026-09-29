import { CATALOG_BY_ID, CATEGORIES, searchCatalog, type CategoryId } from './catalog';

export function setupLibrary(onSelect: (id: string) => void) {
  const categoriesEl = document.getElementById('categories')!;
  const itemsEl = document.getElementById('items')!;
  const searchEl = document.getElementById('search') as HTMLInputElement;
  const selectedEl = document.getElementById('selected')!;

  let category: CategoryId | 'all' = 'all';
  let activeId: string | null = null;

  const tabs = [{ id: 'all' as const, label: 'ทั้งหมด', icon: '✨' }, ...CATEGORIES];
  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.textContent = `${tab.icon} ${tab.label}`;
    btn.dataset.id = tab.id;
    btn.onclick = () => {
      category = tab.id;
      for (const el of categoriesEl.children) el.classList.toggle('active', el === btn);
      renderItems();
    };
    categoriesEl.appendChild(btn);
    if (tab.id === 'all') btn.classList.add('active');
  }

  searchEl.addEventListener('input', renderItems);

  function renderItems() {
    const results = searchCatalog(searchEl.value, category);
    itemsEl.replaceChildren();

    if (!results.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'ไม่เจอไอเท็มที่ค้นหา 🥲';
      itemsEl.appendChild(empty);
      return;
    }

    for (const item of results) {
      const card = document.createElement('button');
      card.className = 'item';
      card.classList.toggle('active', item.id === activeId);
      card.draggable = true;
      card.dataset.id = item.id;
      card.title = item.label;
      card.innerHTML = `<span class="emoji">${item.icon}</span><span class="name">${item.label}</span>`;
      card.onclick = () => onSelect(item.id);
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', item.id);
        onSelect(item.id);
      });
      itemsEl.appendChild(card);
    }
  }

  function setActive(id: string | null, mode: 'select' | 'place' | 'erase') {
    activeId = mode === 'place' ? id : null;
    for (const el of itemsEl.children) {
      el.classList.toggle('active', (el as HTMLElement).dataset.id === activeId);
    }
    const def = activeId ? CATALOG_BY_ID.get(activeId) : null;
    selectedEl.classList.add('show');
    selectedEl.innerHTML = def
      ? `<span class="chip">${def.icon}</span> กำลังวาง: <b>${def.label}</b>`
      : mode === 'erase'
        ? `<span class="chip">🧽</span> โหมดยางลบ — คลิกเพื่อลบ`
        : `<span class="chip">🖐️</span> โหมดเลือก — คลิกอาคารเพื่อย้าย/ปรับขนาด`;
  }

  renderItems();
  return { setActive };
}
