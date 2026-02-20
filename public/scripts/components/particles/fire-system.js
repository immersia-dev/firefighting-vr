// Based on Bobby Roe's Simple Particle Effects
// Adapted for A-Frame with ceiling smoke spread

const _VS = `
precision mediump float;
uniform float pointMultiplier;

attribute float size;
attribute float angle;
attribute vec4 aColor;

varying vec4 vColor;
varying vec2 vAngle;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = size * pointMultiplier / gl_Position.w;
  vAngle = vec2(cos(angle), sin(angle));
  vColor = aColor;
}`;

const _FS = `
precision mediump float;
uniform sampler2D diffuseTexture;

varying vec4 vColor;
varying vec2 vAngle;

void main() {
  vec2 coords = (gl_PointCoord - 0.5) * mat2(vAngle.x, vAngle.y, -vAngle.y, vAngle.x) + 0.5;
  gl_FragColor = texture2D(diffuseTexture, coords) * vColor;
}`;

function getLinearSpline(lerp) {
  const points = [];
  const _lerp = lerp;

  function addPoint(t, d) {
    points.push([t, d]);
  }

  function getValueAt(t) {
    let p1 = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i][0] >= t) {
        break;
      }
      p1 = i;
    }
    const p2 = Math.min(points.length - 1, p1 + 1);
    if (p1 == p2) {
      return points[p1][1];
    }
    return _lerp(
      (t - points[p1][0]) / (points[p2][0] - points[p1][0]),
      points[p1][1],
      points[p2][1],
    );
  }
  return { addPoint, getValueAt };
}

AFRAME.registerComponent("fire-system", {
  schema: {
    fireRate: { type: "number", default: 75.0 },
    smokeRate: { type: "number", default: 35.0 },
    ceilingSmokeRate: { type: "number", default: 25.0 },
    fireTexture: { type: "string", default: "/assets/textures/fire.png" },
    smokeTexture: { type: "string", default: "/assets/textures/smoke.png" },
    radius: { type: "number", default: 0.4 },
    maxLife: { type: "number", default: 1.8 },
    maxSize: { type: "number", default: 4.0 },
    smokeMaxLife: { type: "number", default: 3.5 },
    smokeMaxSize: { type: "number", default: 6.0 },
    ceilingHeight: { type: "number", default: 5.5 },
    ceilingWidth: { type: "number", default: 10 },
    ceilingDepth: { type: "number", default: 8 },
    enableCeiling: { type: "boolean", default: true },
  },

  init() {
    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_PARTICLES) {
      window.debugLog("Fire", "Initializing fire system", this.data);
    }
    this.clock = new THREE.Clock();
    this.systems = [];
    this.fireIntensity = 1.0; // 1.0 = full fire, 0.0 = extinguished
    this.suppressionRate = 0.12; // Slightly faster suppression to keep pace
    this.recoveryRate = 0.02; // Slow recovery if foam stops (optional)

    // Fire system with dynamic intensity
    this.fireSystem = this._createParticleSystem({
      texture: this.data.fireTexture,
      rate: this.data.fireRate,
      radius: this.data.radius,
      maxLife: this.data.maxLife,
      maxSize: this.data.maxSize,
      velocity: new THREE.Vector3(0, 2.0, 0),
      colors: [
        [0.0, new THREE.Color(0xffffff)],
        [0.3, new THREE.Color(0xffff80)],
        [0.6, new THREE.Color(0xff8030)],
        [1.0, new THREE.Color(0xff3010)],
      ],
      suppressedColors: [
        [0.0, new THREE.Color(0xaaaaaa)],
        [0.3, new THREE.Color(0x888888)],
        [0.6, new THREE.Color(0x666666)],
        [1.0, new THREE.Color(0x444444)],
      ],
      blending: THREE.AdditiveBlending,
      isFire: true,
    });
    this.systems.push(this.fireSystem);

    // Rising smoke (lightens when being extinguished)
    this.smokeSystem = this._createParticleSystem({
      texture: this.data.smokeTexture,
      rate: this.data.smokeRate,
      radius: this.data.radius * 1.2,
      maxLife: this.data.smokeMaxLife,
      maxSize: this.data.smokeMaxSize,
      velocity: new THREE.Vector3(0, 1.2, 0),
      colors: [
        [0.0, new THREE.Color(0x444444)],
        [0.5, new THREE.Color(0x333333)],
        [1.0, new THREE.Color(0x222222)],
      ],
      suppressedColors: [
        [0.0, new THREE.Color(0x999999)],
        [0.5, new THREE.Color(0x888888)],
        [1.0, new THREE.Color(0x777777)],
      ],
      blending: THREE.NormalBlending,
      alphaPoints: [
        [0.0, 0.0],
        [0.2, 0.35],
        [0.8, 0.25],
        [1.0, 0.0],
      ],
      isSmoke: true,
    });
    this.systems.push(this.smokeSystem);

    // Ceiling smoke spread
    if (this.data.enableCeiling) {
      this.ceilingSystem = this._createParticleSystem({
        texture: this.data.smokeTexture,
        rate: this.data.ceilingSmokeRate,
        radius: this.data.radius,
        maxLife: 5.0,
        maxSize: this.data.smokeMaxSize * 1.3,
        velocity: new THREE.Vector3(0, 0.3, 0),
        colors: [
          [0.0, new THREE.Color(0x383838)],
          [0.5, new THREE.Color(0x2a2a2a)],
          [1.0, new THREE.Color(0x1a1a1a)],
        ],
        suppressedColors: [
          [0.0, new THREE.Color(0x888888)],
          [0.5, new THREE.Color(0x777777)],
          [1.0, new THREE.Color(0x666666)],
        ],
        blending: THREE.NormalBlending,
        alphaPoints: [
          [0.0, 0.0],
          [0.1, 0.5],
          [0.9, 0.3],
          [1.0, 0.0],
        ],
        isCeiling: true,
        isSmoke: true,
      });
      this.systems.push(this.ceilingSystem);
    }

    // Fire light — reduced distance and decay for Quest perf
    const light = new THREE.PointLight(0xff6600, 2.5, 4, 2);
    light.position.set(0, 0.8, 0);
    this.el.sceneEl.object3D.add(light);
    this.fireLight = light;
    this._flickerPhase = Math.random() * 100;

    // Reusable Vector3 objects for _addParticles (avoid GC pressure)
    this._emitterPos = new THREE.Vector3();
    this._tmpPosition = new THREE.Vector3();
    this._tmpVelocity = new THREE.Vector3();
    this._tmpDrag = new THREE.Vector3();
  },

  _createParticleSystem(config) {
    const {
      texture,
      rate,
      radius,
      maxLife,
      maxSize,
      velocity,
      colors,
      suppressedColors,
      blending,
      alphaPoints,
      isCeiling = false,
      isFire = false,
      isSmoke = false,
    } = config;

    const camera = this.el.sceneEl.camera;
    const uniforms = {
      diffuseTexture: {
        value: new THREE.TextureLoader().load(texture),
      },
      pointMultiplier: {
        value: window.innerHeight / (2.0 * Math.tan((30.0 * Math.PI) / 180.0)),
      },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: _VS,
      fragmentShader: _FS,
      blending: blending || THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
    });

    // Preallocate geometry buffers to avoid per-frame reallocations
    // Capacity ~= rate * maxLife * 1.5 (safe headroom)
    const capacity = Math.max(64, Math.ceil(rate * maxLife * 1.5));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(capacity * 3), 3),
    );
    geometry.setAttribute(
      "size",
      new THREE.BufferAttribute(new Float32Array(capacity), 1),
    );
    geometry.setAttribute(
      "aColor",
      new THREE.BufferAttribute(new Float32Array(capacity * 4), 4),
    );
    geometry.setAttribute(
      "angle",
      new THREE.BufferAttribute(new Float32Array(capacity), 1),
    );
    geometry.setDrawRange(0, 0);

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.el.sceneEl.object3D.add(points);

    // Splines
    const alphaSpline = getLinearSpline((t, a, b) => a + t * (b - a));
    if (alphaPoints) {
      alphaPoints.forEach(([t, v]) => alphaSpline.addPoint(t, v));
    } else {
      alphaSpline.addPoint(0.0, 0.0);
      alphaSpline.addPoint(0.2, 1.0);
      alphaSpline.addPoint(0.8, 0.8);
      alphaSpline.addPoint(1.0, 0.0);
    }

    const colorSpline = getLinearSpline((t, a, b) => {
      const c = a.clone();
      return c.lerp(b, t);
    });
    colors.forEach(([t, c]) => colorSpline.addPoint(t, c));

    // Suppressed color spline (gray when being extinguished)
    let suppressedColorSpline = null;
    if (suppressedColors) {
      suppressedColorSpline = getLinearSpline((t, a, b) => {
        const c = a.clone();
        return c.lerp(b, t);
      });
      suppressedColors.forEach(([t, c]) =>
        suppressedColorSpline.addPoint(t, c),
      );
    }

    const sizeSpline = getLinearSpline((t, a, b) => a + t * (b - a));
    sizeSpline.addPoint(0.0, 0.0);
    sizeSpline.addPoint(0.5, 1.0);
    sizeSpline.addPoint(1.0, 1.0);

    let accumulator = 0.0;

    return {
      points,
      particles: [],
      geometry,
      rate,
      radius,
      maxLife,
      maxSize,
      velocity,
      alphaSpline,
      colorSpline,
      suppressedColorSpline,
      sizeSpline,
      accumulator,
      camera,
      isCeiling,
      isFire,
      isSmoke,
      capacity,
      sortSkip: 0,
    };
  },

  tick(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);

    // Check for foam particles nearby and suppress fire
    this._checkFoamSuppression(dt);

    // Update each system with current fire intensity
    this.systems.forEach((sys) => {
      this._addParticles(sys, dt);
      this._updateParticles(sys, dt);
      this._updateGeometry(sys);
    });

    // Light flicker (scaled by intensity)
    const t = time / 1000;
    const base = 2.5 * this.fireIntensity;
    const flicker =
      0.85 +
      0.3 * Math.sin(t * 11.0 + this._flickerPhase) +
      0.15 * (Math.random() - 0.5);
    this.fireLight.intensity = base * flicker;
  },

  _checkFoamSuppression(dt) {
    // Find foam nozzle in scene
    const foamNozzle = document.querySelector("#foam-nozzle");
    if (!foamNozzle || !foamNozzle.components["foam-system"]) return;

    const foamComp = foamNozzle.components["foam-system"];
    if (!foamComp.emitting) return;

    const firePos = this.el.object3D.getWorldPosition(this._emitterPos);

    // Check if any foam particles are near the fire
    const foamParticles = foamComp.particles;
    let foamHitCount = 0;
    const hitRadius = 2.5; // Detection radius
    const hitRadiusSq = hitRadius * hitRadius; // avoid sqrt

    for (let i = 0; i < foamParticles.length; i++) {
      const fp = foamParticles[i];
      if (!fp.active) continue;

      const dist = fp.pos.distanceToSquared(firePos);
      if (dist < hitRadiusSq) {
        foamHitCount++;
      }
    }

    // Suppress fire based on foam contact
    if (foamHitCount > 5) {
      const prevIntensity = this.fireIntensity;
      this.fireIntensity = Math.max(
        0,
        this.fireIntensity - this.suppressionRate * dt,
      );
      if (
        window.DEBUG_CONFIG &&
        window.DEBUG_CONFIG.LOG_PARTICLES &&
        prevIntensity > 0.1 &&
        this.fireIntensity <= 0.1
      ) {
        window.debugLog(
          "Fire",
          "Fire nearly extinguished!",
          this.fireIntensity.toFixed(2),
        );
      }
    } else {
      // Optional: slight recovery if no foam (commented out for now)
      // this.fireIntensity = Math.min(1.0, this.fireIntensity + this.recoveryRate * dt);
    }
  },

  _addParticles(sys, timeElapsed) {
    // Scale particle generation by fire intensity
    let rateFactor = 1.0;
    if (sys.isFire) {
      rateFactor = this.fireIntensity;
    } else if (sys.isSmoke) {
      // Smoke fades out as fireIntensity drops; stop entirely when very low
      rateFactor = Math.max(0, this.fireIntensity - 0.15);
    }

    const effectiveRate = sys.rate * rateFactor;
    if (effectiveRate <= 0) {
      sys.accumulator = 0;
      return;
    }

    sys.accumulator += timeElapsed;
    const n = Math.floor(sys.accumulator * effectiveRate);
    sys.accumulator -= n / effectiveRate;

    const emitterPos = this.el.object3D.getWorldPosition(this._emitterPos);

    for (let i = 0; i < n; i++) {
      if (sys.particles.length >= sys.capacity) break; // avoid growth beyond buffers
      const life = (Math.random() * 0.75 + 0.25) * sys.maxLife;

      let position, vel;
      if (sys.isCeiling) {
        // Spawn at ceiling level in spread area
        position = new THREE.Vector3(
          emitterPos.x + (Math.random() - 0.5) * this.data.ceilingWidth,
          this.data.ceilingHeight - 0.1,
          emitterPos.z + (Math.random() - 0.5) * this.data.ceilingDepth,
        );
        vel = new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          -0.05,
          (Math.random() - 0.5) * 0.8,
        );
      } else {
        position = new THREE.Vector3(
          (Math.random() * 2 - 1) * sys.radius,
          (Math.random() * 2 - 1) * sys.radius * 0.3,
          (Math.random() * 2 - 1) * sys.radius,
        ).add(emitterPos);
        vel = this._tmpVelocity.copy(sys.velocity);
        vel.x += (Math.random() - 0.5) * 0.5;
        vel.y += Math.random() * 0.5;
        vel.z += (Math.random() - 0.5) * 0.5;
        vel = vel.clone();
      }

      sys.particles.push({
        position: position,
        size: (Math.random() * 0.5 + 0.5) * sys.maxSize,
        colour: new THREE.Color(),
        alpha: 1.0,
        life: life,
        maxLife: life,
        rotation: Math.random() * 2.0 * Math.PI,
        rotationRate: (Math.random() - 0.5) * 0.02,
        velocity: vel,
        isCeiling: sys.isCeiling,
      });
    }
  },

  _updateParticles(sys, timeElapsed) {
    for (let p of sys.particles) {
      p.life -= timeElapsed;
    }

    sys.particles = sys.particles.filter((p) => p.life > 0.0);

    for (let p of sys.particles) {
      const t = 1.0 - p.life / p.maxLife;
      p.rotation += p.rotationRate;
      p.alpha = sys.alphaSpline.getValueAt(t);
      p.currentSize = p.size * sys.sizeSpline.getValueAt(t);

      // Lerp between normal and suppressed colors based on fire intensity (applies to fire and smoke)
      if (sys.suppressedColorSpline) {
        const normalColor = sys.colorSpline.getValueAt(t);
        const suppressedColor = sys.suppressedColorSpline.getValueAt(t);
        const factor = 1.0 - this.fireIntensity; // more suppression => lighter/gray
        p.colour.copy(normalColor).lerp(suppressedColor, factor);
      } else {
        p.colour.copy(sys.colorSpline.getValueAt(t));
      }

      p.position.add(p.velocity.clone().multiplyScalar(timeElapsed));

      // Ceiling smoke spread behavior
      if (p.isCeiling) {
        // Horizontal drift with boundaries
        p.velocity.x += (Math.random() - 0.5) * 0.25 * timeElapsed;
        p.velocity.z += (Math.random() - 0.5) * 0.25 * timeElapsed;

        const emitterPos = this.el.object3D.getWorldPosition(
          new THREE.Vector3(),
        );
        const halfWidth = this.data.ceilingWidth * 0.5;
        const halfDepth = this.data.ceilingDepth * 0.5;

        if (Math.abs(p.position.x - emitterPos.x) > halfWidth) {
          p.velocity.x *= -0.5;
        }
        if (Math.abs(p.position.z - emitterPos.z) > halfDepth) {
          p.velocity.z *= -0.5;
        }

        // Keep near ceiling
        if (p.position.y < this.data.ceilingHeight - 0.3) {
          p.velocity.y += 0.1 * timeElapsed;
        }
      } else {
        // Standard drag for fire/smoke — reuse _tmpDrag to avoid alloc
        const drag = this._tmpDrag.copy(p.velocity);
        drag.multiplyScalar(timeElapsed * 0.1);
        drag.x =
          Math.sign(p.velocity.x) *
          Math.min(Math.abs(drag.x), Math.abs(p.velocity.x));
        drag.y =
          Math.sign(p.velocity.y) *
          Math.min(Math.abs(drag.y), Math.abs(p.velocity.y));
        drag.z =
          Math.sign(p.velocity.z) *
          Math.min(Math.abs(drag.z), Math.abs(p.velocity.z));
        p.velocity.sub(drag);
      }
    }

    // Sort by distance for proper alpha blending —
    // skip most frames to reduce CPU cost
    if (sys.sortSkip-- <= 0) {
      sys.particles.sort((a, b) => {
        const d1 = sys.camera.position.distanceTo(a.position);
        const d2 = sys.camera.position.distanceTo(b.position);
        return d2 - d1;
      });
      sys.sortSkip = 5; // sort every ~6th frame
    }
  },

  _updateGeometry(sys) {
    const posArr = sys.geometry.attributes.position.array;
    const sizeArr = sys.geometry.attributes.size.array;
    const colArr = sys.geometry.attributes.aColor.array;
    const angArr = sys.geometry.attributes.angle.array;

    let drawCount = Math.min(sys.particles.length, sys.capacity);
    for (let i = 0; i < drawCount; i++) {
      const p = sys.particles[i];
      const base3 = i * 3;
      const base4 = i * 4;
      posArr[base3] = p.position.x;
      posArr[base3 + 1] = p.position.y;
      posArr[base3 + 2] = p.position.z;
      sizeArr[i] = p.currentSize;
      colArr[base4] = p.colour.r;
      colArr[base4 + 1] = p.colour.g;
      colArr[base4 + 2] = p.colour.b;
      colArr[base4 + 3] = p.alpha;
      angArr[i] = p.rotation;
    }

    sys.geometry.setDrawRange(0, drawCount);
    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.size.needsUpdate = true;
    sys.geometry.attributes.aColor.needsUpdate = true;
    sys.geometry.attributes.angle.needsUpdate = true;
  },

  remove() {
    this.systems.forEach((sys) => {
      if (sys.points) {
        this.el.sceneEl.object3D.remove(sys.points);
        sys.geometry.dispose();
        sys.points.material.dispose();
      }
    });
    if (this.fireLight) {
      this.el.sceneEl.object3D.remove(this.fireLight);
    }
  },
});
