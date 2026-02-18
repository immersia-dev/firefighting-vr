/**
 * Foam Particle System Component — State-of-the-Art
 *
 * Dense volumetric foam spray simulating a real fire extinguisher.
 *
 * Key features:
 *   - Two-phase simulation: airborne jet → ground accumulation
 *   - Floor collision with momentum-based horizontal spread
 *   - Turbulence perturbation for organic, cloud-like motion
 *   - Non-linear size curve (smoothstep) for natural cone expansion
 *   - Late-life lateral spread for wider cloud at distance
 *   - Ground puddle growth with slow fade
 *   - Procedural cloud texture with rotation
 *
 * References:
 *   - GPU Gems 3 Ch.23 (particle fluid surfaces)
 *   - "Real-Time Particle Systems" (Latta, GDC 2004)
 *   - Unreal Niagara / Unity VFX Graph cone emitter patterns
 *
 * API:
 *   component.start()  — begin emitting particles
 *   component.stop()   — stop emitting (existing particles finish)
 */

AFRAME.registerComponent("foam-system", {
  schema: {
    autoStart:    { type: "boolean", default: false },
    rate:         { type: "number",  default: 300 },
    maxParticles: { type: "int",     default: 1500 },
    speed:        { type: "number",  default: 8.0 },
    coneAngle:    { type: "number",  default: 6 },        // degrees
    life:         { type: "number",  default: 2.5 },       // seconds (longer for ground phase)
    sizeStart:    { type: "number",  default: 0.03 },
    sizeEnd:      { type: "number",  default: 0.8 },
    gravity:      { type: "number",  default: -4.0 },      // m/s² — stronger pull toward floor
    drag:         { type: "number",  default: 1.2 },       // air drag coefficient
    opacity:      { type: "number",  default: 0.65 },
    texture:      { type: "string",  default: "" },
    // Floor collision & ground spread
    floorY:         { type: "number", default: 0.0 },      // world Y of the ground plane
    groundSpread:   { type: "number", default: 2.0 },      // impact energy → horizontal velocity
    groundDrag:     { type: "number", default: 6.0 },      // high drag once settled
    groundBounce:   { type: "number", default: 0.03 },     // coefficient of restitution
    groundSizeScale:{ type: "number", default: 1.5 },      // extra size multiplier for puddle
    // Organic motion
    turbulence:   { type: "number", default: 0.8 },        // random velocity perturbation
    spreadGrowth: { type: "number", default: 1.5 },        // late-life lateral spread
  },

  init() {
    this.emitting = this.data.autoStart;
    const cap = this.data.maxParticles;

    /* ── Particle pool ── */
    this.particles = new Array(cap).fill(null).map(() => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      sizeStart: 0,
      sizeEnd: 0,
      angle: 0,
      spin: 0,
      grounded: false,   // has collided with floor
      groundTime: 0,     // seconds spent on ground
    }));
    this.activeCount = 0;
    this._spawnAcc = 0;

    /* ── GPU geometry — interleaved attributes ── */
    const positions = new Float32Array(cap * 3);
    const sizes     = new Float32Array(cap);
    const alphas    = new Float32Array(cap);
    const angles    = new Float32Array(cap);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("size",     new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("alpha",    new THREE.BufferAttribute(alphas, 1));
    this.geometry.setAttribute("angle",    new THREE.BufferAttribute(angles, 1));
    this.geometry.setDrawRange(0, 0);

    const mat = this._makeMaterial();
    this.points = new THREE.Points(this.geometry, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.el.sceneEl.object3D.add(this.points);

    /* ── Reusable math objects ── */
    this._tmpQuat    = new THREE.Quaternion();
    this._tmpForward = new THREE.Vector3();
    this._right      = new THREE.Vector3();
    this._localUp    = new THREE.Vector3();
    this._up         = new THREE.Vector3();
  },

  remove() {
    if (this.points) {
      this.el.sceneEl.object3D.remove(this.points);
      this.points.material.dispose();
      this.geometry.dispose();
    }
  },

  start() { this.emitting = true;  },
  stop()  { this.emitting = false; },

  tick(time, delta) {
    const dt = Math.min(delta / 1000, 0.05); // clamp for tab-away
    if (this.emitting) this._spawn(dt);
    this._simulate(dt);
    this._updateGeometry();
  },

  /* ═══════════════════════════════════════════════════
     Spawn — cone emitter at nozzle origin
     ═══════════════════════════════════════════════════ */
  _spawn(dt) {
    this._spawnAcc += this.data.rate * dt;
    const count = Math.floor(this._spawnAcc);
    if (!count) return;
    this._spawnAcc -= count;

    const origin = new THREE.Vector3();
    this.el.object3D.getWorldPosition(origin);
    this.el.object3D.getWorldQuaternion(this._tmpQuat);

    // Forward = controller -Z (same as raycaster)
    this._tmpForward.set(0, 0, -1).applyQuaternion(this._tmpQuat);

    // Build orthonormal basis for cone spread
    this._up.set(0, 1, 0);
    if (Math.abs(this._tmpForward.dot(this._up)) > 0.99) this._up.set(1, 0, 0);
    this._right.crossVectors(this._tmpForward, this._up).normalize();
    this._localUp.crossVectors(this._right, this._tmpForward).normalize();

    const coneRad = (this.data.coneAngle * Math.PI) / 180;

    for (let i = 0; i < count; i++) {
      const slot = this._getSlot();
      if (!slot) break;

      // Tight nozzle spawn radius
      const nozzleR = 0.01 * Math.random();
      const nozzleA = Math.random() * Math.PI * 2;
      slot.pos.copy(origin);
      slot.pos.addScaledVector(this._right,   Math.cos(nozzleA) * nozzleR);
      slot.pos.addScaledVector(this._localUp,  Math.sin(nozzleA) * nozzleR);

      // Cone-shaped velocity via spherical coordinates
      const phi   = Math.random() * Math.PI * 2;
      const theta = Math.random() * coneRad;
      const sinT  = Math.sin(theta);

      slot.vel
        .copy(this._tmpForward)
        .multiplyScalar(Math.cos(theta))
        .addScaledVector(this._right,   sinT * Math.cos(phi))
        .addScaledVector(this._localUp, sinT * Math.sin(phi))
        .normalize()
        .multiplyScalar(this.data.speed * (0.9 + Math.random() * 0.2));

      slot.life      = this.data.life * (0.85 + Math.random() * 0.3);
      slot.maxLife   = slot.life;
      slot.sizeStart = this.data.sizeStart * (0.8 + Math.random() * 0.4);
      slot.sizeEnd   = this.data.sizeEnd   * (0.8 + Math.random() * 0.4);
      slot.angle     = Math.random() * Math.PI * 2;
      slot.spin      = (Math.random() - 0.5) * 2.0; // rad/s
      slot.grounded  = false;
      slot.groundTime = 0;
      slot.active    = true;
      this.activeCount++;
    }
  },

  /* ═══════════════════════════════════════════════════
     Simulate — two-phase: airborne → grounded
     ═══════════════════════════════════════════════════ */
  _simulate(dt) {
    const { gravity: g, drag, floorY, groundSpread, groundDrag,
            groundBounce, turbulence, spreadGrowth } = this.data;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.activeCount--;
        continue;
      }

      const age = 1 - p.life / p.maxLife; // 0 → 1

      if (p.grounded) {
        /* ── Ground phase ──
           High drag, no gravity, foam spreads and settles. */
        p.groundTime += dt;
        p.vel.y = 0;
        const gDamp = Math.max(0, 1 - groundDrag * dt);
        p.vel.x *= gDamp;
        p.vel.z *= gDamp;
        p.pos.addScaledVector(p.vel, dt);
        p.pos.y = floorY + 0.005; // avoid z-fighting

      } else {
        /* ── Airborne phase ──
           Full physics: gravity, drag, turbulence, late spread. */

        // Gravity
        p.vel.y += g * dt;

        // Aerodynamic drag (velocity-proportional)
        const damp = Math.max(0, 1 - drag * dt);
        p.vel.multiplyScalar(damp);

        // Turbulence — cheap per-particle random perturbation
        // Approximates curl-noise without the cost (good enough for VR 72fps)
        if (turbulence > 0) {
          const t = turbulence * dt;
          p.vel.x += (Math.random() - 0.5) * t * 2;
          p.vel.y += (Math.random() - 0.5) * t;      // half-strength vertical
          p.vel.z += (Math.random() - 0.5) * t * 2;
        }

        // Late-life lateral spread — cloud widens at distance
        if (spreadGrowth > 0 && age > 0.25) {
          const spreadForce = spreadGrowth * (age - 0.25) * dt;
          p.vel.x += (Math.random() - 0.5) * spreadForce * 2;
          p.vel.z += (Math.random() - 0.5) * spreadForce * 2;
        }

        // Integrate position
        p.pos.addScaledVector(p.vel, dt);

        /* ── Floor collision ──
           Convert downward momentum into horizontal spread.
           Based on inelastic collision model with tangential restitution. */
        if (p.pos.y <= floorY) {
          p.pos.y = floorY + 0.005;
          p.grounded = true;

          // Momentum transfer: vertical impact → radial spread
          const impactSpeed = Math.abs(p.vel.y);
          const spreadSpeed = impactSpeed * groundSpread * 0.3;
          const spreadAngle = Math.random() * Math.PI * 2;
          p.vel.x += Math.cos(spreadAngle) * spreadSpeed;
          p.vel.z += Math.sin(spreadAngle) * spreadSpeed;

          // Tiny bounce (mostly inelastic — foam doesn't bounce much)
          p.vel.y = impactSpeed * groundBounce;
        }
      }

      // Rotation (decelerating spin for natural settling)
      p.angle += p.spin * dt;
      p.spin *= (1 - 0.5 * dt);
    }
  },

  /* ═══════════════════════════════════════════════════
     Geometry update — write active particles to GPU
     ═══════════════════════════════════════════════════ */
  _updateGeometry() {
    const posArr   = this.geometry.attributes.position.array;
    const sizeArr  = this.geometry.attributes.size.array;
    const alphaArr = this.geometry.attributes.alpha.array;
    const angleArr = this.geometry.attributes.angle.array;
    const { opacity: baseOpacity, groundSizeScale } = this.data;

    let drawCount = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      const idx = drawCount;
      posArr[idx * 3]     = p.pos.x;
      posArr[idx * 3 + 1] = p.pos.y;
      posArr[idx * 3 + 2] = p.pos.z;

      const age = 1 - p.life / p.maxLife; // 0 → 1

      /* ── Size: smoothstep curve ──
         Hermite interpolation: slow start → fast middle → gentle end.
         This creates a more natural cone than linear growth.
         s(t) = t² (3 − 2t)  */
      const t = age * age * (3 - 2 * age);
      let size = p.sizeStart + (p.sizeEnd - p.sizeStart) * t;

      // Ground puddle: particles grow even larger as they settle
      if (p.grounded) {
        const groundAge = Math.min(p.groundTime * 2, 1); // 0→1 over 0.5s
        size *= 1 + (groundSizeScale - 1) * groundAge;
      }
      sizeArr[idx] = size;

      /* ── Alpha curve ──
         Airborne: fast fade-in (3%), full hold, gradual fade-out after 60%.
         Grounded: slower fade tied to remaining life — lingers on floor.  */
      let alpha = baseOpacity;
      if (age < 0.03) {
        alpha *= age / 0.03;                            // fade in
      } else if (p.grounded) {
        // Ground foam: fade based on remaining normalised life
        const remaining = p.life / p.maxLife;
        alpha *= Math.min(1, remaining * 2.5);          // soft fade
        alpha *= 0.85;                                  // slightly transparent on ground
      } else if (age > 0.6) {
        alpha *= 1 - (age - 0.6) / 0.4;                // airborne fade-out
      }
      alphaArr[idx] = Math.max(0, Math.min(1, alpha));

      angleArr[idx] = p.angle;
      drawCount++;
    }

    this.geometry.setDrawRange(0, drawCount);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate     = true;
    this.geometry.attributes.alpha.needsUpdate    = true;
    this.geometry.attributes.angle.needsUpdate    = true;
  },

  _getSlot() {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) return this.particles[i];
    }
    return null;
  },

  /* ═══════════════════════════════════════════════════
     Material — custom point-sprite shader
     ═══════════════════════════════════════════════════ */
  _makeMaterial() {
    let tex;
    if (this.data.texture) {
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
          // Rotate point-sprite UV to break repetition
          vec2 centered = gl_PointCoord - 0.5;
          float c = cos(vAngle);
          float s = sin(vAngle);
          vec2 rotated = vec2(
            centered.x * c - centered.y * s,
            centered.x * s + centered.y * c
          ) + 0.5;

          vec4 tex = texture2D(diffuseTexture, rotated);

          // Soft radial fade — wide soft edge for cloud appearance
          float dist = length(gl_PointCoord - 0.5);
          float radialFade = smoothstep(0.5, 0.12, dist);

          float a = tex.a * vAlpha * radialFade;
          if (a < 0.01) discard;

          // Bright white foam with slight tint from texture
          vec3 color = mix(tex.rgb, vec3(1.0), 0.35);
          gl_FragColor = vec4(color, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });
  },

  /* ═══════════════════════════════════════════════════
     Procedural cloud texture (256×256 canvas)
     Multiple offset radial gradients → irregular puff
     ═══════════════════════════════════════════════════ */
  _makeTexture() {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const half = size / 2;

    ctx.globalCompositeOperation = "source-over";

    const puffs = [
      { x: half * 0.88, y: half * 0.88, r: half * 0.46 },
      { x: half * 1.12, y: half * 0.84, r: half * 0.41 },
      { x: half * 0.84, y: half * 1.14, r: half * 0.39 },
      { x: half * 1.06, y: half * 1.12, r: half * 0.43 },
      { x: half * 0.97, y: half * 1.0,  r: half * 0.52 },
      { x: half,        y: half,        r: half * 0.50 },
    ];

    for (const p of puffs) {
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grd.addColorStop(0.0, "rgba(255,255,255,0.60)");
      grd.addColorStop(0.3, "rgba(252,252,255,0.40)");
      grd.addColorStop(0.6, "rgba(245,245,252,0.15)");
      grd.addColorStop(1.0, "rgba(255,255,255,0.00)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);
    }

    return new THREE.CanvasTexture(c);
  },
});
