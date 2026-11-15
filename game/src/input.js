// Input controller for mouse look and keyboard movement
export const input = {
  keys: {},
  mouse: { dx: 0, dy: 0, down: false, rightDown: false, clicked: false },
  pointerLocked: false,

  init() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouse.dx += e.movementX || e.mozMovementX || e.webkitMovementX || 0;
        this.mouse.dy += e.movementY || e.mozMovementY || e.webkitMovementY || 0;
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      } else if (e.button === 2) {
        this.mouse.rightDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouse.down = false;
      } else if (e.button === 2) {
        this.mouse.rightDown = false;
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  clearFrame() {
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.clicked = false;
  }
};
