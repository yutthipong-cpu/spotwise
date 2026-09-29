import * as THREE from 'three';

/**
 * Isometric look = orthographic camera on a tilted orbit. Keeping it a real 3D
 * scene means "rotate the view" is just an angle change, and switching to a
 * perspective camera later gets full 3D with no rendering rewrite.
 */
export class IsoScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;

  private azimuth = Math.PI / 4;
  private targetAzimuth = Math.PI / 4;
  private readonly polar = Math.atan(1 / Math.SQRT2) + 0.12;
  private zoom = 8;
  private targetZoom = 8;
  private target = new THREE.Vector3();

  constructor(
    private canvas: HTMLCanvasElement,
    worldSize: number,
  ) {
    this.target.set(worldSize / 2, 0, worldSize / 2);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0xe8f4fb);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);

    const sun = new THREE.DirectionalLight(0xfff3df, 1.9);
    // behind-left and high, so shadows fall toward the default camera and stay visible
    sun.position.copy(this.target).add(
      new THREE.Vector3(-worldSize * 0.9, worldSize * 1.8, -worldSize * 0.55),
    );
    sun.target.position.copy(this.target);
    this.scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    const span = worldSize * 0.85;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 160 });
    sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xdcf0ff, 0x9ab87f, 1.25));

    this.bindInput();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private bindInput() {
    const canvas = this.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    let mode: 'rotate' | 'pan' | null = null;
    let last = { x: 0, y: 0 };

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) mode = 'rotate';
      else if (e.button === 1 || (e.button === 0 && e.shiftKey)) mode = 'pan';
      else return;
      e.preventDefault();
      last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!mode) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      if (mode === 'rotate') {
        this.targetAzimuth += dx * 0.008;
      } else {
        const scale = this.zoom / 260;
        const forward = new THREE.Vector3(Math.cos(this.azimuth), 0, Math.sin(this.azimuth));
        const right = new THREE.Vector3(-Math.sin(this.azimuth), 0, Math.cos(this.azimuth));
        this.target.addScaledVector(right, -dx * scale).addScaledVector(forward, -dy * scale);
      }
    });

    const end = () => (mode = null);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(Math.sign(e.deltaY) * 0.12);
    }, { passive: false });
  }

  rotateBy(steps: number) {
    this.targetAzimuth += (steps * Math.PI) / 4;
  }

  zoomBy(amount: number) {
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom * (1 + amount), 3, 30);
  }

  private resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.applyProjection();
  }

  private applyProjection() {
    const aspect = innerWidth / innerHeight;
    this.camera.left = -this.zoom * aspect;
    this.camera.right = this.zoom * aspect;
    this.camera.top = this.zoom;
    this.camera.bottom = -this.zoom;
    this.camera.updateProjectionMatrix();
  }

  update() {
    this.azimuth += (this.targetAzimuth - this.azimuth) * 0.14;
    if (Math.abs(this.targetZoom - this.zoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * 0.18;
      this.applyProjection();
    }
    const r = 60;
    this.camera.position.set(
      this.target.x + r * Math.sin(this.polar) * Math.cos(this.azimuth),
      this.target.y + r * Math.cos(this.polar),
      this.target.z + r * Math.sin(this.polar) * Math.sin(this.azimuth),
    );
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  }
}
