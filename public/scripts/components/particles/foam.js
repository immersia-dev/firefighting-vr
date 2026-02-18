/**
 * Foam Particle System Component
 *
 * GPU-accelerated foam spray using custom GLSL shaders.
 * Can be attached to any entity — sprays along local -Z axis.
 *
 * API:
 *   component.start()  — begin emitting particles
 *   component.stop()   — stop emitting (existing particles finish)
 *
 * HTML attribute names match schema 1:1:
 *   foam="texture: #foam-texture; rate: 60; maxParticles: 300; speed: 6; particleSize: 0.08"
 */

AFRAME.registerComponent("foam", {
  schema: {
    autoStart: { type: "boolean", default: false },
    rate: { type: "number", default: 250 },
    maxParticles: { type: "int", default: 500 },
    jetLength: { type: "number", default: 4.0 },
    jetRadius: { type: "number", default: 0.12 },
    speed: { type: "number", default: 8.0 },
    spread: { type: "number", default: 0.08 },
    life: { type: "number", default: 0.8 },
    particleSize: { type: "number", default: 0.15 },
    gravity: { type: "number", default: -5.0 },
    drag: { type: "number", default: 2.5 },
    texture: { type: "string", default: "" },
  },

  init() {
    this.emitting = this.data.autoStart;
    const cap = this.data.maxParticles;

    this.particles = new Array(cap).fill(null).map(() => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      size: 0,
      angle: 0,
    }));
    this.activeCount = 0;
    this._spawnAcc = 0;

    // Geometry
    const positions = new Float32Array(cap * 3);
    const sizes = new Float32Array(cap);
    const alphas = new Float32Array(cap);
    const angles = new Float32Array(cap);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
    this.geometry.setAttribute("angle", new THREE.BufferAttribute(angles, 1));
    this.geometry.setDrawRange(0, 0);

    const mat = this._makeMaterial();
    this.points = new THREE.Points(this.geometry, mat);
    this.points.frustumCulled = false;
    this.el.sceneEl.object3D.add(this.points);

    this._tmpQuat = new THREE.Quaternion();
    this._tmpForward = new THREE.Vector3();
  },

  remove() {
    if (this.points) {
      this.el.sceneEl.object3D.remove(this.points);
      this.points.material.dispose();
      this.geometry.dispose();
    }
  },

  start() {
    this.emitting = true;
  },

  stop() {
    this.emitting = false;
  },

  tick(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.emitting) {
      this._spawn(dt);
    }
    this._simulate(dt);
    this._updateGeometry();
  },

  _spawn(dt) {
    this._spawnAcc += this.data.rate * dt;
    const count = Math.floor(this._spawnAcc);
    if (!count) return;
    this._spawnAcc -= count;

    const origin = new THREE.Vector3();
    this.el.object3D.getWorldPosition(origin);
    this.el.object3D.getWorldQuaternion(this._tmpQuat);

    for (let i = 0; i < count; i++) {
      const slot = this._getSlot();
      if (!slot) break;

      // Spawn in a larger cylinder (jet nozzle area)
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * this.data.jetRadius;
      const offset = new THREE.Vector3(
        Math.cos(angle) * r,
        0,
        Math.sin(angle) * r,
      ).applyQuaternion(this._tmpQuat);

      slot.pos.copy(origin).add(offset);

      // Forward velocity with increasing spread for dispersion effect
      this._tmpForward.set(0, 0, -1).applyQuaternion(this._tmpQuat);
      const spreadX = (Math.random() - 0.5) * this.data.spread * 1.5;
      const spreadY = (Math.random() - 0.5) * this.data.spread * 1.5;

      slot.vel.copy(this._tmpForward).multiplyScalar(this.data.speed);
      slot.vel.x += spreadX;
      slot.vel.z += spreadY;

      slot.life = this.data.life * (0.8 + Math.random() * 0.4);
      slot.maxLife = slot.life;
      slot.size = this.data.particleSize * (0.7 + Math.random() * 0.6);
      slot.angle = Math.random() * Math.PI * 2;
      slot.active = true;
      this.activeCount++;
    }
  },

  _simulate(dt) {
    const g = this.data.gravity;
    const drag = this.data.drag;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.activeCount--;
        continue;
      }

      p.vel.y += g * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - drag * dt));
      p.pos.addScaledVector(p.vel, dt);
    }
  },

  _updateGeometry() {
    const posArr = this.geometry.attributes.position.array;
    const sizeArr = this.geometry.attributes.size.array;
    const alphaArr = this.geometry.attributes.alpha.array;
    const angleArr = this.geometry.attributes.angle.array;

    let drawCount = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      const idx = drawCount;
      posArr[idx * 3] = p.pos.x;
      posArr[idx * 3 + 1] = p.pos.y;
      posArr[idx * 3 + 2] = p.pos.z;

      const age = 1 - p.life / p.maxLife;
      let alpha = 1.0;
      if (age < 0.15) {
        alpha = age / 0.15;
      } else if (age > 0.75) {
        alpha = 1 - (age - 0.75) / 0.25;
      }

      sizeArr[idx] = p.size;
      alphaArr[idx] = Math.max(0, Math.min(1, alpha));
      angleArr[idx] = p.angle;

      drawCount++;
    }

    this.geometry.setDrawRange(0, drawCount);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
    this.geometry.attributes.angle.needsUpdate = true;
  },

  _getSlot() {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) return this.particles[i];
    }
    return null;
  },

  _makeMaterial() {
    let tex;
    if (this.data.texture) {
      // Support both "#id" asset references and direct URLs
      const ref = this.data.texture;
      const assetEl = ref.startsWith("#") ? document.querySelector(ref) : null;
      const src = assetEl ? assetEl.getAttribute("src") || assetEl.src : ref;
      tex = new THREE.TextureLoader().load(src);
    } else {
      tex = this._makeTexture();
    }

    const uniforms = {
      diffuseTexture: { value: tex },
      pointMultiplier: {
        value: window.innerHeight / (2.0 * Math.tan((30.0 * Math.PI) / 180.0)),
      },
    };

    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        uniform float pointMultiplier;
        attribute float size;
        attribute float alpha;
        attribute float angle;
        varying float vAlpha;
        varying float vAngle;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = size * pointMultiplier / gl_Position.w;
          vAlpha = alpha;
          vAngle = angle;
        }
      `,
      fragmentShader: `
        uniform sampler2D diffuseTexture;
        varying float vAlpha;
        varying float vAngle;
        void main() {
          // Rotate point sprite UV to break repetition
          vec2 centered = gl_PointCoord - 0.5;
          float c = cos(vAngle);
          float s = sin(vAngle);
          vec2 rotated = vec2(
            centered.x * c - centered.y * s,
            centered.x * s + centered.y * c
          ) + 0.5;
          
          vec4 tex = texture2D(diffuseTexture, rotated);
          
          // Soft radial fade from center
          float dist = length(gl_PointCoord - 0.5);
          float radialFade = smoothstep(0.5, 0.25, dist);
          
          // Combine alpha sources
          float a = tex.a * vAlpha * radialFade;
          if (a < 0.03) discard;
          
          // Slight brightness boost
          vec3 color = tex.rgb * 1.08;
          gl_FragColor = vec4(color, a * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });
  },

  _makeTexture() {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");

    const grd = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.05,
      size / 2,
      size / 2,
      size * 0.45,
    );
    grd.addColorStop(0.0, "rgba(255,255,255,1.0)");
    grd.addColorStop(0.4, "rgba(250,250,255,0.7)");
    grd.addColorStop(1.0, "rgba(255,255,255,0.0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(c);
  },
});
