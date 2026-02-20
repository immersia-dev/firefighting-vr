/**
 * Quest Optimizer Component
 *
 * Applies state-of-the-art runtime optimizations for WebXR on Quest 3S standalone.
 * Attach to the <a-scene> element:
 *   <a-scene quest-optimizer>
 *
 * Features:
 *   - ACES filmic tone mapping + exposure
 *   - Pixel ratio clamped to 1
 *   - Adreno fast-clear (black clearColor)
 *   - Shadow map throttling (update every N frames)
 *   - Procedural sky (THREE.Sky shader — no mesh sphere)
 *   - Frustum culling fix for all meshes
 *   - Static object matrix freeze
 *   - FFR via WebXR session foveation
 *   - Performance monitor (draw calls, triangles, textures)
 */

AFRAME.registerComponent("quest-optimizer", {
  schema: {
    shadowUpdateRate: { type: "int", default: 4 }, // frames between shadow updates
    skyElevation:     { type: "number", default: 35 }, // sun elevation degrees
    skyAzimuth:       { type: "number", default: 180 },
    exposure:         { type: "number", default: 1.15 },
    logPerf:          { type: "boolean", default: false },
  },

  init() {
    this._frameCount = 0;
    this._perfAccum = 0;

    const scene = this.el;

    // Wait for renderer to be available
    if (scene.renderStarted) {
      this._applyRendererOptimizations();
    } else {
      scene.addEventListener("renderstart", () => {
        this._applyRendererOptimizations();
      });
    }

    // Wait for all models to load, then fix culling + freeze statics
    scene.addEventListener("loaded", () => {
      this._downgradePhysicalMaterials();
      this._fixCulling();
      this._freezeStaticMatrices();
      this._setupShadowCasters();
    });
  },

  /* ═══════════════════════════════════════════════════
     Renderer-level optimizations
     ═══════════════════════════════════════════════════ */
  _applyRendererOptimizations() {
    const renderer = this.el.renderer;
    if (!renderer) return;

    // Tone mapping — cinematic, consistent lighting
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.data.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Pixel ratio — NEVER >1 on Quest (saves massive fill rate)
    renderer.setPixelRatio(1);

    // Adreno fast-clear optimization (black or white)
    renderer.setClearColor(0x000000, 1);

    // Shadow map config — BasicShadowMap is the cheapest
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.shadowMap.autoUpdate = false; // we throttle manually

    // Set FFR on XR session when it starts
    renderer.xr.addEventListener("sessionstart", () => {
      const session = renderer.xr.getSession();
      if (session) {
        // Try setting framerate
        if (session.supportedFrameRates) {
          const maxRate = Math.max(...session.supportedFrameRates);
          session.updateTargetFrameRate(maxRate).catch(() => {});
        }
        // FFR on baseLayer
        const glLayer = session.renderState.baseLayer;
        if (glLayer && "fixedFoveation" in glLayer) {
          glLayer.fixedFoveation = 1.0; // maximum foveation
        }
      }
    });

    // Procedural sky
    this._createProceduralSky(renderer);

    window.debugLog && window.debugLog("QuestOptimizer", "Renderer optimizations applied");
  },

  /* ═══════════════════════════════════════════════════
     Procedural Sky (THREE.Sky shader)
     Avoids 15K+ triangle sphere from <a-sky>
     ═══════════════════════════════════════════════════ */
  _createProceduralSky(renderer) {
    // Use a simple gradient sky via scene background instead of Sky shader
    // (Sky shader requires module import not available in vanilla script tags)
    // We create a small canvas gradient and set it as the scene environment

    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Gradient: horizon white-blue → zenith deep blue
    const grd = ctx.createLinearGradient(0, 0, 0, size);
    grd.addColorStop(0.0, "#1a3a5c");  // zenith (top)
    grd.addColorStop(0.35, "#4a8ac4"); // upper sky
    grd.addColorStop(0.55, "#87CEEB"); // mid-sky
    grd.addColorStop(0.75, "#b0cfdf"); // near horizon
    grd.addColorStop(0.85, "#d4dfe8"); // haze
    grd.addColorStop(1.0, "#e8e0d0");  // ground haze (warm)
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 1, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    this.el.object3D.background = texture;
    // NOTE: Do NOT set scene.environment here.
    // Three.js r173 (A-Frame 1.7.1) has a PMREM cubeUV shader bug where
    // CUBEUV_TEXEL_WIDTH/HEIGHT are defined as int instead of float,
    // causing "cannot convert from 'const int' to 'highp float'" on
    // every MeshStandardMaterial/MeshPhysicalMaterial in the scene.
  },

  /* ═══════════════════════════════════════════════════
     Downgrade MeshPhysicalMaterial → MeshStandardMaterial
     MeshPhysicalMaterial is 150+ ALU/fragment and can fail
     to compile on low-precision GPUs. MeshStandardMaterial
     is visually close but ~40% cheaper.
     ═══════════════════════════════════════════════════ */
  _downgradePhysicalMaterials() {
    let count = 0;
    this.el.object3D.traverse((child) => {
      if (!child.isMesh) return;
      const mat = child.material;
      if (!mat || !mat.isMeshPhysicalMaterial) return;

      // Copy all shared properties to a Standard material
      const std = new THREE.MeshStandardMaterial();
      // Transfer common props
      if (mat.map)           std.map = mat.map;
      if (mat.normalMap)     { std.normalMap = mat.normalMap; std.normalScale.copy(mat.normalScale); }
      if (mat.aoMap)         { std.aoMap = mat.aoMap; std.aoMapIntensity = mat.aoMapIntensity; }
      if (mat.emissiveMap)   std.emissiveMap = mat.emissiveMap;
      if (mat.roughnessMap)  std.roughnessMap = mat.roughnessMap;
      if (mat.metalnessMap)  std.metalnessMap = mat.metalnessMap;
      if (mat.alphaMap)      std.alphaMap = mat.alphaMap;
      if (mat.envMap)        std.envMap = mat.envMap;
      std.color.copy(mat.color);
      std.emissive.copy(mat.emissive);
      std.emissiveIntensity = mat.emissiveIntensity;
      std.roughness = mat.roughness;
      std.metalness = mat.metalness;
      std.side = mat.side;
      std.transparent = mat.transparent;
      std.opacity = mat.opacity;
      std.alphaTest = mat.alphaTest;
      std.flatShading = mat.flatShading;
      std.wireframe = mat.wireframe;
      std.name = mat.name;

      child.material = std;
      mat.dispose();
      count++;
    });
    if (count > 0) {
      console.log(`[QuestOptimizer] Downgraded ${count} MeshPhysicalMaterial(s) → MeshStandardMaterial`);
    }
  },

  /* ═══════════════════════════════════════════════════
     Frustum culling — ensure bounding spheres are correct
     ═══════════════════════════════════════════════════ */
  _fixCulling() {
    this.el.object3D.traverse((child) => {
      if (!child.isMesh) return;
      child.frustumCulled = true;
      if (child.geometry) {
        child.geometry.computeBoundingSphere();
        child.geometry.computeBoundingBox();
      }
    });
  },

  /* ═══════════════════════════════════════════════════
     Shadow casters — only non-plant static meshes
     ═══════════════════════════════════════════════════ */
  _setupShadowCasters() {
    this.el.object3D.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || "").toLowerCase();
      const isPlant =
        name.includes("plant") ||
        name.includes("tree") ||
        name.includes("leaf") ||
        name.includes("grass") ||
        name.includes("foliage");

      if (isPlant) {
        child.castShadow = false;
        child.receiveShadow = true;
      } else {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  },

  /* ═══════════════════════════════════════════════════
     Freeze matrices on static objects (skip recalc each frame)
     ═══════════════════════════════════════════════════ */
  _freezeStaticMatrices() {
    // Static entities: hangar, barrels, table, cones, plant
    const staticIds = [
      "plant",
      "oil-barrels",
      "table",
      "navmesh",
    ];

    staticIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.object3D.traverse((obj) => {
        obj.matrixAutoUpdate = false;
        obj.updateMatrix();
        obj.updateMatrixWorld(true);
      });
    });
  },

  /* ═══════════════════════════════════════════════════
     Tick — shadow throttling + optional perf log
     ═══════════════════════════════════════════════════ */
  tick(time, delta) {
    this._frameCount++;
    const renderer = this.el.renderer;

    // Throttled shadow map update
    if (renderer && renderer.shadowMap.enabled) {
      if (this._frameCount % this.data.shadowUpdateRate === 0) {
        renderer.shadowMap.needsUpdate = true;
      }
    }

    // Performance logging (every 2s)
    if (this.data.logPerf || (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_RENDERER)) {
      this._perfAccum += delta || 0;
      if (this._perfAccum >= 2000) {
        this._perfAccum = 0;
        const info = renderer.info;
        console.log(
          `[QuestOptimizer] Draw calls: ${info.render.calls} | ` +
          `Triangles: ${info.render.triangles} | ` +
          `Textures: ${info.memory.textures} | ` +
          `Geometries: ${info.memory.geometries}`
        );
      }
    }
  },
});
