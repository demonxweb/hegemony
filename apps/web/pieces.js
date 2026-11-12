export function attachPieces(root, accepts, place, announce) {
  let selected;
  let gesture;
  let ghost;
  let frame;
  let ignoreClickUntil = 0;

  const piece = element => element?.closest('[data-piece]');
  const target = element => element?.closest('[data-drop]');
  const read = (element, key) => ({ type: element.dataset[key], id: element.dataset[key + 'Id'] ?? '' });
  const allowed = (element, source) => element && source && accepts(source, read(element, 'drop'));

  function highlight(source) {
    for (const element of root.querySelectorAll('[data-drop]')) {
      element.classList.toggle('drop-ready', !element.hasAttribute('data-drop-quiet') && Boolean(allowed(element, source)));
      element.classList.remove('drop-over');
    }
  }

  function cancel() {
    selected = null;
    gesture = null;
    root.classList.remove('dragging');
    ghost?.remove();
    ghost = null;
    cancelAnimationFrame(frame);
    for (const element of root.querySelectorAll('.piece-picked')) element.classList.remove('piece-picked');
    highlight(null);
  }

  function moveGhost() {
    if (!ghost || !gesture) return;
    const { x, y } = gesture;
    ghost.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
    const edge = 66;
    if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 4));
    if (y > innerHeight - edge) window.scrollBy(0, Math.ceil((y - innerHeight + edge) / 4));
    const over = target(document.elementFromPoint(x, y));
    for (const element of root.querySelectorAll('.drop-over')) element.classList.remove('drop-over');
    if (allowed(over, gesture.source) && !over.hasAttribute('data-drop-quiet')) over.classList.add('drop-over');
    frame = requestAnimationFrame(moveGhost);
  }

  root.addEventListener('pointerdown', event => {
    const element = piece(event.target);
    if (!element || !event.isPrimary || event.button !== 0) return;
    cancel();
    gesture = { source: read(element, 'piece'), element, pointer: event.pointerId, x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY };
  });
  window.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    if (ghost || Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY) < 7) return;
    ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = gesture.element.dataset.pieceLabel;
    document.body.append(ghost);
    root.classList.add('dragging');
    gesture.element.classList.add('piece-picked');
    highlight(gesture.source);
    moveGhost();
  });
  window.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    if (!ghost) {
      gesture = null;
      return;
    }
    const { source } = gesture;
    const destination = target(document.elementFromPoint(event.clientX, event.clientY));
    const valid = allowed(destination, source);
    ignoreClickUntil = performance.now() + 250;
    cancel();
    if (valid) place(source, read(destination, 'drop'));
    else announce('未放到可用區域，物件留在原位。');
  });
  window.addEventListener('pointercancel', cancel);
  root.addEventListener('dragstart', event => {
    if (piece(event.target)) event.preventDefault();
  });
  root.addEventListener('click', event => {
    const element = piece(event.target);
    const destination = target(event.target);
    if (!element && !destination) return;
    if (performance.now() < ignoreClickUntil) {
      event.stopImmediatePropagation();
      return;
    }
    if (allowed(destination, selected)) {
      const source = selected;
      cancel();
      place(source, read(destination, 'drop'));
    } else if (element) {
      cancel();
      selected = read(element, 'piece');
      element.classList.add('piece-picked');
      highlight(selected);
      announce(`已選擇 ${element.dataset.pieceLabel}，可點選標亮的放置區。`);
    }
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (gesture || selected)) cancel();
  });
  return { cancel, active: () => Boolean(gesture) };
}
