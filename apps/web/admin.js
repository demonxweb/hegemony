const login = document.querySelector('#admin-login');
const dashboard = document.querySelector('#admin-dashboard');
const tabs = [...dashboard.querySelectorAll('[role="tab"]')];
const list = document.querySelector('#admin-room-list');
const notice = document.querySelector('#admin-notice');
const warningDialog = document.querySelector('#warning-dialog');
const empty = document.querySelector('#admin-empty');
const playerList = document.querySelector('#admin-player-list');
const playersEmpty = document.querySelector('#admin-players-empty');
let token;
let setup;
let busy = false;

async function api(path, method = 'GET', body) {
  const response = await fetch('/api/admin/' + path, {
    method, cache: 'no-store',
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: 'Bearer ' + token }),
    },
    body: body && JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && token) await showLogin();
    throw new Error(result.error);
  }
  return result;
}

async function showLogin() {
  token = undefined;
  dashboard.hidden = true;
  login.reset();
  const { configured } = await api('status');
  setup = !configured;
  login.elements.password.autocomplete = setup ? 'new-password' : 'current-password';
  login.querySelector('button').textContent = setup ? '設定密碼並登入' : '登入';
  login.hidden = false;
}

const phases = { lobby: '等待入座', action: '行動', scoring: '輪末計分', complete: '已完成',
  needs: '食物結算', market: '準備', election: '表決', demonstration: '示威', 'policy-choice': '政策處理' };

async function loadRooms() {
  const { rooms } = await api('rooms');
  list.replaceChildren();
  empty.hidden = rooms.length > 0;
  for (const room of rooms) {
    const row = list.insertRow();
    for (const value of [room.code, phases[room.phase] ?? room.phase, room.round ?? '-', `${Object.keys(room.seats).length} / 4`]) {
      row.insertCell().textContent = value;
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.dataset.closeRoom = room.code;
    close.textContent = '關閉房間';
    row.insertCell().append(close);
  }
  login.hidden = true;
  dashboard.hidden = false;
}

async function loadPlayers() {
  const { players } = await api('players');
  playersEmpty.hidden = players.length > 0;
  playerList.replaceChildren();
  for (const player of players) {
    const form = document.createElement('form');
    form.className = 'admin-player-row';
    form.dataset.player = player.id;
    form.innerHTML = `<label>暱稱<input name="name" required maxlength="24" autocomplete="off"></label>
      <label>新密碼<input name="password" type="password" autocomplete="new-password" placeholder="留空保留原密碼"></label>
      <button type="submit">儲存</button>
      <button type="button" data-delete-player>刪除帳號</button>`;
    form.elements.name.value = player.name;
    playerList.append(form);
  }
}

async function refreshAdmin() {
  await Promise.all([loadRooms(), loadPlayers()]);
}

function selectTab(selected, focus = false) {
  for (const tab of tabs) {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  }
  if (focus) selected.focus();
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next], true);
  });
}

async function run(action) {
  if (busy) return;
  busy = true;
  notice.textContent = '';
  try { await action(); }
  catch (error) { showWarning(error.message); }
  finally { busy = false; }
}

function showWarning(text, field) {
  if (warningDialog.open) return;
  warningDialog.querySelector('#warning-text').textContent = text;
  if (field) warningDialog.addEventListener('close', () => field.focus(), { once: true });
  warningDialog.showModal();
}

document.addEventListener('invalid', event => {
  event.preventDefault();
  showWarning(event.target.validationMessage, event.target);
}, true);

login.addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    const fields = new FormData(login);
    const result = await api(setup ? 'setup' : 'login', 'POST', {
      password: fields.get('password'),
    });
    token = result.token;
    login.reset();
    await refreshAdmin();
  });
});
document.querySelector('#admin-refresh').addEventListener('click', () => run(refreshAdmin));
document.querySelector('#admin-logout').addEventListener('click', () => run(showLogin));
list.addEventListener('click', event => {
  const code = event.target.closest('button[data-close-room]')?.dataset.closeRoom;
  if (!code || busy || !window.confirm(`確定關閉房間 ${code}？對局紀錄也會刪除。`)) return;
  run(async () => {
    await api('rooms/' + code, 'DELETE');
    await loadRooms();
    notice.textContent = `已關閉房間 ${code}。`;
  });
});
playerList.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  run(async () => {
    const { name, password } = form.elements;
    await api('players/' + form.dataset.player, 'PATCH', { name: name.value, ...(password.value && { password: password.value }) });
    await loadPlayers();
    notice.textContent = '已更新帳號。';
  });
});
playerList.addEventListener('click', event => {
  const button = event.target.closest('[data-delete-player]');
  if (!button || busy) return;
  const form = button.form;
  if (!window.confirm(`確定刪除「${form.elements.name.value}」的帳號？此玩家將無法再登入或回到原席位。`)) return;
  run(async () => {
    await api('players/' + form.dataset.player, 'DELETE');
    await loadPlayers();
    notice.textContent = '已刪除帳號。';
  });
});
await run(showLogin);
