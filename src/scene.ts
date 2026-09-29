import * as THREE from 'three';

/**
 * Isometric look = orthographic camera on a tilted orbit. Keeping it a real 3D
 * scene means "rotate the view" is just an angle change, and switching to a
 * perspective camera later gets full 3D with no rendering rewrite.
 */
export type ViewMode = 'iso' | 'oblique' | 'plan';

export class IsoScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;

  private azimuth = Math.PI / 4;
  private targetAzimuth = Math.PI / 4;
  /** 2:1 isometric — 30° above the horizon, so a square cell draws twice as wide as tall */
  private static readonly ISO_POLAR = Math.PI / 3;
  /** plan view looks straight down; a hair off vertical keeps lookAt() well-defined */
  private static readonly PLAN_POLAR = 0.0001;
  /** oblique: depth drawn at 45° down-left, at half length (cabinet projection) */
  private static readonly OBLIQUE_A = -0.5 * Math.SQRT1_2;
  private static readonly OBLIQUE_B = -0.5 * Math.SQRT1_2;
  private static readonly R = 60;
  private polar = IsoScene.ISO_POLAR;
  private targetPolar = IsoScene.ISO_POLAR;
  private isoAzimuth = Math.PI / 4;
  mode: ViewMode = 'iso';
  private zoom = 10;
  private targetZoom = 10;
  private target = new THREE.Vector3();
  private worldW: number;
  private worldD: number;

  constructor(
    private canvas: HTMLCanvasElement,
    worldW: number,
    worldD: number,
  ) {
    this.worldW = worldW;
    this.worldD = worldD;
    const worldSize = Math.max(worldW, worldD);
    this.target.set(worldW / 2, 0, worldD / 2);

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
    this.fitToWorld(worldW, worldD);
    // the canvas is narrower than the window (sidebar), so track the element
    new ResizeObserver(() => this.resize()).observe(canvas);
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
        if (this.mode !== 'iso') return;
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

  /** frame the whole plate — iso draws a W×D plate as a diamond (W+D)/√2 wide, plan as the plain rectangle */
  private fitToWorld(worldW: number, worldD: number, animate = false) {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    if (!aspect) return;
    let zoom: number;
    if (this.mode === 'plan') {
      zoom = Math.max((worldW + 2) / 2 / aspect, (worldD + 2) / 2);
    } else if (this.mode === 'oblique') {
      const depth = -IsoScene.OBLIQUE_A * worldD;
      zoom = Math.max((worldW + depth + 3) / 2 / aspect, (-IsoScene.OBLIQUE_B * worldD + 12) / 2);
    } else {
      const diagonal = (worldW + worldD) / Math.SQRT2;
      const needWidth = (diagonal + 3) / 2 / aspect;
      const needHeight = (diagonal * Math.cos(IsoScene.ISO_POLAR) + 5) / 2;
      zoom = Math.max(needWidth, needHeight);
    }
    this.targetZoom = zoom;
    if (!animate) {
      this.zoom = zoom;
      this.applyProjection();
    }
  }

  /**
   * iso = 2:1 isometric you can rotate; oblique = front-on with depth sheared to 45°,
   * so widths stay horizontal and heights vertical; plan = straight down, north up.
   */
  setViewMode(mode: ViewMode) {
    if (mode === this.mode) return;
    if (this.mode === 'iso') this.isoAzimuth = this.targetAzimuth;
    this.mode = mode;
    if (mode === 'iso') {
      this.targetAzimuth = this.isoAzimuth;
      this.targetPolar = IsoScene.ISO_POLAR;
    } else {
      // camera on the +z (south) side so grid row 0 — north — sits at the top of the screen
      this.targetAzimuth = Math.PI / 2;
      this.targetPolar = mode === 'plan' ? IsoScene.PLAN_POLAR : Math.PI / 2;
    }
    // the shear can't be tweened, so every switch snaps
    this.azimuth = this.targetAzimuth;
    this.polar = this.targetPolar;
    this.target.set(this.worldW / 2, 0, this.worldD / 2);
    this.fitToWorld(this.worldW, this.worldD);
  }

  /** setFromCamera assumes rays along the view axis; oblique rays run along the shear */
  setRay(raycaster: THREE.Raycaster, pointer: THREE.Vector2) {
    raycaster.setFromCamera(pointer, this.camera);
    if (this.mode === 'oblique') {
      raycaster.ray.direction
        .set(IsoScene.OBLIQUE_A, IsoScene.OBLIQUE_B, -1)
        .transformDirection(this.camera.matrixWorld);
    }
  }

  rotateBy(steps: number) {
    if (this.mode !== 'iso') return;
    this.targetAzimuth += (steps * Math.PI) / 4;
  }

  zoomBy(amount: number) {
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom * (1 + amount), 3, 30);
  }

  private resize() {
    const { clientWidth, clientHeight } = this.canvas;
    if (!clientWidth || !clientHeight) return;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.applyProjection();
  }

  private applyProjection() {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera.left = -this.zoom * aspect;
    this.camera.right = this.zoom * aspect;
    this.camera.top = this.zoom;
    this.camera.bottom = -this.zoom;
    this.camera.updateProjectionMatrix();
    if (this.mode === 'oblique') {
      // shift x/y by view-space depth, measured from the target so it stays centred
      const a = IsoScene.OBLIQUE_A, b = IsoScene.OBLIQUE_B, r = IsoScene.R;
      const shear = new THREE.Matrix4().set(1, 0, a, a * r, 0, 1, b, b * r, 0, 0, 1, 0, 0, 0, 0, 1);
      this.camera.projectionMatrix.multiply(shear);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    }
  }

  update() {
    this.azimuth += (this.targetAzimuth - this.azimuth) * 0.14;
    this.polar += (this.targetPolar - this.polar) * 0.14;
    if (Math.abs(this.targetZoom - this.zoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * 0.18;
      this.applyProjection();
    }
    const r = IsoScene.R;
    this.camera.position.set(
      this.target.x + r * Math.sin(this.polar) * Math.cos(this.azimuth),
      this.target.y + r * Math.cos(this.polar),
      this.target.z + r * Math.sin(this.polar) * Math.sin(this.azimuth),
    );
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  }
}
