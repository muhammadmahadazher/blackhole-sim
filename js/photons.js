// ============================================================================
//  photons.js  —  Photon-path (null-geodesic) tracer for the teaching overlay.
//
//  Integrates the SAME Schwarzschild null geodesic as the renderer
//  (a = −1.5·h²·r/|r|⁵, in units rₛ = 1) for a fan of parallel photons with a
//  range of impact parameters b, in the equatorial (y = 0) plane. Each path is
//  classified by fate and returned as coloured 3D line segments:
//      captured  (b < b_c)  — plunges through the horizon        → red
//      critical  (b ≈ b_c)  — loops near the photon sphere        → violet
//      escaping  (b > b_c)  — deflected and flies past            → cyan
//  The critical impact parameter is b_c = 3√3·GM/c² = 1.5√3·rₛ ≈ 2.598 rₛ —
//  the very thing that sets the shadow edge.
// ============================================================================
window.BH = window.BH || {};

window.BH.Photons = (function () {
    "use strict";
    const RS = 1.0;
    const COL = {
        captured: [1.00, 0.36, 0.36],   // red
        critical: [0.66, 0.58, 1.00],   // violet
        escaping: [0.20, 0.86, 0.80]    // cyan
    };

    const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
    const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
    const mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
    const len = a => Math.hypot(a[0], a[1], a[2]);
    const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const norm = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    function accel(p, h2) {
        const r2 = p[0]*p[0]+p[1]*p[1]+p[2]*p[2];
        const r = Math.sqrt(r2);
        const k = -1.5 * h2 / (r2 * r2 * r);   // −1.5 h² / r⁵
        return [p[0]*k, p[1]*k, p[2]*k];
    }
    function rk4(p, v, dt, h2) {
        const a1 = accel(p, h2);
        const p2 = add(p, mul(v, dt/2)),  v2 = add(v, mul(a1, dt/2)), a2 = accel(p2, h2);
        const p3 = add(p, mul(v2, dt/2)), v3 = add(v, mul(a2, dt/2)), a3 = accel(p3, h2);
        const p4 = add(p, mul(v3, dt)),   v4 = add(v, mul(a3, dt)),   a4 = accel(p4, h2);
        return {
            p: [p[0]+dt/6*(v[0]+2*v2[0]+2*v3[0]+v4[0]), p[1]+dt/6*(v[1]+2*v2[1]+2*v3[1]+v4[1]), p[2]+dt/6*(v[2]+2*v2[2]+2*v3[2]+v4[2])],
            v: [v[0]+dt/6*(a1[0]+2*a2[0]+2*a3[0]+a4[0]), v[1]+dt/6*(a1[1]+2*a2[1]+2*a3[1]+a4[1]), v[2]+dt/6*(a1[2]+2*a2[2]+2*a3[2]+a4[2])]
        };
    }

    function trace(pos0, dir0, escapeR) {
        let p = pos0.slice(), v = norm(dir0);
        const L = [p[1]*v[2]-p[2]*v[1], p[2]*v[0]-p[0]*v[2], p[0]*v[1]-p[1]*v[0]];
        const h2 = dot(L, L);
        const pts = [p.slice()];
        let fate = "escaping", turn = 0;
        for (let i = 0; i < 2400; i++) {
            const r = len(p);
            const dt = clamp(0.06 * r, 0.02, 0.5);
            const prevV = v;
            const s = rk4(p, v, dt, h2); p = s.p; v = s.v;
            pts.push(p.slice());
            turn += Math.acos(clamp(dot(norm(prevV), norm(v)), -1, 1));
            const nr = len(p);
            if (nr < RS * 1.02) { fate = "captured"; break; }
            if (nr > escapeR && dot(p, v) > 0) { fate = "escaping"; break; }
        }
        if (fate === "escaping" && turn > Math.PI * 1.2) fate = "critical";
        return { pts, fate };
    }

    // Fan of parallel photons in the y=0 plane, coming in along −x with impact
    // parameter b offset along +z. (h = |b| for a unit-speed photon, so b is the
    // true impact parameter.)
    function compute(opts) {
        opts = opts || {};
        const n = Math.max(3, opts.rays || 21);
        const bMax = opts.bMax || 7.0;
        const startX = 42.0, escapeR = 64.0;
        const pos = [], col = [];
        for (let i = 0; i < n; i++) {
            const b = -bMax + (2 * bMax) * (i / (n - 1));
            const path = trace([startX, 0, b], [-1, 0, 0], escapeR);
            const c = COL[path.fate];
            for (let k = 0; k < path.pts.length - 1; k++) {
                const a = path.pts[k], d = path.pts[k + 1];
                pos.push(a[0], a[1], a[2], d[0], d[1], d[2]);
                col.push(c[0], c[1], c[2], c[0], c[1], c[2]);
            }
        }
        return { positions: new Float32Array(pos), colors: new Float32Array(col), count: pos.length / 3 };
    }

    return { compute, bCritical: 1.5 * Math.sqrt(3) };
})();
