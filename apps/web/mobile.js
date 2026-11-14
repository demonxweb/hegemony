// 手機版互動：左側滑動選單、底部小分頁、主圖板的拖曳與縮放。
// 只在寬度 640px 以下運作（樣式在 mobile.css）；桌面版完全不受影響。
// 畫面內容由 app.js 重新繪製（會整個換掉 #app），所以這裡用事件委派，並在每次重繪後重新套用位置。
// 直向手機（寬度 640px 以下），以及橫向手機（橫向且高度 500px 以下）
const mobile = matchMedia('(max-width: 640px), (orientation: landscape) and (max-height: 500px)');
const body = document.body;
const app = document.querySelector('#app');
const $ = selector => document.querySelector(selector);

/* ---------- 左側滑動選單 ---------- */
const setMenu = open => {
  body.classList.toggle('m-menu-open', open);
  $('#mobile-menu-toggle')?.setAttribute('aria-expanded', String(open));
};
$('#mobile-menu-toggle')?.addEventListener('click', () => setMenu(!body.classList.contains('m-menu-open')));
$('#mobile-scrim')?.addEventListener('click', () => setMenu(false));
$('#mobile-drawer')?.addEventListener('click', event => {
  const proxy = event.target.closest('[data-proxy]');
  // 試算、價格、摘要、記錄的面板按鈕在狀態列裡，這裡代為點擊。
  if (proxy) $(`#player-tab-${proxy.dataset.proxy}`)?.click();
  if (event.target.closest('button, a')) setMenu(false);
});

/* ---------- 聊天未讀提示：聊天面板收起時有新訊息，「聊天」分頁上顯示數字 ---------- */
let unread = 0;
let lastCount = null;
let ownSent = 0;
const setUnread = count => {
  unread = count;
  const tab = document.querySelector('#mobile-tabs [data-sheet="chat"]');
  if (!tab) return;
  if (count > 0) tab.dataset.unread = count > 9 ? '9+' : String(count);
  else delete tab.dataset.unread;
};
const chatHistory = document.querySelector('#room-chat [data-chat-history]');
if (chatHistory) {
  new MutationObserver(() => {
    const count = chatHistory.querySelectorAll('li').length;
    // 第一次載入的既有訊息不算未讀
    if (lastCount !== null && count > lastCount) {
      const added = count - lastCount;
      // 自己剛送出的訊息不算
      const fresh = Math.max(0, added - ownSent);
      ownSent = Math.max(0, ownSent - added);
      if (fresh && document.body.dataset.sheet !== 'chat') setUnread(unread + fresh);
    }
    lastCount = count;
  }).observe(chatHistory, { childList: true });
}
document.querySelector('#room-chat form')?.addEventListener('submit', () => { ownSent++; });
// 聊天區第一次顯示時，現有的訊息數當作基準（包含 0 則）
const roomChatBox = document.querySelector('#room-chat');
if (roomChatBox && chatHistory) {
  const baseline = () => { if (lastCount === null && !roomChatBox.hidden) lastCount = chatHistory.querySelectorAll('li').length; };
  new MutationObserver(baseline).observe(roomChatBox, { attributes: true, attributeFilter: ['hidden'] });
  baseline();
}

/* ---------- 底部小分頁 ---------- */
const tabs = [...document.querySelectorAll('#mobile-tabs [data-sheet]')];
const setSheet = name => {
  body.dataset.sheet = name ?? '';
  body.classList.toggle('m-sheet-open', Boolean(name));
  for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.sheet === name));
  if (name) setMenu(false);
  if (name === 'chat') {
    setUnread(0);
    const details = $('#room-chat details');
    if (details) details.open = true;
    const history = $('#room-chat [data-chat-history]');
    if (history) history.scrollTop = history.scrollHeight;
  }
};
for (const tab of tabs) tab.addEventListener('click', () => setSheet(body.dataset.sheet === tab.dataset.sheet ? '' : tab.dataset.sheet));

/* ---------- 主圖板：拖曳與縮放 ---------- */
const view = { scale: 1, x: 0, y: 0 };
const minScale = 0.4;
const maxScale = 3;

function viewport() {
  const frame = $('#tabletop');
  const board = frame?.querySelector(':scope > .main-board');
  return frame && board ? { frame, board, width: frame.clientWidth, height: frame.clientHeight } : null;
}

function apply() {
  const target = viewport();
  if (!target) return;
  if (!mobile.matches) {
    target.board.style.transform = '';
    return;
  }
  const slack = 40;
  const scaledWidth = target.board.offsetWidth * view.scale;
  const scaledHeight = target.board.offsetHeight * view.scale;
  view.x = scaledWidth <= target.width ? (target.width - scaledWidth) / 2 : Math.min(slack, Math.max(target.width - scaledWidth - slack, view.x));
  view.y = scaledHeight <= target.height ? 0 : Math.min(slack, Math.max(target.height - scaledHeight - slack, view.y));
  target.board.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

function zoomAt(nextScale, centerX, centerY) {
  const scale = Math.min(maxScale, Math.max(minScale, nextScale));
  const ratio = scale / view.scale;
  view.x = centerX - (centerX - view.x) * ratio;
  view.y = centerY - (centerY - view.y) * ratio;
  view.scale = scale;
  apply();
}

const pointers = new Map();
let panStart = null;
let pinchStart = null;
let moved = false;

const frameOf = event => event.target.closest?.('#tabletop');
const local = (frame, point) => {
  const box = frame.getBoundingClientRect();
  return { x: point.x - box.left, y: point.y - box.top };
};
const pinchState = frame => {
  const [a, b] = [...pointers.values()];
  return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, center: local(frame, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), ...view };
};

app.addEventListener('pointerdown', event => {
  const frame = frameOf(event);
  if (!mobile.matches || !frame || event.target.closest('[data-piece]')) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) {
    panStart = { x: view.x, y: view.y, pointerX: event.clientX, pointerY: event.clientY };
    moved = false;
  } else if (pointers.size === 2) {
    pinchStart = pinchState(frame);
    moved = true;
  }
});

app.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const frame = $('#tabletop');
  if (!frame) return;
  if (pointers.size >= 2 && pinchStart) {
    const now = pinchState(frame);
    const scale = Math.min(maxScale, Math.max(minScale, pinchStart.scale * now.distance / pinchStart.distance));
    const ratio = scale / pinchStart.scale;
    view.scale = scale;
    view.x = now.center.x - (pinchStart.center.x - pinchStart.x) * ratio;
    view.y = now.center.y - (pinchStart.center.y - pinchStart.y) * ratio;
    apply();
  } else if (panStart && pointers.size === 1) {
    const dx = event.clientX - panStart.pointerX;
    const dy = event.clientY - panStart.pointerY;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    view.x = panStart.x + dx;
    view.y = panStart.y + dy;
    apply();
  }
});

const release = event => {
  if (!pointers.delete(event.pointerId)) return;
  pinchStart = null;
  panStart = null;
  if (pointers.size === 1) {
    const [rest] = [...pointers.values()];
    panStart = { x: view.x, y: view.y, pointerX: rest.x, pointerY: rest.y };
  }
};
app.addEventListener('pointerup', release);
app.addEventListener('pointercancel', release);
// 拖曳後放開不要誤觸按鈕
app.addEventListener('click', event => {
  if (!moved || !frameOf(event)) return;
  moved = false;
  event.stopPropagation();
  event.preventDefault();
}, true);
// 電腦上以滑鼠滾輪縮放（方便測試）
app.addEventListener('wheel', event => {
  const frame = frameOf(event);
  if (!mobile.matches || !frame) return;
  event.preventDefault();
  const point = local(frame, { x: event.clientX, y: event.clientY });
  zoomAt(view.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), point.x, point.y);
}, { passive: false });

$('#mobile-zoom')?.addEventListener('click', event => {
  const action = event.target.closest('[data-zoom]')?.dataset.zoom;
  const target = viewport();
  if (!action || !target) return;
  if (action === 'reset') {
    Object.assign(view, { scale: 1, x: 0, y: 0 });
    apply();
  } else zoomAt(view.scale * (action === 'in' ? 1.25 : 0.8), target.width / 2, target.height / 2);
});

/* ---------- 每次畫面重繪後同步狀態 ---------- */
function sync() {
  const game = Boolean($('.table-layout'));
  body.classList.toggle('m-game', game);
  if (!game && body.dataset.sheet) setSheet('');
  tabs.find(tab => tab.dataset.sheet === 'hand')?.classList.toggle('has-action', Boolean($('#main-action-options')));
  tabs.find(tab => tab.dataset.sheet === 'free')?.classList.toggle('has-action', Boolean($('#free-action-options')));
  apply();
}
new MutationObserver(sync).observe(app, { childList: true });
addEventListener('resize', () => apply());
mobile.addEventListener('change', () => {
  if (!mobile.matches) {
    setMenu(false);
    setSheet('');
  }
  sync();
});
sync();
