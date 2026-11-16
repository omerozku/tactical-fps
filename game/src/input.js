export function createInput(canvas, onLockChange) {
  const keys = Object.create(null);
  const pressed = Object.create(null);
  const mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 };
  const state = { locked: false, enabled: true };

  const blockScroll = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ControlLeft', 'ControlRight']);

  window.addEventListener('keydown', (event) => {
    if (blockScroll.has(event.code)) event.preventDefault();
    if (!keys[event.code]) pressed[event.code] = true;
    keys[event.code] = true;
  });

  window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
  });

  window.addEventListener('mousemove', (event) => {
    if (!state.locked || !state.enabled) return;
    mouse.dx += event.movementX || 0;
    mouse.dy += event.movementY || 0;
  });

  window.addEventListener('mousedown', (event) => {
    if (!state.enabled) return;
    if (event.button === 0) {
      mouse.left = true;
      mouse.leftPressed = true;
    } else if (event.button === 2) {
      mouse.right = true;
      mouse.rightPressed = true;
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.left = false;
    if (event.button === 2) mouse.right = false;
  });

  window.addEventListener('wheel', (event) => {
    mouse.wheel += Math.sign(event.deltaY);
  }, { passive: true });

  window.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (onLockChange) onLockChange(state.locked);
  });

  function requestLock() {
    if (canvas.requestPointerLock) {
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    }
  }

  function exitLock() {
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  }

  function consume(code) {
    if (pressed[code]) {
      pressed[code] = false;
      return true;
    }
    return false;
  }

  function endFrame() {
    mouse.dx = 0;
    mouse.dy = 0;
    mouse.leftPressed = false;
    mouse.rightPressed = false;
    mouse.wheel = 0;
    for (const code in pressed) pressed[code] = false;
  }

  return { keys, pressed, mouse, state, requestLock, exitLock, consume, endFrame };
}
