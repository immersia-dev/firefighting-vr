/**
 * Component: simple-navmesh-constraint
 * Category: movement
 * Description:
 *   Constrains an entity to walkable areas defined by a navmesh.
 *   Adjusts position on each frame based on raycasting patterns, preventing the
 *   user from falling off, clipping through edges, or walking outside valid surfaces.
 *
 * Usage:
 *   <a-entity
 *     wasd-controls
 *     simple-navmesh-constraint="navmesh: #navmesh;"
 *   ></a-entity>
 *
 * Properties:
 *   enabled   (boolean) – Enables or disables the constraint. Default: true.
 *   navmesh   (selector) – Selector pointing to one or more navmesh objects.
 *   fall      (number) – Maximum fall distance allowed. Default: 0.5.
 *   height    (number) – Entity height used to offset raycasts. Default: 1.6.
 *   exclude   (selector) – Objects to ignore in ray intersections.
 *   xzOrigin  (selector) – Optional internal object used for origin sampling.
 *
 * Notes:
 *   - Uses multiple angled raycasts to avoid sticking on mesh edges.
 *   - Avoids polluting the code with inline comments for consistency.
 *   - Designed to work well with locomotion components (WASD, joystick, etc.).
 */
AFRAME.registerComponent('simple-navmesh-constraint', {
  schema: {
    enabled: { default: true },
    navmesh: { default: '' },
    fall: { default: 0.5 },
    height: { default: 1.6 },
    exclude: { default: '' },
    xzOrigin: { default: '' },
  },

  update() {
    this.lastPosition = null;
    this.excludes = this.data.exclude ? Array.from(document.querySelectorAll(this.data.exclude)) : [];

    const els = Array.from(document.querySelectorAll(this.data.navmesh));
    this.objects =
      els && els.length ? els.map(el => el.object3D).concat(this.excludes.map(el => el.object3D)) : [];
    this.xzOrigin = this.data.xzOrigin ? this.el.querySelector(this.data.xzOrigin) : this.el;
  },

  tick: (function () {
    const nextPosition = new THREE.Vector3();
    const tempVec = new THREE.Vector3();
    const scanPattern = [
      [0, 1],
      [0, 0.5],
      [30, 0.4],
      [-30, 0.4],
      [60, 0.2],
      [-60, 0.2],
      [80, 0.06],
      [-80, 0.06],
    ];

    const down = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster();
    const gravity = -1;
    const maxYVelocity = 0.5;
    const results = [];
    let yVel = 0;
    let firstTry = true;

    return function tick(time, delta) {
      if (!this.data.enabled) return;
      if (this.lastPosition === null) {
        firstTry = true;
        this.lastPosition = new THREE.Vector3();
        this.xzOrigin.object3D.getWorldPosition(this.lastPosition);
        if (this.data.xzOrigin) {
          this.lastPosition.y -= this.xzOrigin.object3D.position.y;
        }
      }
      if (this.objects.length === 0) return;

      this.xzOrigin.object3D.getWorldPosition(nextPosition);
      if (this.data.xzOrigin) {
        nextPosition.y -= this.xzOrigin.object3D.position.y;
      }
      if (nextPosition.distanceTo(this.lastPosition) <= 0.01) return;

      let didHit = false;

      scanPatternLoop: for (const [angle, distance] of scanPattern) {
        tempVec.subVectors(nextPosition, this.lastPosition);
        tempVec.applyAxisAngle(down, (angle * Math.PI) / 180);
        tempVec.multiplyScalar(distance);
        tempVec.add(this.lastPosition);
        tempVec.y += maxYVelocity;
        tempVec.y -= this.data.height;

        raycaster.set(tempVec, down);
        raycaster.far = this.data.fall > 0 ? this.data.fall + maxYVelocity : Infinity;
        raycaster.intersectObjects(this.objects, true, results);

        if (results.length) {
          for (const result of results) {
            if (this.excludes.includes(result.object.el)) {
              results.splice(0);
              continue scanPatternLoop;
            }
          }

          const hitPos = results[0].point;
          results.splice(0);
          hitPos.y += this.data.height;

          if (nextPosition.y - (hitPos.y - yVel * 2) > 0.01) {
            yVel += Math.max(gravity * delta * 0.001, -maxYVelocity);
            hitPos.y = nextPosition.y + yVel;
          } else {
            yVel = 0;
          }

          tempVec.copy(hitPos);
          this.xzOrigin.object3D.parent.worldToLocal(tempVec);
          tempVec.sub(this.xzOrigin.object3D.position);

          if (this.data.xzOrigin) {
            tempVec.y += this.xzOrigin.object3D.position.y;
          }

          this.el.object3D.position.add(tempVec);
          this.lastPosition.copy(hitPos);
          didHit = true;
          break;
        }
      }

      if (didHit) {
        firstTry = false;
      }

      if (!firstTry && !didHit) {
        this.el.object3D.position.copy(this.lastPosition);
        this.el.object3D.parent.worldToLocal(this.el.object3D.position);
      }
    };
  })(),
});
