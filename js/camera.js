// ============================================================================
//  camera.js  —  360° orbit camera around the black hole
//    * left-drag    : orbit (azimuth + elevation) — see it from any angle
//    * wheel / pinch: dolly in/out
//    * release      : momentum / inertia (it keeps gliding, then settles)
//    * intro        : eases in from far away on load
//    * smooth damping + optional auto-rotate
//  The camera always looks at the origin (the black hole sits at 0,0,0).
//  It outputs an orthonormal basis (right, up, forward) for the ray shader.
// ============================================================================
window.BH = window.BH || {};

window.BH.Camera = function (canvas) {
    "use strict";

    const state = {
        radius: 70.0,            // start far away for an intro fly-in
        minR: 2.6, maxR: 220.0,
        azimuth: 0.7,
        elevation: 0.22,
        // damped targets
        tRadius: 22.0, tAzimuth: 0.7, tElevation: 0.22,
        // inertia
        velAz: 0.0, velEl: 0.0,
        fovDeg: 60.0,
        autoRotate: false,
        autoSpeed: 0.05,
        damp: 0.12
    };

    let dragging = false, lastX = 0, lastY = 0;
    let pinchDist = 0;

    const EL_LIMIT = Math.PI / 2 - 0.02;

    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

    // ---- pointer / mouse ----------------------------------------------------
    canvas.addEventListener("mousedown", (e) => {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        state.velAz = state.velEl = 0;
    });
    window.addEventListener("mouseup", () => { dragging = false; });
    window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        state.tAzimuth -= dx * 0.005;
        state.tElevation = clamp(state.tElevation + dy * 0.005, -EL_LIMIT, EL_LIMIT);
        // record velocity for release inertia
        state.velAz = -dx * 0.30;
        state.velEl = dy * 0.30;
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const f = Math.exp(e.deltaY * 0.0011);
        state.tRadius = clamp(state.tRadius * f, state.minR, state.maxR);
    }, { passive: false });

    // ---- touch (mobile) -----------------------------------------------------
    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
            state.velAz = state.velEl = 0;
        } else if (e.touches.length === 2) {
            pinchDist = touchDist(e);
        }
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && dragging) {
            const dx = e.touches[0].clientX - lastX, dy = e.touches[0].clientY - lastY;
            lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
            state.tAzimuth -= dx * 0.006;
            state.tElevation = clamp(state.tElevation + dy * 0.006, -EL_LIMIT, EL_LIMIT);
            state.velAz = -dx * 0.36;
            state.velEl = dy * 0.36;
        } else if (e.touches.length === 2) {
            const d = touchDist(e);
            if (pinchDist > 0) state.tRadius = clamp(state.tRadius * (pinchDist / d), state.minR, state.maxR);
            pinchDist = d;
        }
    }, { passive: false });
    canvas.addEventListener("touchend", () => { dragging = false; pinchDist = 0; });

    function touchDist(e) {
        const a = e.touches[0], b = e.touches[1];
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    // ---- per-frame update ---------------------------------------------------
    function update(dt) {
        // momentum after release
        if (!dragging) {
            state.tAzimuth += state.velAz * dt;
            state.tElevation = clamp(state.tElevation + state.velEl * dt, -EL_LIMIT, EL_LIMIT);
            const decay = Math.pow(0.86, dt * 60.0);
            state.velAz *= decay;
            state.velEl *= decay;
        }
        if (state.autoRotate && !dragging) state.tAzimuth += state.autoSpeed * dt;

        const k = 1.0 - Math.pow(1.0 - state.damp, dt * 60.0);
        state.radius    += (state.tRadius    - state.radius)    * k;
        state.azimuth   += (state.tAzimuth   - state.azimuth)   * k;
        state.elevation += (state.tElevation - state.elevation) * k;

        const ce = Math.cos(state.elevation), se = Math.sin(state.elevation);
        const ca = Math.cos(state.azimuth),   sa = Math.sin(state.azimuth);
        const pos = [
            state.radius * ce * sa,
            state.radius * se,
            state.radius * ce * ca
        ];

        const forward = normalize([-pos[0], -pos[1], -pos[2]]);
        let right = normalize(cross(forward, [0, 1, 0]));
        if (!isFinite(right[0])) right = [1, 0, 0];
        const up = cross(right, forward);

        const tanHalfFov = Math.tan((state.fovDeg * Math.PI / 180) * 0.5);
        return { pos, right, up, forward, tanHalfFov, radius: state.radius };
    }

    function cross(a, b) {
        return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    }
    function normalize(v) {
        const l = Math.hypot(v[0], v[1], v[2]) || 1;
        return [v[0]/l, v[1]/l, v[2]/l];
    }

    return {
        update,
        state,
        setFov: (d) => { state.fovDeg = d; },
        setAutoRotate: (b) => { state.autoRotate = b; },
        setAutoSpeed: (s) => { state.autoSpeed = s; },
        reset: () => {
            state.tRadius = 22.0; state.tAzimuth = 0.7; state.tElevation = 0.22;
            state.velAz = state.velEl = 0;
        }
    };
};
