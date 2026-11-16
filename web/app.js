(() => {
  const api = '';
  const labels = { FRIDGE: '냉장', FREEZER: '냉동', ROOM: '실온' };
  let storage = 'FRIDGE';
  let items = [];
  let demoMode = false;
  let demoId = -11;
  let loadVersion = 0;
  const pending = new Set();
  let toastTimer;
  const content = document.querySelector('#content');
  const toast = document.querySelector('#toast');
  const addDialog = document.querySelector('#add-dialog');
  const recipeDialog = document.querySelector('#recipe-dialog');

  function dateOffset(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  const demoData = {
    FRIDGE: [
      { ingredient_id: -1, name: '계란', storage_type: 'FRIDGE', expire_date: dateOffset(3), dDay: 3 },
      { ingredient_id: -2, name: '두부', storage_type: 'FRIDGE', expire_date: dateOffset(0), dDay: 0 },
      { ingredient_id: -3, name: '우유', storage_type: 'FRIDGE', expire_date: dateOffset(-1), dDay: -1 },
      { ingredient_id: -4, name: '대파', storage_type: 'FRIDGE', expire_date: dateOffset(6), dDay: 6 },
    ],
    FREEZER: [
      { ingredient_id: -5, name: '냉동만두', storage_type: 'FREEZER', expire_date: dateOffset(3), dDay: 3 },
      { ingredient_id: -6, name: '닭가슴살', storage_type: 'FREEZER', expire_date: dateOffset(10), dDay: 10 },
      { ingredient_id: -7, name: '식빵', storage_type: 'FREEZER', expire_date: dateOffset(-2), dDay: -2 },
    ],
    ROOM: [
      { ingredient_id: -8, name: '양파', storage_type: 'ROOM', expire_date: dateOffset(1), dDay: 1 },
      { ingredient_id: -9, name: '감자', storage_type: 'ROOM', expire_date: dateOffset(5), dDay: 5 },
      { ingredient_id: -10, name: '참치', storage_type: 'ROOM', expire_date: dateOffset(-3), dDay: -3 },
    ],
  };

  function showToast(message, actionLabel, action) {
    clearTimeout(toastTimer);
    toast.replaceChildren(document.createTextNode(message));
    if (actionLabel && action) {
      const button = document.createElement('button');
      button.textContent = actionLabel;
      button.addEventListener('click', action, { once: true });
      toast.append(button);
    }
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), actionLabel ? 8000 : 2800);
  }

  async function request(url, options = {}) {
    const response = await fetch(`${api}${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`);
    return data;
  }

  function render() {
    document.querySelectorAll('.tab').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.storage === storage)));
    document.querySelector('#total-count').textContent = `${items.length}개`;
    document.querySelector('#urgent-count').textContent = `${items.filter(item => Number(item.dDay) >= 0 && Number(item.dDay) <= 3).length}개`;
    document.querySelector('#section-title').textContent = `${labels[storage]} 보관`;
    document.querySelector('#item-count').textContent = demoMode ? `테스트 예시 · 식재료 ${items.length}개` : `식재료 ${items.length}개`;
    content.replaceChildren();
    if (demoMode) {
      const banner = document.createElement('div');
      banner.className = 'demo-banner';
      banner.innerHTML = '<span>✦</span><span><strong>데모 냉장고를 둘러보고 있어요</strong><small>예시 데이터이며, 변경 내용은 새로고침하면 초기화돼요.</small></span>';
      content.append(banner);
    }
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<div class="empty-icon">🥣</div><h3>냉장고가 비어있어요!</h3><p>식재료를 등록하고 유통기한을 관리해보세요.</p><button type="button">식재료 등록하기</button>';
      empty.querySelector('button').addEventListener('click', openAdd);
      content.append(empty);
      return;
    }
    const query = document.querySelector('#search').value.trim().toLocaleLowerCase();
    const visible = items.filter(item => item.name.toLocaleLowerCase().includes(query)).sort(document.querySelector('#sort').value === 'name' ? (a, b) => a.name.localeCompare(b.name, 'ko') : (a, b) => String(a.expire_date).localeCompare(String(b.expire_date)));
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<div class="empty-icon">⌕</div><h3>찾는 재료가 없어요</h3><p>다른 이름으로 검색해보세요.</p>';
      content.append(empty);
    }
    visible.forEach(item => content.append(makeCard(item)));
  }

  function makeCard(item) {
    const card = document.createElement('article');
    card.className = 'ingredient-card';
    const dday = Number(item.dDay);
    const badge = dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day' : `D+${Math.abs(dday)}`;
    const icons = { '계란': '🥚', '두부': '◻️', '우유': '🥛', '대파': '🥬', '양파': '🧅', '감자': '🥔', '참치': '🐟', '닭가슴살': '🍗', '식빵': '🍞', '냉동만두': '🥟' };
    card.innerHTML = `<div class="card-top"><span class="food-icon" aria-hidden="true">${icons[item.name] || '🥗'}</span><h3 class="ingredient-name"></h3><span class="dday ${dday < 0 ? 'expired' : dday <= 3 ? 'urgent' : ''}">${badge}</span></div><p class="expire">${labels[item.storage_type] || labels[storage]} 보관 · 유통기한 ${escapeHtml(String(item.expire_date).slice(0, 10))}${dday < 0 ? ' · 기한 경과' : ''}</p><div class="card-actions"><button class="delete-action" type="button">삭제</button><div class="action-group"></div></div>`;
    card.querySelector('.ingredient-name').textContent = item.name;
    card.querySelector('.delete-action').setAttribute('aria-label', `${item.name} 삭제`);
    card.querySelector('.delete-action').addEventListener('click', () => deleteItem(item));
    const actions = card.querySelector('.action-group');
    if (dday >= 0) {
      const recipe = document.createElement('button');
      recipe.className = 'text-action';
      recipe.textContent = '🍳 1인분 레시피 보기';
      recipe.addEventListener('click', () => showRecipes(item));
      actions.append(recipe);
    }
    const consume = document.createElement('button');
    consume.className = 'consume-action';
    consume.textContent = '✓ 완식';
    consume.addEventListener('click', () => consumeItem(item));
    actions.append(consume);
    let startX = null;
    card.addEventListener('touchstart', event => { startX = event.changedTouches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', event => {
      if (startX !== null && startX - event.changedTouches[0].clientX > 85) deleteItem(item);
      startX = null;
    }, { passive: true });
    card.addEventListener('pointerdown', event => { if (event.pointerType === 'mouse') startX = event.clientX; });
    card.addEventListener('pointerup', event => {
      if (event.pointerType === 'mouse' && startX !== null && startX - event.clientX > 110) deleteItem(item);
      startX = null;
    });
    return card;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  async function load() {
    const version = ++loadVersion;
    const selectedStorage = storage;
    if (demoMode) {
      items = [...demoData[storage]].sort((a, b) => a.expire_date.localeCompare(b.expire_date));
      render();
      return;
    }
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><h3>식재료를 불러오는 중이에요</h3></div>';
    try {
      const result = await request(`/api/ingredients?userId=1&storageType=${selectedStorage}`);
      if (version !== loadVersion) return;
      items = result;
      render();
    } catch (error) {
      if (version !== loadVersion) return;
      demoMode = true;
      items = demoData[storage];
      render();
      showToast('백엔드에 연결할 수 없어 테스트 예시를 보여드려요.');
    }
  }

  function openAdd() {
    document.querySelector('#storage-type').value = storage;
    const date = new Date();
    date.setDate(date.getDate() + 7);
    document.querySelector('#expire-date').value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    addDialog.showModal();
    setTimeout(() => document.querySelector('#ingredient-name').focus(), 30);
  }

  async function deleteItem(item) {
    if (demoMode) {
      demoData[storage] = demoData[storage].filter(value => value.ingredient_id !== item.ingredient_id);
      items = demoData[storage];
      render();
      showToast(`${item.name} 예시를 삭제했어요.`);
      return;
    }
    try {
      await request(`/api/ingredients/${item.ingredient_id}`, { method: 'DELETE' });
      showToast(`${item.name}을(를) 삭제했어요.`);
      await load();
    } catch (error) { showToast(error.message); await load(); }
  }

  async function consumeItem(item) {
    if (pending.has(item.ingredient_id)) return;
    pending.add(item.ingredient_id);
    items = items.filter(value => value.ingredient_id !== item.ingredient_id);
    render();
    if (demoMode) {
      demoData[storage] = items;
      pending.delete(item.ingredient_id);
      showToast(`${item.name} 다 드셨네요! 최저가로 바로 채워둘까요?`, '채우기', () => window.open(`https://www.coupang.com/np/search?q=${encodeURIComponent(item.name)}`, '_blank', 'noopener'));
      return;
    }
    try {
      const result = await request(`/api/ingredients/${item.ingredient_id}/consume`, { method: 'PATCH' });
      showToast(`${item.name} 다 드셨네요! 최저가로 바로 채워둘까요?`, '채우기', () => window.open(result.repurchaseUrl, '_blank', 'noopener'));
      await load();
    } catch (error) { showToast(error.message); await load(); }
    finally { pending.delete(item.ingredient_id); }
  }

  async function showRecipes(item) {
    const target = document.querySelector('#recipe-content');
    target.innerHTML = '<p class="eyebrow">ONE SERVING RECIPE</p><h2>레시피를 찾고 있어요...</h2>';
    recipeDialog.showModal();
    try {
      const recipes = demoMode ? [sampleRecipe(item.name)] : await request(`/api/recipes/recommend?ingredient=${encodeURIComponent(item.name)}`);
      target.replaceChildren();
      if (!recipes.length) { target.textContent = '추천 레시피가 없어요.'; return; }
      recipes.forEach((recipe, index) => {
        const section = document.createElement('section');
        section.className = 'recipe';
        const title = document.createElement('h2');
        title.textContent = recipe.title || '오늘의 레시피';
        section.append(title);
        if (recipe.imageUrl) {
          const image = document.createElement('img');
          image.className = 'recipe-image';
          image.src = recipe.imageUrl;
          image.alt = recipe.title || '요리 이미지';
          image.onerror = () => { const placeholder = document.createElement('div'); placeholder.className = 'recipe-placeholder'; placeholder.textContent = '🍽️'; image.replaceWith(placeholder); };
          section.append(image);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'recipe-placeholder';
          placeholder.textContent = '🍽️';
          section.append(placeholder);
        }
        const ingredients = document.createElement('div');
        ingredients.className = 'recipe-block';
        ingredients.innerHTML = '<h3>필요 재료</h3><p></p>';
        ingredients.querySelector('p').textContent = recipe.ingredients || '재료 정보가 없어요.';
        section.append(ingredients);
        const steps = document.createElement('div');
        steps.className = 'recipe-block';
        steps.innerHTML = '<h3>조리 순서</h3><p></p>';
        steps.querySelector('p').textContent = recipe.instructions || '조리 순서 정보가 없어요.';
        section.append(steps);
        if (recipe.isFallback) { const note = document.createElement('p'); note.className = 'fallback-note'; note.textContent = '기본 추천 레시피'; section.append(note); }
        if (index > 0) section.prepend(document.createElement('hr'));
        target.append(section);
      });
    } catch (error) {
      target.innerHTML = '<p class="eyebrow">ONE SERVING RECIPE</p><h2>레시피를 불러오지 못했어요</h2>';
      const message = document.createElement('p'); message.textContent = error.message; target.append(message);
    }
  }

  function sampleRecipe(name) {
    const recipes = {
      '계란': ['전자레인지 계란찜', '계란 2개, 물 100ml, 소금 약간, 대파 조금', '1. 계란과 물, 소금을 그릇에 풀어요.\n2. 다진 대파를 넣고 뚜껑을 살짝 덮어요.\n3. 전자레인지에서 2분 익혀요.'],
      '두부': ['간장 두부조림', '두부 1/2모, 간장 1큰술, 물 3큰술, 대파 조금', '1. 두부를 썰어 팬에 노릇하게 구워요.\n2. 간장과 물을 넣어요.\n3. 대파를 넣고 5분 졸여요.'],
      '우유': ['초간단 우유 크림 파스타', '파스타면 1인분, 우유 200ml, 마늘 1쪽', '1. 파스타면을 삶아요.\n2. 마늘을 볶고 우유를 부어 끓여요.\n3. 면을 넣고 2분 섞어요.'],
      '대파': ['대파 계란볶음밥', '밥 1공기, 계란 1개, 대파 1/2대, 간장', '1. 대파를 잘게 썰어 볶아요.\n2. 계란과 밥을 넣어요.\n3. 간장을 둘러 고루 볶아요.'],
      '냉동만두': ['바삭한 만두구이', '냉동만두 6개, 식용유, 물 2큰술', '1. 팬에 기름을 두르고 만두를 올려요.\n2. 밑면이 노릇해지면 물을 넣고 뚜껑을 덮어요.\n3. 물이 사라지면 바삭하게 구워요.'],
      '양파': ['양파 간장덮밥', '밥 1공기, 양파 1/2개, 간장 1큰술, 계란 1개', '1. 양파를 얇게 썰어 볶아요.\n2. 간장과 물을 넣고 부드럽게 익혀요.\n3. 계란을 넣어 밥 위에 올려요.'],
      '참치': ['참치 마요 덮밥', '밥 1공기, 참치 1/2캔, 마요네즈, 김가루', '1. 참치 기름을 빼요.\n2. 밥 위에 참치와 마요네즈를 올려요.\n3. 김가루를 뿌려 완성해요.'],
    };
    const matched = recipes[name] || ['초간단 한 그릇 요리', `${name}, 밥 1공기, 간장 약간`, `1. ${name}을 먹기 좋게 손질해요.\n2. 팬에 볶아 익혀요.\n3. 밥과 함께 담아 맛있게 먹어요.`];
    return { title: matched[0], ingredients: matched[1], instructions: matched[2], imageUrl: null, isFallback: true };
  }

  document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
    storage = button.dataset.storage;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button));
    load();
  }));
  document.querySelector('#refresh').addEventListener('click', load);
  document.querySelector('#add-open').addEventListener('click', openAdd);
  document.querySelector('#add-inline').addEventListener('click', openAdd);
  document.querySelector('#search').addEventListener('input', render);
  document.querySelector('#sort').addEventListener('change', render);
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
  document.querySelector('#add-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = document.querySelector('#ingredient-name').value.trim();
    if (!name) { showToast('식재료 이름을 입력해주세요'); return; }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    if (demoMode) {
      const expireDate = document.querySelector('#expire-date').value;
      const expire = new Date(`${expireDate}T12:00:00`);
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const dday = Math.round((expire.getTime() - today.getTime()) / 86400000);
      const created = { ingredient_id: demoId--, name, storage_type: document.querySelector('#storage-type').value, expire_date: expireDate, dDay: dday };
      demoData[created.storage_type].push(created);
      storage = created.storage_type;
      document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.storage === storage));
      addDialog.close();
      form.reset();
      button.disabled = false;
      showToast('테스트 예시를 추가했어요.');
      await load();
      return;
    }
    try {
      await request('/api/ingredients', { method: 'POST', body: JSON.stringify({ userId: 1, name, storageType: document.querySelector('#storage-type').value, expireDate: document.querySelector('#expire-date').value }) });
      storage = document.querySelector('#storage-type').value;
      document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.storage === storage));
      addDialog.close();
      form.reset();
      showToast('식재료를 등록했어요.');
      await load();
    } catch (error) { showToast(error.message); }
    finally { button.disabled = false; }
  });

  load();
})();
