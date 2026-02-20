# WebXR / A-Frame / Three.js Performance Optimization for Quest 3S Standalone Browser

> Comprehensive guide for achieving high FPS in browser-based WebXR on Meta Quest 3S  
> Last updated: February 2026

---

## Table of Contents

1. [Hardware Budgets & Numerical Targets](#1-hardware-budgets--numerical-targets)
2. [A-Frame Renderer & Scene Configuration](#2-a-frame-renderer--scene-configuration)
3. [Draw Call Reduction](#3-draw-call-reduction)
4. [Geometry Instancing & Merging](#4-geometry-instancing--merging)
5. [LOD (Level of Detail)](#5-lod-level-of-detail)
6. [Frustum Culling](#6-frustum-culling)
7. [Texture Optimization & Compression](#7-texture-optimization--compression)
8. [Shadow Map Optimization](#8-shadow-map-optimization)
9. [Shader Complexity](#9-shader-complexity)
10. [A-Frame Specific Optimizations](#10-a-frame-specific-optimizations)
11. [Three.js Specific Optimizations](#11-threejs-specific-optimizations)
12. [Quest Browser APIs](#12-quest-browser-apis)
13. [Particle System Optimization](#13-particle-system-optimization)
14. [glTF Optimization Pipeline](#14-gltf-optimization-pipeline)
15. [Texture Atlasing](#15-texture-atlasing)
16. [Occlusion Culling](#16-occlusion-culling)
17. [Overdraw & Fill-Rate Analysis](#17-overdraw--fill-rate-analysis)
18. [Complete A-Frame Scene Template](#18-complete-a-frame-scene-template)

---

## 1. Hardware Budgets & Numerical Targets

The Quest 3S uses a Qualcomm Snapdragon XR2 Gen 2 SoC with an Adreno 740 GPU. The Meta Quest Browser runs WebGL 2.0. These are the **per-frame budgets** you must stay within:

| Metric | Budget (72 Hz) | Budget (90 Hz) | Notes |
|---|---|---|---|
| **Frame time** | 13.88 ms | 11.11 ms | Total GPU + CPU time per frame |
| **Draw calls** | ≤ 100 ideal, ≤ 200 max | ≤ 80 ideal, ≤ 150 max | Each unique mesh+material = 1 draw call; stereo doubles unless multiview is on |
| **Triangles** | ≤ 200K–300K total | ≤ 150K–200K total | Both eyes combined; with multiview, vertex work is shared |
| **Vertices** | ≤ 100K–150K | ≤ 80K–100K | Post-transform cache matters |
| **Texture memory (VRAM)** | ≤ 150–200 MB | ≤ 150 MB | Browser shares VRAM with the OS compositor |
| **Texture resolution** | Max 2048×2048 per texture | 1024×1024 preferred | Always power-of-two; compress with KTX2 |
| **Lights (real-time)** | 1 directional + 1 ambient | Same | Each additional light multiplies fragment cost |
| **Shadow maps** | 1 at 512×512 or 1024×1024 | Prefer baked | Shadow-casting lights are very expensive |
| **Shader instructions** | ≤ 128 ALU per fragment | ≤ 100 ALU per fragment | Adreno 740 tile-based renderer; fill-rate bound |
| **Transparent objects** | ≤ 10–20 | ≤ 10 | Each adds overdraw pass |

> **Key insight from Meta docs**: "Slow web-based VR experiences are slow because they haven't been carefully optimized rather than because they're running in the browser." The browser overhead is small; the bottleneck is almost always scene complexity.

---

## 2. A-Frame Renderer & Scene Configuration

### Optimal renderer settings

```html
<a-scene
  renderer="
    antialias: false;
    colorManagement: true;
    physicallyCorrectLights: true;
    foveationLevel: 1;
    highRefreshRate: true;
    multiviewStereo: true;
    precision: mediump;
    alpha: false;
    stencil: false;
    logarithmicDepthBuffer: auto;
    sortTransparentObjects: true;
    maxCanvasWidth: 1920;
    maxCanvasHeight: 1920;
    toneMapping: no;
  "
  background="color: #000000"
  vr-mode-ui="enabled: true"
  webxr="requiredFeatures: local-floor;
         optionalFeatures: hand-tracking, high-fixed-foveation-level"
  stats
>
```

#### Key settings explained:

| Setting | Value | Why |
|---|---|---|
| `antialias: false` | Disable on mobile | MSAA is expensive; multiview provides MSAA through `OCULUS_multiview` |
| `foveationLevel: 1` | Max foveation | Renders fewer pixels at periphery. Huge perf win when fragment-bound |
| `highRefreshRate: true` | 90 Hz on Quest 3S | Uses `updateTargetFrameRate` WebXR API. Only enable if you can maintain it |
| `multiviewStereo: true` | Single-pass stereo | Reduces CPU overhead 25–50% by rendering both eyes in one pass |
| `precision: mediump` | Medium precision | Sufficient for most visuals; large performance win on Adreno GPUs |
| `alpha: false` | Opaque canvas | Avoids compositing overhead |
| `stencil: false` | No stencil | Saves bandwidth unless you need stencil ops |
| `background` component | Use instead of `<a-sky>` | `<a-sky>` creates a sphere mesh; `background` is a clear color (zero geometry) |

---

## 3. Draw Call Reduction

Every unique combination of geometry + material = 1 draw call. Without multiview, stereo doubles this. Target: **≤ 100 draw calls**.

### Strategies ranked by impact:

1. **Merge static geometry** into single meshes (biggest win)
2. **Use instancing** for repeated objects (trees, rocks, torches)
3. **Share materials** — reuse the same `THREE.Material` instance across meshes
4. **Texture atlas** — combine multiple textures into one so meshes can share a material
5. **Enable multiview** — cuts draw call overhead ~50% on CPU

### Check draw calls with stats:

```html
<a-scene stats>
```

The stats panel shows `Calls` (draw calls), `Triangles`, `Points`, and `FPS`.

---

## 4. Geometry Instancing & Merging

### 4a. Geometry Merging (Static Objects)

Use `aframe-geometry-merger-component` for static scenery:

```html
<script src="https://unpkg.com/aframe-geometry-merger-component/dist/aframe-geometry-merger-component.min.js"></script>

<!-- All children merged into one draw call -->
<a-entity geometry-merger="preserveOriginal: false">
  <a-box position="-1 0.5 -3" color="#4CC3D9"></a-box>
  <a-box position="0 0.5 -3" color="#EF2D5E"></a-box>
  <a-box position="1 0.5 -3" color="#FFC65D"></a-box>
  <!-- 100 boxes = 1 draw call instead of 100 -->
</a-entity>
```

### Three.js level merging (more control):

```javascript
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

AFRAME.registerComponent('merge-meshes', {
  init: function () {
    // Wait for models to load
    this.el.addEventListener('model-loaded', () => {
      const geometries = [];
      const matrix = new THREE.Matrix4();
      
      this.el.object3D.traverse((child) => {
        if (child.isMesh && !child.isSkinnedMesh) {
          const geom = child.geometry.clone();
          child.updateWorldMatrix(true, false);
          geom.applyMatrix4(child.matrixWorld);
          
          // Preserve vertex colors for per-mesh coloring
          if (!geom.attributes.color) {
            const count = geom.attributes.position.count;
            const colors = new Float32Array(count * 3);
            const color = new THREE.Color(child.material.color);
            for (let i = 0; i < count; i++) {
              colors[i * 3] = color.r;
              colors[i * 3 + 1] = color.g;
              colors[i * 3 + 2] = color.b;
            }
            geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          }
          
          geometries.push(geom);
        }
      });

      if (geometries.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true });
        const mesh = new THREE.Mesh(merged, material);
        
        // Remove original children, add merged
        while (this.el.object3D.children.length) {
          this.el.object3D.remove(this.el.object3D.children[0]);
        }
        this.el.object3D.add(mesh);
      }
    });
  }
});
```

### 4b. InstancedMesh (Repeated Objects)

For many copies of the same mesh (trees, rocks, torches, candles):

```javascript
AFRAME.registerComponent('instanced-objects', {
  schema: {
    count: { type: 'int', default: 100 },
    src: { type: 'model' },
    spread: { type: 'number', default: 20 }
  },

  init: function () {
    const loader = new THREE.GLTFLoader();
    loader.load(this.data.src, (gltf) => {
      // Find the first mesh in the model
      let sourceMesh;
      gltf.scene.traverse((child) => {
        if (child.isMesh && !sourceMesh) {
          sourceMesh = child;
        }
      });

      if (!sourceMesh) return;

      const count = this.data.count;
      const instancedMesh = new THREE.InstancedMesh(
        sourceMesh.geometry,
        sourceMesh.material,
        count
      );

      const dummy = new THREE.Object3D();
      const spread = this.data.spread;

      for (let i = 0; i < count; i++) {
        dummy.position.set(
          (Math.random() - 0.5) * spread,
          0,
          (Math.random() - 0.5) * spread
        );
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.8 + Math.random() * 0.4;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.frustumCulled = true;
      instancedMesh.computeBoundingSphere();
      this.el.object3D.add(instancedMesh);
    });
  }
});
```

```html
<a-entity instanced-objects="count: 50; src: #tree-model; spread: 30"></a-entity>
```

> **Impact**: 50 trees = 1 draw call instead of 50. Vertex data is uploaded once, transforms are in a per-instance buffer.

### 4c. BatchedMesh (Three.js r160+)

`BatchedMesh` is newer and handles **different geometries** in a single draw call:

```javascript
const batchedMesh = new THREE.BatchedMesh(maxGeometryCount, maxVertexCount, maxIndexCount, material);

const boxId = batchedMesh.addGeometry(boxGeometry);
const sphereId = batchedMesh.addGeometry(sphereGeometry);

batchedMesh.setMatrixAt(boxId, boxMatrix);
batchedMesh.setMatrixAt(sphereId, sphereMatrix);

scene.add(batchedMesh);
```

---

## 5. LOD (Level of Detail)

Render lower-poly versions of objects based on distance to camera.

### Three.js LOD in A-Frame:

```javascript
AFRAME.registerComponent('lod-model', {
  schema: {
    high: { type: 'model' },
    medium: { type: 'model' },
    low: { type: 'model' },
    distances: { type: 'array', default: [0, 10, 25] }
  },

  init: function () {
    this.lod = new THREE.LOD();
    const loader = new THREE.GLTFLoader();
    const distances = this.data.distances.map(Number);

    const loadModel = (url, distance) => {
      return new Promise((resolve) => {
        loader.load(url, (gltf) => {
          this.lod.addLevel(gltf.scene, distance);
          resolve();
        });
      });
    };

    Promise.all([
      loadModel(this.data.high, distances[0]),
      loadModel(this.data.medium, distances[1]),
      loadModel(this.data.low, distances[2]),
    ]).then(() => {
      this.el.object3D.add(this.lod);
    });
  },

  tick: function () {
    // LOD.update() needs the camera
    const camera = this.el.sceneEl.camera;
    if (camera) {
      this.lod.update(camera);
    }
  }
});
```

```html
<a-entity
  lod-model="
    high: /models/building_high.glb;
    medium: /models/building_med.glb;
    low: /models/building_low.glb;
    distances: 0, 8, 20
  "
  position="0 0 -10"
></a-entity>
```

### LOD triangle targets:

| LOD Level | Distance | Triangle Target | Use Case |
|---|---|---|---|
| LOD 0 (High) | 0–5m | 100% of original | Close interaction |
| LOD 1 (Medium) | 5–15m | 30–50% of original | Mid-range |
| LOD 2 (Low) | 15–30m | 10–20% of original | Background |
| LOD 3 (Billboard) | 30m+ | 2 triangles (impostor) | Far background |

### Generate LOD meshes with glTF Transform:

```bash
# Generate 50% simplified version
gltf-transform simplify input.glb output_lod1.glb --ratio 0.5 --error 0.01

# Generate 20% simplified version
gltf-transform simplify input.glb output_lod2.glb --ratio 0.2 --error 0.05
```

---

## 6. Frustum Culling

Three.js frustum culling is **enabled by default** (`Object3D.frustumCulled = true`). Objects outside the camera frustum are skipped the GPU entirely.

### Ensure bounding volumes are correct:

```javascript
AFRAME.registerComponent('fix-culling', {
  init: function () {
    this.el.addEventListener('model-loaded', () => {
      this.el.object3D.traverse((child) => {
        if (child.isMesh) {
          child.frustumCulled = true;
          child.geometry.computeBoundingSphere();
          child.geometry.computeBoundingBox();
        }
      });
    });
  }
});
```

### For large objects that get culled incorrectly:

```javascript
// Expand bounding sphere for objects with vertex shader displacement
child.geometry.boundingSphere.radius *= 1.5;
```

### For InstancedMesh:

```javascript
instancedMesh.computeBoundingSphere();
// If instances spread widely, manually set:
instancedMesh.boundingSphere = new THREE.Sphere(
  new THREE.Vector3(0, 0, 0),
  50 // radius encompassing all instances
);
```

### Disable culling when it causes issues:

```javascript
// Only for objects always visible (skybox, floor):
mesh.frustumCulled = false;
```

---

## 7. Texture Optimization & Compression

### 7a. Format Recommendations for Quest 3S

| Texture Type | Format | Compression | Max Resolution |
|---|---|---|---|
| Diffuse/Albedo | KTX2 (ETC1S) | Basis Universal ETC1S | 1024×1024 |
| Normal maps | KTX2 (UASTC) | Basis Universal UASTC | 1024×1024 |
| ORM (AO/Rough/Metal) | KTX2 (ETC1S) | Basis Universal ETC1S | 512×512 |
| Emissive | KTX2 (ETC1S) or WebP | Basis or lossy WebP | 512×512 |
| Lightmaps | KTX2 (ETC1S) | Basis Universal ETC1S | 1024×1024 |
| UI/HUD | WebP | Lossy | 512×512 |

> **Why KTX2/Basis?** From Meta docs: "The in-memory size of the texture will be smaller and the GPU is able to access these textures more efficiently which will decrease the texture bandwidth of your scene." KTX2 textures are GPU-compressed — they stay compressed in VRAM, unlike PNG/JPEG which decompress to full RGBA.

### Memory comparison:

| Format | 1024×1024 RGBA | In VRAM |
|---|---|---|
| PNG (uncompressed in GPU) | ~4 MB | 4 MB |
| JPEG (uncompressed in GPU) | ~4 MB | 4 MB |
| KTX2 ETC1S | ~0.5 MB | ~0.5 MB |
| KTX2 UASTC | ~1.3 MB | ~1.3 MB |
| ASTC 4×4 (via KTX2) | ~1 MB | ~1 MB |

### 7b. Loading KTX2 in Three.js / A-Frame

```javascript
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

AFRAME.registerComponent('ktx2-material', {
  schema: {
    src: { type: 'string' }
  },
  init: function () {
    const renderer = this.el.sceneEl.renderer;
    const ktx2Loader = new KTX2Loader()
      .setTranscoderPath('/basis/')  // path to basis_transcoder.js + .wasm
      .detectSupport(renderer);

    ktx2Loader.load(this.data.src, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = this.el.getObject3D('mesh');
      if (mesh) {
        mesh.traverse((child) => {
          if (child.isMesh) {
            child.material.map = texture;
            child.material.needsUpdate = true;
          }
        });
      }
    });
  }
});
```

### 7c. Texture rules of thumb:

- **Always use power-of-two** dimensions (256, 512, 1024, 2048)
- **Generate mipmaps** — critical for minification quality and cache performance
- **Max 2048×2048** for any single texture on Quest
- **Prefer 512×512 or 1024×1024** for most textures
- **Reuse materials** — every unique material = potential extra draw call
- **Set `texture.anisotropy = 1`** on mobile (higher values are expensive)

---

## 8. Shadow Map Optimization

From Meta docs: "Real-time shadows are typically implemented by rendering the scene once from the perspective of the light... Drawing the scene to render the shadow map counts against your overall scene budget for draw calls and triangles."

### Best approach: Bake shadows into lightmaps

```javascript
// Use baked lightmap on an unlit material (best performance)
AFRAME.registerComponent('baked-lightmap', {
  schema: { src: { type: 'map' } },
  init: function () {
    this.el.addEventListener('model-loaded', () => {
      const lightmapTexture = new THREE.TextureLoader().load(this.data.src);
      lightmapTexture.flipY = false;
      lightmapTexture.colorSpace = THREE.SRGBColorSpace;
      
      this.el.object3D.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshBasicMaterial({
            map: child.material.map,
            lightMap: lightmapTexture,
            lightMapIntensity: 1.0,
          });
        }
      });
    });
  }
});
```

### If you MUST use real-time shadows:

```html
<a-scene shadow="type: basic; autoUpdate: false;">
  <!-- Only ONE shadow-casting directional light -->
  <a-light
    type="directional"
    light="
      castShadow: true;
      shadowMapWidth: 512;
      shadowMapHeight: 512;
      shadowCameraNear: 0.5;
      shadowCameraFar: 30;
      shadowCameraLeft: -10;
      shadowCameraRight: 10;
      shadowCameraTop: 10;
      shadowCameraBottom: -10;
      shadowBias: -0.005;
    "
    position="5 10 5"
  ></a-light>
</a-scene>
```

```javascript
// Manual shadow map updates (not every frame)
AFRAME.registerComponent('shadow-throttle', {
  init: function () {
    this.el.sceneEl.renderer.shadowMap.autoUpdate = false;
    this.frameCount = 0;
  },
  tick: function () {
    this.frameCount++;
    // Update shadow map every 6th frame (~12-15 FPS shadow updates at 72-90 FPS)
    if (this.frameCount % 6 === 0) {
      this.el.sceneEl.renderer.shadowMap.needsUpdate = true;
    }
  }
});
```

### Shadow best practices:

- Use `BasicShadowMap` (not PCF or PCFSoft) — cheapest option
- Shadow map resolution: **512×512 maximum**
- **Never use point light shadows** (6 shadow maps per light!)
- Restrict `shadowCamera` bounds tightly around the visible area
- Set `shadowMap.autoUpdate = false` and manually update every N frames
- **Prefer baked shadows** over real-time whenever possible

---

## 9. Shader Complexity

### Material cost hierarchy (cheapest to most expensive):

1. **`MeshBasicMaterial`** — unlit, no lighting calculations (~10 ALU)
2. **`MeshLambertMaterial`** — per-vertex lighting (~30 ALU)
3. **`MeshPhongMaterial`** — per-fragment Phong shading (~50 ALU)
4. **`MeshStandardMaterial`** — PBR, metallic/roughness (~80–120 ALU)
5. **`MeshPhysicalMaterial`** — PBR + clearcoat, transmission (~150+ ALU)

### Recommendation for Quest 3S:

```javascript
// For static environment: baked lighting on BasicMaterial
const bakedMaterial = new THREE.MeshBasicMaterial({
  map: diffuseTexture,
  lightMap: lightmapTexture,
});

// For dynamic objects needing some lighting response
const lambertMaterial = new THREE.MeshLambertMaterial({
  map: diffuseTexture,
});

// Use Standard PBR sparingly — only for hero objects
const pbrMaterial = new THREE.MeshStandardMaterial({
  map: diffuseTexture,
  roughness: 0.7,
  metalness: 0.0,
  // Skip normal map if possible to save texture bandwidth
});
```

From A-Frame docs: "Pre-baked lighting on an unlit (Basic) material can significantly improve performance. A-Frame's default PBR-based (Standard) material is more physically realistic, but also more expensive and often unnecessary in simple scenes."

### Fragment shader tips for Adreno GPUs:

- Set `precision: mediump` in the renderer (A-Frame: `renderer="precision: mediump"`)
- Avoid `discard` in fragment shaders — breaks early-Z on tile-based GPUs
- Minimize texture samples per fragment (1–3 ideal, 4+ expensive)
- Avoid dependent texture reads (UV calculated from another texture)
- `DoubleSide` materials are ~2× cost because backface culling is disabled

---

## 10. A-Frame Specific Optimizations

### 10a. Tick Throttling

`tick()` runs every frame (72–90× per second). Throttle non-critical updates:

```javascript
AFRAME.registerComponent('slow-update', {
  tick: function (time, delta) {
    // This runs 90× per second — TOO FAST for most logic
  }
});

// BETTER: Use throttleTick
AFRAME.registerComponent('slow-update', {
  init: function () {
    // Throttle to run at most every 100ms (~10 FPS)
    this.tick = AFRAME.utils.throttleTick(this.tick, 100, this);
  },
  tick: function (time, delta) {
    // Runs ~10× per second instead of 90×
    this.updateAI();
    this.checkCollisions();
  }
});
```

### 10b. Object Pooling

Avoid creating/destroying entities at runtime — use the built-in pool:

```html
<a-scene pool__bullets="mixin: bullet; size: 20;">
  <!-- 20 bullet entities pre-created and recycled -->
</a-scene>

<a-mixin id="bullet" geometry="primitive: sphere; radius: 0.05" material="color: red"></a-mixin>
```

```javascript
// Request entity from pool
const bullet = this.el.sceneEl.components['pool__bullets'].requestEntity();
bullet.object3D.position.copy(spawnPosition);
bullet.object3D.visible = true;
bullet.setAttribute('visible', true);

// Return to pool when done
this.el.sceneEl.components['pool__bullets'].returnEntity(bullet);
```

### 10c. Direct Object3D Manipulation

Skip `setAttribute` overhead in performance-critical paths:

```javascript
// SLOW — triggers DOM update, parsing, component lifecycle
el.setAttribute('position', { x: 1, y: 2, z: 3 });
el.setAttribute('rotation', { x: 0, y: 45, z: 0 });
el.setAttribute('visible', true);

// FAST — direct three.js manipulation
el.object3D.position.set(1, 2, 3);
el.object3D.rotation.set(0, THREE.MathUtils.degToRad(45), 0);
el.object3D.visible = true;
```

### 10d. Garbage Collection Prevention

```javascript
AFRAME.registerComponent('optimized-mover', {
  init: function () {
    // Pre-allocate reusable objects ONCE
    this._velocity = new THREE.Vector3();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._evtDetail = { position: this._position };
  },

  tick: (function () {
    // Closure variables shared across all instances — be careful with state
    const helperVec = new THREE.Vector3();
    const helperMat = new THREE.Matrix4();

    return function (time, delta) {
      // Use pre-allocated objects, never `new` in tick
      helperVec.copy(this.el.object3D.position);
      helperVec.add(this._velocity);
      this.el.object3D.position.copy(helperVec);
      
      // Reuse event detail objects
      this._position.copy(helperVec);
      this.el.emit('moved', this._evtDetail);
    };
  })()
});
```

### 10e. Lazy Loading

```javascript
AFRAME.registerComponent('lazy-load', {
  schema: {
    src: { type: 'string' },
    distance: { type: 'number', default: 15 }
  },

  init: function () {
    this.loaded = false;
    this.camera = null;
    this.tick = AFRAME.utils.throttleTick(this.tick, 500, this);
  },

  tick: function () {
    if (this.loaded) return;
    
    if (!this.camera) {
      this.camera = this.el.sceneEl.camera;
    }
    if (!this.camera) return;

    const distance = this.el.object3D.position.distanceTo(this.camera.position);
    if (distance < this.data.distance) {
      this.el.setAttribute('gltf-model', this.data.src);
      this.loaded = true;
      // Stop ticking
      this.tick = function () {};
    }
  }
});
```

```html
<a-entity lazy-load="src: #heavy-model; distance: 10" position="0 0 -20"></a-entity>
```

### 10f. Use `<background>` instead of `<a-sky>`

```html
<!-- BAD: Creates a sphere with 15,000+ triangles -->
<a-sky color="#000000"></a-sky>

<!-- GOOD: Zero geometry, just GL clear color -->
<a-scene background="color: #000000">
```

---

## 11. Three.js Specific Optimizations

### 11a. BufferGeometry Merging

```javascript
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Merge multiple geometries into one (static objects only)
function mergeStaticScene(meshes) {
  const geometries = [];
  
  for (const mesh of meshes) {
    const geom = mesh.geometry.clone();
    mesh.updateMatrixWorld(true);
    geom.applyMatrix4(mesh.matrixWorld);
    geometries.push(geom);
  }

  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  // Index the merged geometry for better GPU cache performance
  merged.computeBoundingSphere();
  
  return new THREE.Mesh(merged, sharedMaterial);
}
```

### 11b. Renderer Settings for Quest

```javascript
// Access the renderer after scene init
const scene = document.querySelector('a-scene');
scene.addEventListener('loaded', () => {
  const renderer = scene.renderer;
  
  // Performance settings
  renderer.sortObjects = true;          // Enable front-to-back sorting
  renderer.powerPreference = 'high-performance';
  
  // Limit pixel ratio (Quest browser may report > 1)
  renderer.setPixelRatio(1);
  
  // Disable features you don't need
  renderer.shadowMap.enabled = false;   // If using baked shadows
  
  // Clear color optimization for Adreno "Fast Clear"
  renderer.setClearColor(0x000000, 1);  // Black or white for Adreno fast-clear
});
```

### 11c. Object3D Performance

```javascript
// Freeze matrices for static objects (skip matrix recalculation)
staticMesh.matrixAutoUpdate = false;
staticMesh.updateMatrix(); // Compute once

// Eliminate unnecessary scene graph depth
// BAD: deeply nested groups
// group > group > group > mesh
// GOOD: flat hierarchy
// group > mesh1, mesh2, mesh3
```

### 11d. Dispose Resources Properly

```javascript
function disposeMesh(mesh) {
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }
  if (mesh.material) {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(mat => {
        disposeMaterial(mat);
      });
    } else {
      disposeMaterial(mesh.material);
    }
  }
}

function disposeMaterial(material) {
  if (material.map) material.map.dispose();
  if (material.normalMap) material.normalMap.dispose();
  if (material.roughnessMap) material.roughnessMap.dispose();
  if (material.metalnessMap) material.metalnessMap.dispose();
  if (material.aoMap) material.aoMap.dispose();
  if (material.emissiveMap) material.emissiveMap.dispose();
  if (material.lightMap) material.lightMap.dispose();
  material.dispose();
}
```

---

## 12. Quest Browser APIs

### 12a. Fixed Foveated Rendering (FFR)

FFR renders fewer pixels at the edges of vision — huge win when fragment-bound.

**Method 1: At session startup (recommended)**

```javascript
const sessionInit = {
  requiredFeatures: ['local-floor'],
  optionalFeatures: [
    'hand-tracking',
    'high-fixed-foveation-level',  // Options: 'low-', 'medium-', 'high-fixed-foveation-level'
  ]
};

navigator.xr.requestSession('immersive-vr', sessionInit);
```

**Method 2: Dynamic at runtime**

```javascript
// On the XRWebGLLayer
const xrSession = renderer.xr.getSession();
const glLayer = xrSession.renderState.baseLayer;
if (glLayer && 'fixedFoveation' in glLayer) {
  glLayer.fixedFoveation = 1.0;  // 0 = minimum, 1 = maximum foveation
}
```

**In A-Frame** — just use the renderer component:

```html
<a-scene renderer="foveationLevel: 1">
```

> **Warning from Meta**: FFR breaks if you switch render targets mid-frame (e.g., rendering shadow maps). Render all non-eye-buffer targets FIRST, then render the scene to the eye buffer in one uninterrupted pass.

### 12b. High Refresh Rate

```javascript
// WebXR API
const session = await navigator.xr.requestSession('immersive-vr');
if (session.supportedFrameRates) {
  const rates = session.supportedFrameRates;
  const maxRate = Math.max(...rates); // e.g., 90 for Quest 3S
  await session.updateTargetFrameRate(maxRate);
}
```

**In A-Frame:**

```html
<a-scene renderer="highRefreshRate: true">
```

| Device | Default | High |
|---|---|---|
| Quest 3S | 72 Hz | 90 Hz |
| Quest 3 | 72 Hz | 90 Hz (up to 120 Hz) |
| Quest 2 | 72 Hz | 90 Hz |

### 12c. Multiview Stereo Rendering

From Meta docs: "Only CPU-bound experiences will benefit from multi-view. Often, a CPU usage reduction of 25% - 50% is possible."

**In A-Frame** (easiest):

```html
<a-scene renderer="multiviewStereo: true">
```

This enables the `OCULUS_multiview` WebGL 2.0 extension, which renders both eyes in a single pass using GL_OVR_multiview instancing.

**Caveats:**
- Only works with WebGL 2.0
- Texture uploads are deferred by one frame (bones/skeletal animation lags by 1 frame)
- Some post-processing effects may not work correctly
- Can't switch render targets mid-scene render

---

## 13. Particle System Optimization

Fire/smoke particles are **overdraw monsters**. Each transparent particle quad renders to multiple fragments.

### Budget:

- **≤ 30–50 particles** simultaneously visible for fire/smoke
- **≤ 5–10** particle emitters active at once
- **Particle size**: keep small to reduce overdraw
- Use **soft particles** cautiously (depth texture reads are expensive)

### Optimized particle approach using InstancedMesh:

```javascript
AFRAME.registerComponent('gpu-particles', {
  schema: {
    count: { default: 30 },
    texture: { type: 'map' }
  },

  init: function () {
    const count = this.data.count;
    
    // Single quad geometry shared by all particles
    const geometry = new THREE.PlaneGeometry(0.3, 0.3);
    
    const material = new THREE.MeshBasicMaterial({
      map: this.data.texture ? new THREE.TextureLoader().load(this.data.texture) : null,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 0.6,
    });

    this.particles = new THREE.InstancedMesh(geometry, material, count);
    this.particles.frustumCulled = false;
    this.el.object3D.add(this.particles);

    // Per-particle state
    this.velocities = new Float32Array(count * 3);
    this.lifetimes = new Float32Array(count);
    this.ages = new Float32Array(count);
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();

    // Initialize particles
    for (let i = 0; i < count; i++) {
      this.resetParticle(i);
    }
  },

  resetParticle: function (i) {
    this.velocities[i * 3] = (Math.random() - 0.5) * 0.3;
    this.velocities[i * 3 + 1] = 1.0 + Math.random() * 1.5;
    this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    this.lifetimes[i] = 1.0 + Math.random() * 1.5;
    this.ages[i] = Math.random() * this.lifetimes[i]; // stagger
    
    this._dummy.position.set(
      (Math.random() - 0.5) * 0.2,
      0,
      (Math.random() - 0.5) * 0.2
    );
    this._dummy.scale.setScalar(0.1);
    this._dummy.updateMatrix();
    this.particles.setMatrixAt(i, this._dummy.matrix);
  },

  tick: function (time, delta) {
    const dt = delta / 1000;
    const count = this.data.count;
    let needsUpdate = false;

    for (let i = 0; i < count; i++) {
      this.ages[i] += dt;
      
      if (this.ages[i] >= this.lifetimes[i]) {
        this.resetParticle(i);
        needsUpdate = true;
        continue;
      }

      const t = this.ages[i] / this.lifetimes[i]; // 0 → 1
      
      this.particles.getMatrixAt(i, this._dummy.matrix);
      this._dummy.matrix.decompose(this._dummy.position, this._dummy.quaternion, this._dummy.scale);
      
      this._dummy.position.x += this.velocities[i * 3] * dt;
      this._dummy.position.y += this.velocities[i * 3 + 1] * dt;
      this._dummy.position.z += this.velocities[i * 3 + 2] * dt;
      
      // Scale up then fade
      const scale = (t < 0.3 ? t / 0.3 : 1.0) * 0.5;
      this._dummy.scale.setScalar(scale);
      
      // Billboard: face camera
      const camera = this.el.sceneEl.camera;
      if (camera) {
        this._dummy.quaternion.copy(camera.quaternion);
      }

      this._dummy.updateMatrix();
      this.particles.setMatrixAt(i, this._dummy.matrix);
      
      // Color: orange → dark red over lifetime
      this._color.setHSL(0.05 - t * 0.05, 1.0, 0.5 - t * 0.3);
      this.particles.setColorAt(i, this._color);
      
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.particles.instanceMatrix.needsUpdate = true;
      if (this.particles.instanceColor) {
        this.particles.instanceColor.needsUpdate = true;
      }
    }
  }
});
```

### Particle optimization techniques:

1. **Use additive blending** (`AdditiveBlending`) — avoids sort order issues and looks good for fire
2. **Set `depthWrite: false`** — prevents z-fighting between particles
3. **Small particle size** — less overdraw per particle
4. **Billboard with InstancedMesh** — 1 draw call for all particles
5. **Limit count** — 30 particles can look like a convincing fire
6. **Use a sprite sheet** (flipbook animation) instead of many overlapping particles
7. **Shader-based particles** for even better performance (compute age/position in vertex shader)

---

## 14. glTF Optimization Pipeline

### Complete build pipeline:

```bash
# Install tools
npm install -g @gltf-transform/cli

# Full optimization pipeline
gltf-transform optimize input.glb output.glb \
  --texture-compress webp \
  --texture-resize 1024

# OR, fine-grained control:

# 1. Clean up
gltf-transform dedup input.glb step1.glb      # Remove duplicate data
gltf-transform prune step1.glb step2.glb      # Remove unused nodes
gltf-transform flatten step2.glb step3.glb    # Flatten scene graph

# 2. Geometry optimization
gltf-transform weld step3.glb step4.glb       # Weld duplicate vertices
gltf-transform simplify step4.glb step5.glb --ratio 0.75 --error 0.01  # Reduce triangles
gltf-transform reorder step5.glb step6.glb    # Optimize vertex order for GPU cache
gltf-transform quantize step6.glb step7.glb   # Quantize positions/normals (smaller file)

# 3. Instancing (auto-detect repeated meshes)
gltf-transform instance step7.glb step8.glb   # Uses EXT_mesh_gpu_instancing

# 4. Texture compression
# UASTC for normal maps (better quality for non-color data)
gltf-transform uastc step8.glb step9.glb \
  --slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}" \
  --level 4 --rdo --rdo-lambda 4 --zstd 18

# ETC1S for color textures (smallest file size)
gltf-transform etc1s step9.glb step10.glb \
  --quality 255

# 5. Mesh compression
gltf-transform meshopt step10.glb final.glb --level medium
```

### Scripting API (Node.js build script):

```javascript
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  resample, prune, dedup, flatten, join,
  weld, simplify, instance, quantize,
  textureCompress, reorder, meshopt
} from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptEncoder } from 'meshoptimizer';

await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read('scene.glb');

await document.transform(
  // Clean
  dedup(),
  prune(),
  resample(),
  flatten(),
  
  // Geometry
  weld({ tolerance: 0.0001 }),
  simplify({ ratio: 0.75, error: 0.01 }),
  reorder({ encoder: MeshoptEncoder }),
  instance(),
  quantize(),
  
  // Textures — resize and convert to WebP
  textureCompress({
    encoder: sharp,
    targetFormat: 'webp',
    resize: [1024, 1024],
  }),
  
  // Mesh compression
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);

await io.write('scene_optimized.glb', document);
```

### Key glTF Transform functions:

| Function | What it does | Impact |
|---|---|---|
| `dedup()` | Removes duplicate accessors, textures, materials | File size |
| `prune()` | Removes unreferenced nodes/materials | File size, draw calls |
| `flatten()` | Flattens scene hierarchy | CPU traversal |
| `weld()` | Merges duplicate vertices | Vertex count |
| `simplify()` | Mesh decimation (meshoptimizer) | Triangle count |
| `instance()` | Auto-detects repeated meshes → `EXT_mesh_gpu_instancing` | Draw calls |
| `join()` | Merges meshes sharing materials | Draw calls |
| `quantize()` | Reduces vertex precision (16-bit positions/normals) | File size, bandwidth |
| `reorder()` | Optimizes vertex/index order for GPU cache | GPU vertex cache |
| `textureCompress()` | Resize + convert textures | VRAM, bandwidth |
| `meshopt()` | Meshoptimizer compression | File size, load time |

---

## 15. Texture Atlasing

Combine multiple textures into one atlas so objects can share a single material → single draw call.

### Manual atlas setup:

```javascript
AFRAME.registerComponent('atlas-uvs', {
  schema: {
    atlas: { type: 'map' },
    // UV rect in atlas: x, y, width, height (0-1 normalized)
    rect: { type: 'vec4', default: { x: 0, y: 0, z: 0.5, w: 0.5 } }
  },

  init: function () {
    this.el.addEventListener('model-loaded', () => {
      const { x, y, z: width, w: height } = this.data.rect;
      
      this.el.object3D.traverse((child) => {
        if (child.isMesh) {
          // Remap UVs to atlas region
          const uvAttr = child.geometry.attributes.uv;
          for (let i = 0; i < uvAttr.count; i++) {
            const u = uvAttr.getX(i);
            const v = uvAttr.getY(i);
            uvAttr.setXY(i, x + u * width, y + v * height);
          }
          uvAttr.needsUpdate = true;
          
          // Share the atlas material
          child.material.map = new THREE.TextureLoader().load(this.data.atlas);
        }
      });
    });
  }
});
```

### Atlas layout tipss:

- Pack textures in power-of-two atlas (2048×2048 max)
- Add 2–4 pixel padding between regions to prevent bleeding
- Use tools like [TexturePacker](https://www.codeandweb.com/texturepacker) or [free-tex-packer](https://free-tex-packer.com/)
- In glTF, use `KHR_texture_transform` extension for UV offset/scale

```json
// glTF KHR_texture_transform example
{
  "extensions": {
    "KHR_texture_transform": {
      "offset": [0.0, 0.5],
      "scale": [0.5, 0.5]
    }
  }
}
```

---

## 16. Occlusion Culling

Three.js/A-Frame do **not** have built-in occlusion culling. Approaches:

### 16a. Manual Visibility Zones

```javascript
AFRAME.registerComponent('visibility-zone', {
  schema: {
    targets: { type: 'selectorAll' },
    showDistance: { type: 'number', default: 15 },
  },

  init: function () {
    this.tick = AFRAME.utils.throttleTick(this.tick, 250, this);
    this._camPos = new THREE.Vector3();
    this._objPos = new THREE.Vector3();
  },

  tick: function () {
    const camera = this.el.sceneEl.camera;
    if (!camera) return;
    
    camera.getWorldPosition(this._camPos);

    for (const target of this.data.targets) {
      target.object3D.getWorldPosition(this._objPos);
      const dist = this._camPos.distanceTo(this._objPos);
      target.object3D.visible = dist < this.data.showDistance;
    }
  }
});
```

### 16b. Room-based Culling

For indoor scenes with distinct rooms:

```javascript
AFRAME.registerComponent('room-culling', {
  schema: {
    rooms: { type: 'selectorAll' }, // Each room is an entity
    activeRoom: { type: 'string' }
  },

  update: function () {
    for (const room of this.data.rooms) {
      room.object3D.visible = (room.id === this.data.activeRoom);
    }
  }
});
```

```html
<a-entity room-culling="rooms: .room; activeRoom: room-main">
  <a-entity class="room" id="room-main"> <!-- visible --> </a-entity>
  <a-entity class="room" id="room-hidden1"> <!-- hidden --> </a-entity>
  <a-entity class="room" id="room-hidden2"> <!-- hidden --> </a-entity>
</a-entity>
```

### 16c. Three.js Frustum Culling Enhancement

```javascript
// Tighter frustum culling by computing exact bounding spheres
scene.traverse((obj) => {
  if (obj.isMesh) {
    obj.geometry.computeBoundingSphere();
    // For groups, compute a merged bounding sphere
  }
});
```

---

## 17. Overdraw & Fill-Rate Analysis

Quest 3S is frequently **fill-rate bound** (fragment shader limited), not vertex bound.

### Signs of being fill-rate bound:
- FPS drops with larger objects even if triangle count is low
- Transparent objects kill FPS disproportionately
- Reducing resolution (smaller canvas) improves FPS significantly
- Adding more lights hurts FPS

### Strategies:

1. **Sort opaque objects front-to-back** (Three.js does this by default with `sortObjects: true`)
2. **Avoid transparent objects** whenever possible
3. **Render sky/skybox LAST** (set `renderOrder` to high value)
4. **Use FFR** (foveated rendering) — reduces pixel count at periphery
5. **Reduce canvas resolution** if needed

```javascript
// Force sky to render last to maximize early-Z rejection
skyMesh.renderOrder = 9999;
// Or use depthTest: false + renderOrder for sky
skyMesh.material.depthWrite = false;
skyMesh.renderOrder = -1; // Render first but don't write depth
```

```javascript
// Manually sort transparent objects to minimize overdraw
transparentMesh.renderOrder = 100; // Higher = later in render queue
```

### From Meta docs:
> "As much as possible, you should strive to only render to each fragment or pixel on the screen exactly once."
>
> "If you're rendering the sky as a big sphere that is centered around the viewer's position, the default front-to-back sorting will likely get confused... Setting the sky's draw order manually may be necessary."
>
> "Set your clear color to white or black" — Adreno GPUs have a hardware-level "Fast Clear" optimization for black/white.

---

## 18. Complete A-Frame Scene Template

Putting it all together — a production-ready scene configuration:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Optimized Quest 3S WebXR Scene</title>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="https://unpkg.com/aframe-geometry-merger-component/dist/aframe-geometry-merger-component.min.js"></script>
</head>
<body>
<a-scene
  renderer="
    antialias: false;
    colorManagement: true;
    foveationLevel: 1;
    highRefreshRate: true;
    multiviewStereo: true;
    precision: mediump;
    alpha: false;
    stencil: false;
    sortTransparentObjects: true;
    maxCanvasWidth: 1920;
    maxCanvasHeight: 1920;
  "
  background="color: #000000"
  webxr="
    requiredFeatures: local-floor;
    optionalFeatures: hand-tracking, high-fixed-foveation-level;
  "
  vr-mode-ui="enabled: true"
  loading-screen="dotsColor: white; backgroundColor: black"
>

  <!-- ============================================ -->
  <!-- ASSET MANAGEMENT: Preload everything -->
  <!-- ============================================ -->
  <a-assets timeout="30000">
    <!-- KTX2 compressed textures -->
    <img id="env-diffuse" src="textures/environment_diffuse.ktx2">
    <img id="env-lightmap" src="textures/environment_lightmap.ktx2">
    
    <!-- Optimized glTF models (meshopt compressed) -->
    <a-asset-item id="scene-model" src="models/scene_optimized.glb"></a-asset-item>
    <a-asset-item id="props-model" src="models/props_optimized.glb"></a-asset-item>
    
    <!-- LOD variants -->
    <a-asset-item id="building-high" src="models/building_lod0.glb"></a-asset-item>
    <a-asset-item id="building-med" src="models/building_lod1.glb"></a-asset-item>
    <a-asset-item id="building-low" src="models/building_lod2.glb"></a-asset-item>
  </a-assets>

  <!-- ============================================ -->
  <!-- LIGHTING: Minimal real-time lights -->
  <!-- ============================================ -->
  <!-- 1 ambient + 1 directional max -->
  <a-light type="ambient" color="#404050" intensity="0.5"></a-light>
  <a-light type="directional" color="#FFEEDD" intensity="0.8"
           position="5 10 5" light="castShadow: false"></a-light>

  <!-- ============================================ -->
  <!-- STATIC ENVIRONMENT: Merged geometry -->
  <!-- ============================================ -->
  <a-entity
    gltf-model="#scene-model"
    fix-culling
    merge-meshes
  ></a-entity>

  <!-- ============================================ -->
  <!-- INSTANCED OBJECTS: Trees, rocks, etc. -->
  <!-- ============================================ -->
  <a-entity instanced-objects="count: 30; src: #props-model; spread: 25"></a-entity>

  <!-- ============================================ -->
  <!-- LOD OBJECTS -->
  <!-- ============================================ -->
  <a-entity
    lod-model="high: #building-high; medium: #building-med; low: #building-low; distances: 0, 10, 25"
    position="0 0 -15"
  ></a-entity>

  <!-- ============================================ -->
  <!-- FIRE PARTICLES: InstancedMesh based -->
  <!-- ============================================ -->
  <a-entity gpu-particles="count: 30" position="2 0 -5"></a-entity>

  <!-- ============================================ -->
  <!-- CAMERA -->
  <!-- ============================================ -->
  <a-entity id="rig" movement-controls>
    <a-camera
      position="0 1.6 0"
      look-controls="pointerLockEnabled: false"
    ></a-camera>
    <a-entity laser-controls="hand: left"></a-entity>
    <a-entity laser-controls="hand: right"></a-entity>
  </a-entity>

</a-scene>

<script>
  // ============================================
  // SCENE INIT: Apply runtime optimizations
  // ============================================
  const scene = document.querySelector('a-scene');
  scene.addEventListener('loaded', () => {
    const renderer = scene.renderer;
    
    // Adreno fast-clear optimization
    renderer.setClearColor(0x000000, 1);
    renderer.setPixelRatio(1);
    
    // Disable shadow auto-update globally
    renderer.shadowMap.enabled = false;
    
    // Freeze static object matrices
    scene.object3D.traverse((obj) => {
      if (obj.isMesh && obj.userData.isStatic) {
        obj.matrixAutoUpdate = false;
      }
    });
  });

  // ============================================
  // PERFORMANCE MONITOR: Custom FPS tracking
  // ============================================
  AFRAME.registerComponent('perf-monitor', {
    init: function () {
      this.frames = 0;
      this.lastTime = performance.now();
      this.tick = AFRAME.utils.throttleTick(this.tick, 1000, this);
    },
    tick: function () {
      const now = performance.now();
      const elapsed = now - this.lastTime;
      const fps = (this.frames / elapsed) * 1000;
      console.log(`FPS: ${fps.toFixed(1)} | ` +
        `Draw calls: ${this.el.sceneEl.renderer.info.render.calls} | ` +
        `Triangles: ${this.el.sceneEl.renderer.info.render.triangles} | ` +
        `Textures: ${this.el.sceneEl.renderer.info.memory.textures}`);
      this.frames = 0;
      this.lastTime = now;
    },
    tock: function () { this.frames++; }
  });
</script>
</body>
</html>
```

---

## Quick Reference: Optimization Checklist

### Before first render:
- [ ] glTF models optimized with `gltf-transform optimize`
- [ ] Textures compressed to KTX2 (ETC1S for color, UASTC for normal maps)
- [ ] All textures ≤ 1024×1024, power-of-two dimensions
- [ ] Meshes decimated to LOD levels with `gltf-transform simplify`
- [ ] Duplicate data removed with `gltf-transform dedup`
- [ ] Static lighting baked into lightmap textures

### Scene setup:
- [ ] `renderer` configured: `foveationLevel: 1`, `multiviewStereo: true`, `precision: mediump`
- [ ] `background` component instead of `<a-sky>` for solid colors
- [ ] Max 1 directional + 1 ambient light
- [ ] Shadows disabled or baked (no real-time shadow maps)
- [ ] Asset preloading via `<a-assets>` with timeout

### Runtime:
- [ ] Draw calls < 100 (check with `stats` component)
- [ ] Triangles < 200K total
- [ ] Static geometry merged (`geometry-merger` or `BufferGeometryUtils`)
- [ ] Repeated objects use `InstancedMesh`
- [ ] LOD system for distant objects
- [ ] Tick handlers throttled with `AFRAME.utils.throttleTick`
- [ ] Direct `object3D` manipulation instead of `setAttribute` in hot paths
- [ ] No `new` allocations in `tick()` — pre-allocate and reuse
- [ ] Object pooling for frequently created/destroyed entities
- [ ] Front-to-back sort enabled (`sortObjects: true`)
- [ ] Sky/background renders last
- [ ] Transparent objects minimized (< 20)
- [ ] Particle count limited (< 50 per emitter)
- [ ] FFR enabled via `high-fixed-foveation-level`
- [ ] Using black clear color for Adreno fast-clear

---

## Sources

1. [A-Frame Best Practices](https://aframe.io/docs/1.7.0/introduction/best-practices.html)
2. [A-Frame Renderer Component](https://aframe.io/docs/1.7.0/components/renderer.html)
3. [Three.js InstancedMesh](https://threejs.org/docs/#api/en/objects/InstancedMesh)
4. [Three.js Optimize Lots of Objects](https://threejs.org/manual/#en/optimize-lots-of-objects)
5. [Meta WebXR Performance Best Practices](https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/)
6. [Meta WebXR Fixed Foveated Rendering](https://developers.meta.com/horizon/documentation/web/webxr-ffr/)
7. [Meta Multiview WebGL Rendering](https://developers.meta.com/horizon/documentation/web/web-multiview/)
8. [glTF Transform](https://gltf-transform.dev/)
9. [glTF Transform textureCompress](https://gltf-transform.dev/modules/functions/functions/textureCompress)
