AFRAME.registerComponent("optimized-fire", {
  schema: {
    flameWidth: { type: "number", default: 0.6 },
    flameHeight: { type: "number", default: 1.2 },
    intensity: { type: "number", default: 1.0 },
    smokeCount: { type: "int", default: 18 },
    smokeColor: { type: "color", default: "#3a3a3a" },
    smokeOpacity: { type: "number", default: 0.35 },
    smokeSpread: { type: "number", default: 0.35 },
    smokeRise: { type: "number", default: 0.7 },
    lightFlicker: { type: "boolean", default: true },
    enableCeiling: { type: "boolean", default: true },
    ceilingHeight: { type: "number", default: 5.5 },
    ceilingWidth: { type: "number", default: 6.0 },
    ceilingDepth: { type: "number", default: 6.0 },
    ceilingDrift: { type: "number", default: 0.35 },
  },

  init() {
    const el = this.el;
    const data = this.data;
    this.group = new THREE.Group();
    el.setObject3D("optimized-fire", this.group);

    // Create flame (two crossed planes with shader)
    const flameMat = this._createFlameMaterial(data.intensity);
    const planeGeo = new THREE.PlaneGeometry(data.flameWidth, data.flameHeight);
    const planeA = new THREE.Mesh(planeGeo, flameMat);
    const planeB = new THREE.Mesh(planeGeo, flameMat.clone());
    planeA.position.y = data.flameHeight * 0.5;
    planeB.position.y = data.flameHeight * 0.5;
    planeB.rotation.y = Math.PI / 2;
    planeA.renderOrder = 2;
    planeB.renderOrder = 2;
    planeA.material.depthWrite = false;
    planeB.material.depthWrite = false;
    planeA.frustumCulled = false;
    planeB.frustumCulled = false;
    this.group.add(planeA);
    this.group.add(planeB);

    // Smoke planes (simple billboards)
    this.smokes = [];
    const smokeTex = this._createSmokeTexture();
    const smokeMat = new THREE.MeshBasicMaterial({
      map: smokeTex,
      transparent: true,
      color: new THREE.Color(data.smokeColor),
      opacity: data.smokeOpacity,
      depthWrite: false,
    });
    const smokeGeo = new THREE.PlaneGeometry(0.55, 0.55);
    for (let i = 0; i < data.smokeCount; i++) {
      const m = new THREE.Mesh(smokeGeo, smokeMat.clone());
      m.position.set(
        (Math.random() - 0.5) * data.smokeSpread,
        0.6 + Math.random() * 0.2,
        (Math.random() - 0.5) * data.smokeSpread
      );
      m.rotation.y = Math.random() * Math.PI * 2;
      m.material.opacity = data.smokeOpacity * (0.6 + Math.random() * 0.4);
      m.userData = {
        baseX: m.position.x,
        baseZ: m.position.z,
        life: Math.random(),
        speed: 0.6 + Math.random() * 0.5,
        scale: 0.6 + Math.random() * 0.6,
        state: "rise",
      };
      m.scale.setScalar(m.userData.scale);
      m.renderOrder = 1;
      m.frustumCulled = false;
      this.group.add(m);
      this.smokes.push(m);
    }

    // Optional point light flicker
    if (data.lightFlicker) {
      const light = new THREE.PointLight(0xff6600, 1.6 * data.intensity, 4, 2);
      light.position.set(0, 0.7, 0);
      this.group.add(light);
      this.fireLight = light;
      this._flickerPhase = Math.random() * 1000;
    }

    this.clock = new THREE.Clock();
  },

  tick(time, delta) {
    const dt = delta / 1000;
    const t = time / 1000;

    // Update flame shader time
    this.group.traverse((obj) => {
      if (
        obj.material &&
        obj.material.uniforms &&
        obj.material.uniforms.uTime
      ) {
        obj.material.uniforms.uTime.value = t;
      }
    });

    // Update smoke rise, drift, scale, and fade; spread under ceiling if enabled
    const d = this.data;
    for (let i = 0; i < this.smokes.length; i++) {
      const s = this.smokes[i];
      const u = s.userData;
      u.life += dt * 0.25;

      if (u.state === "rise") {
        // Upward movement from the fire source
        s.position.y += dt * d.smokeRise * u.speed;
        s.position.x = u.baseX + Math.sin((u.life + i * 0.13) * 2.0) * 0.08;
        s.position.z = u.baseZ + Math.cos((u.life + i * 0.17) * 1.8) * 0.08;
        s.material.opacity = d.smokeOpacity * (1.0 - u.life) * 0.9;

        // Switch to ceiling spread when reaching height
        if (d.enableCeiling && s.position.y >= d.ceilingHeight) {
          u.state = "ceiling";
          u.life = 0.0;
          u.baseX = (Math.random() - 0.5) * d.ceilingWidth;
          u.baseZ = (Math.random() - 0.5) * d.ceilingDepth;
          s.position.set(u.baseX, d.ceilingHeight - 0.02, u.baseZ);
          s.scale.setScalar(u.scale * 1.2);
          s.material.opacity = d.smokeOpacity * 0.9;
        }

        // Reset if life completes before hitting ceiling
        if (u.life > 1.0 && u.state === "rise") {
          u.life = 0;
          s.position.y = 0.6 + Math.random() * 0.2;
          s.position.x = (Math.random() - 0.5) * d.smokeSpread;
          s.position.z = (Math.random() - 0.5) * d.smokeSpread;
          u.baseX = s.position.x;
          u.baseZ = s.position.z;
          u.speed = 0.6 + Math.random() * 0.5;
          u.scale = 0.6 + Math.random() * 0.6;
          s.scale.setScalar(u.scale);
        }
      } else {
        // Ceiling spread: horizontal drift below the roof
        u.life += dt * 0.12; // slower lifecycle under ceiling
        const clampX = THREE.MathUtils.clamp(
          u.baseX + Math.sin(u.life * 2.0 + i * 0.31) * d.ceilingDrift,
          -d.ceilingWidth * 0.5,
          d.ceilingWidth * 0.5
        );
        const clampZ = THREE.MathUtils.clamp(
          u.baseZ + Math.cos(u.life * 1.7 + i * 0.27) * d.ceilingDrift,
          -d.ceilingDepth * 0.5,
          d.ceilingDepth * 0.5
        );
        s.position.x = clampX;
        s.position.z = clampZ;
        s.position.y =
          d.ceilingHeight - 0.02 + 0.02 * Math.sin((u.life + i) * 3.0);
        s.material.opacity = d.smokeOpacity * (1.0 - u.life) * 0.8;

        if (u.life > 1.0) {
          // Reset back to rising smoke
          u.state = "rise";
          u.life = 0;
          s.position.y = 0.6 + Math.random() * 0.2;
          s.position.x = (Math.random() - 0.5) * d.smokeSpread;
          s.position.z = (Math.random() - 0.5) * d.smokeSpread;
          u.baseX = s.position.x;
          u.baseZ = s.position.z;
          u.speed = 0.6 + Math.random() * 0.5;
          u.scale = 0.6 + Math.random() * 0.6;
          s.scale.setScalar(u.scale);
        }
      }
      s.lookAt(this.el.sceneEl.camera.el.object3D.position);
    }

    // Light flicker
    if (this.fireLight) {
      const base = 1.4 * this.data.intensity;
      const flicker =
        0.6 +
        0.5 * Math.sin(t * 12.0 + this._flickerPhase) +
        0.2 * (Math.random() - 0.5);
      this.fireLight.intensity = Math.max(0.8, base * flicker);
    }
  },

  _createFlameMaterial(intensity) {
    const shader = {
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: intensity },
      },
      vertexShader: `
        precision highp float;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          // Slight vertical waviness
          float wobble = sin((uv.x + uv.y * 2.0 + uTime * 2.5)) * 0.02;
          p.x += wobble;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uIntensity;

        // Simple pseudo-noise
        float hash(vec2 p){
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p){
          vec2 i = floor(p);
          vec2 f = fract(p);
          // Four corners
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          // Centered UV
          vec2 uv = vUv;
          // Vertical gradient shaping the flame
          float base = smoothstep(0.05, 0.85, uv.y);
          // Animated noise for turbulent edges
          float n = noise(vec2(uv.x * 6.0, uv.y * 10.0 + uTime * 2.0));
          float edge = smoothstep(0.2, 0.9, uv.y + (n - 0.5) * 0.25);
          float alpha = base * edge;

          // Color gradient from white/yellow -> orange -> red
          vec3 col;
          float t = uv.y;
          col = mix(vec3(1.0, 0.95, 0.7), vec3(1.0, 0.6, 0.1), smoothstep(0.0, 0.6, t));
          col = mix(col, vec3(0.9, 0.2, 0.05), smoothstep(0.4, 1.0, t));
          // add intensity and slight flicker
          col *= (1.0 + 0.2 * sin(uTime * 8.0));

          // Soft outer falloff
          float radial = 1.0 - smoothstep(0.0, 0.5, abs(uv.x - 0.5));
          alpha *= radial;

          // Final alpha and additive feel
          gl_FragColor = vec4(col, alpha * 1.2);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    };
    return new THREE.ShaderMaterial(shader);
  },

  _createSmokeTexture() {
    // Create a soft circular gradient texture via canvas
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grd = ctx.createRadialGradient(
      size / 2,
      size / 2,
      10,
      size / 2,
      size / 2,
      size / 2
    );
    grd.addColorStop(0, "rgba(255,255,255,0.35)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.22)");
    grd.addColorStop(1, "rgba(255,255,255,0.0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  },
});
