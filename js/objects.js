// ============================================================================
//  objects.js  —  Infalling matter you can throw into the black hole.
//
//  Each object is a test particle integrated (RK4) along a Schwarzschild
//  trajectory.  We use the Newtonian gravity plus the leading general-
//  relativistic correction term, which reproduces the key behaviours:
//      a = -(M/r³)(1 + 3h²/r²) · r        (h = |r × v|, the angular momentum)
//  The 3h²/r² term steepens gravity near the hole, so anything that comes
//  inside the ISCO spirals in and *plunges* — there are no stable close orbits.
//
//  As an object approaches the horizon we also model what a DISTANT observer
//  sees:  it stretches radially (tidal spaghettification), reddens and dims
//  (gravitational redshift  g = √(1 − rs/r)), and appears to freeze at the
//  horizon, fading to black — it never visibly crosses.
//
//  Positions/colours/shape are handed to the GPU each frame; the ray-tracer
//  then renders the objects *through the curved spacetime*, so they are
//  gravitationally lensed and vanish behind the shadow for free.
// ============================================================================
window.BH = window.BH || {};

window.BH.Objects = function () {
    "use strict";
    const MAXOBJ = 16;
    const RS = 1.0, M = 0.5;

    let objs = [];
    const cfg = { speed: 7.0, timeScale: 2.5, radius: 0.45, bright: 2.6 };
    let hue = 0.1;

    // -- small vec helpers --
    const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
    const mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
    const len = (a) => Math.hypot(a[0], a[1], a[2]);
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const smooth = (e0, e1, x) => { const t = clamp((x-e0)/(e1-e0), 0, 1); return t*t*(3-2*t); };
    function hsv(h, s, v) {
        const i = Math.floor(h*6), f = h*6-i, p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
        const m = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];
        return m;
    }

    function accel(p, v) {
        const r2 = p[0]*p[0]+p[1]*p[1]+p[2]*p[2];
        const r = Math.sqrt(r2);
        const Lx = p[1]*v[2]-p[2]*v[1], Ly = p[2]*v[0]-p[0]*v[2], Lz = p[0]*v[1]-p[1]*v[0];
        const h2 = Lx*Lx+Ly*Ly+Lz*Lz;
        const f = -(M/(r2*r)) * (1 + 3*h2/r2);   // Newtonian + GR correction
        return [p[0]*f, p[1]*f, p[2]*f];
    }
    function rk4(o, dt) {
        const p = o.pos, v = o.vel;
        const a1 = accel(p, v);
        const p2 = add(p, mul(v, dt/2)),  v2 = add(v, mul(a1, dt/2)), a2 = accel(p2, v2);
        const p3 = add(p, mul(v2, dt/2)), v3 = add(v, mul(a2, dt/2)), a3 = accel(p3, v3);
        const p4 = add(p, mul(v3, dt)),   v4 = add(v, mul(a3, dt)),   a4 = accel(p4, v4);
        o.pos = [ p[0]+dt/6*(v[0]+2*v2[0]+2*v3[0]+v4[0]),
                  p[1]+dt/6*(v[1]+2*v2[1]+2*v3[1]+v4[1]),
                  p[2]+dt/6*(v[2]+2*v2[2]+2*v3[2]+v4[2]) ];
        o.vel = [ v[0]+dt/6*(a1[0]+2*a2[0]+2*a3[0]+a4[0]),
                  v[1]+dt/6*(a1[1]+2*a2[1]+2*a3[1]+a4[1]),
                  v[2]+dt/6*(a1[2]+2*a2[2]+2*a3[2]+a4[2]) ];
    }

    function spawn(pos, dir, speed) {
        if (objs.length >= MAXOBJ) objs.shift();
        const s = speed || cfg.speed;
        hue = (hue + 0.27) % 1;
        const off = 3.5;   // launch a few units ahead so it isn't on top of the camera
        objs.push({
            pos: [pos[0] + dir[0]*off, pos[1] + dir[1]*off, pos[2] + dir[2]*off],
            vel: [dir[0]*s, dir[1]*s, dir[2]*s],
            baseCol: hsv(hue, 0.55, 1.0),
            radius: cfg.radius,
            stretch: 1,
            state: "fall",
            freeze: 0
        });
    }

    function enterFreeze(o) {
        // Park the object just outside the horizon: a distant observer sees
        // infalling matter asymptotically freeze there and redshift away.
        o.state = "freeze";
        const r = Math.max(len(o.pos), 1e-3);
        const k = (RS * 1.12) / r;
        o.pos = mul(o.pos, k);
        o.vel = [0, 0, 0];
        o.stretch = 6.0;
        o.freeze = 0;
    }
    function update(dt) {
        const sdt = Math.min(dt, 0.05) * cfg.timeScale;
        for (const o of objs) {
            if (o.state === "fall") {
                const r = len(o.pos), speed = len(o.vel);
                // adaptive sub-steps: cap motion to ~6% of current radius per step
                // so RK4 stays stable (and energy-conserving) through the steep
                // near-hole potential instead of flinging the particle away.
                let sub = Math.ceil((speed * sdt) / (0.06 * Math.max(r, 0.4)));
                sub = Math.min(Math.max(sub, 1), 80);
                let captured = false;
                for (let i = 0; i < sub; i++) {
                    rk4(o, sdt / sub);
                    if (len(o.pos) < RS * 1.5) { enterFreeze(o); captured = true; break; }
                }
                if (!captured) {
                    const nr = len(o.pos);
                    o.stretch = 1 + clamp(4.0 - nr, 0, 7) * 1.5;   // tidal stretching
                    if (nr > 95) o.dead = true;                    // flew past & escaped
                }
            } else {                                    // frozen, fading to black
                o.freeze += dt;
            }
        }
        objs = objs.filter(o => !o.dead && !(o.state === "freeze" && o.freeze > 1.8));
    }

    // pack current state into typed arrays for the shader
    const posA = new Float32Array(MAXOBJ * 3);
    const colA = new Float32Array(MAXOBJ * 3);
    const parA = new Float32Array(MAXOBJ * 4);     // (radius, stretch, brightness, _)
    function uniforms() {
        objs.forEach((o, i) => {
            const r = Math.max(len(o.pos), RS * 1.001);
            const grav = Math.sqrt(Math.max(1 - RS / r, 0.02));      // gravitational redshift
            let bright = cfg.bright * grav;
            if (o.state === "freeze") bright *= Math.max(0, 1 - o.freeze / 1.8);
            const redMix = Math.max(smooth(1.0, 3.0, r) < 1 ? (1 - smooth(1.0, 3.0, r)) : 0,
                                    o.state === "freeze" ? 0.75 : 0);
            const c = o.baseCol;
            const col = [ c[0]*(1-redMix)+1.0*redMix, c[1]*(1-redMix)+0.13*redMix, c[2]*(1-redMix)+0.02*redMix ];
            posA.set(o.pos, i*3);
            colA.set(col, i*3);
            parA.set([o.radius, o.stretch, bright, 0], i*4);
        });
        return { count: objs.length, pos: posA, col: colA, par: parA };
    }

    return {
        spawn, update, uniforms,
        clear: () => { objs = []; },
        setConfig: (k, v) => { if (k in cfg) cfg[k] = v; },
        get count() { return objs.length; },
        MAXOBJ
    };
};
