// ============================================================================
//  blackhole.frag.js  —  Relativistic black-hole renderer (GLSL ES 3.00)
// ----------------------------------------------------------------------------
//  Physics implemented (see docs/PHYSICS.md for the full derivation + sources):
//
//   * Schwarzschild null geodesics.  Each pixel casts a photon and we
//     integrate its curved path with RK4.  Working in geometric units with
//     the Schwarzschild radius rs = 1, the photon obeys
//
//            d^2 r/dλ^2  =  -1.5 * h^2 * r / |r|^5
//
//     which is the cartesian form of the orbit equation
//            d^2u/dφ^2 + u = 3 M u^2     (u = 1/r,  3M = 1.5·rs).
//     h = |r × v| (specific angular momentum) is conserved along the ray.
//
//   * Event horizon at r = rs (=1)  -> photon captured -> black.
//   * Photon sphere at r = 1.5·rs   -> produces the photon ring naturally.
//   * Gravitational lensing of the background star field (Einstein ring).
//
//   * Thin accretion disk in the equatorial (y = 0) plane between the ISCO
//     and an outer edge, with:
//        - Shakura & Sunyaev (1973) flux profile  F ∝ r^-3 (1 - sqrt(r_in/r))
//        - blackbody colour from a colour-temperature curve
//        - relativistic Doppler beaming + frequency shift (approaching side
//          brighter & bluer — the iconic asymmetry)
//        - gravitational redshift  g = sqrt(1 - rs/r)
//        - sheared turbulent texture (Keplerian Ω ∝ r^-3/2)
//
//  Each physical effect has a toggle uniform so the renderer doubles as a
//  teaching tool.  Output is linear HDR (tone-mapping happens in composite).
// ============================================================================
window.BH = window.BH || {};
window.BH.shaders = window.BH.shaders || {};

window.BH.shaders.blackholeFrag = `#version 300 es
precision highp float;

in  vec2 vUv;
out vec4 fragColor;

// ---- camera ---------------------------------------------------------------
uniform vec2  uResolution;
uniform vec3  uCamPos;
uniform vec3  uCamRight;
uniform vec3  uCamUp;
uniform vec3  uCamForward;
uniform float uTanHalfFov;
uniform float uTime;

// ---- integrator -----------------------------------------------------------
uniform int   uSteps;       // max integration steps (quality)
uniform float uStepScale;   // multiplies the adaptive step size
uniform float uEscapeR;     // radius at which an outgoing ray is "free"

// ---- accretion disk -------------------------------------------------------
uniform float uDiskInner;   // inner edge (ISCO) in units of rs
uniform float uDiskOuter;   // outer edge
uniform float uDiskBright;
uniform float uDiskTemp;    // peak colour temperature (Kelvin)
uniform float uDiskAlpha;   // base opacity of the gas

// ---- physics effect toggles (0/1) ----------------------------------------
uniform float uDopplerShift;  // colour shift from orbital motion
uniform float uBeaming;       // brightness boost from orbital motion
uniform float uGravRedshift;  // gravitational redshift colour + dimming
uniform float uLensing;       // 1 = curved geodesics, 0 = straight rays (compare!)

// ---- background -----------------------------------------------------------
uniform float uBgBright;
uniform float uStarDensity;

// ---- infalling objects (thrown matter) ------------------------------------
const int MAX_OBJ = 16;
uniform int  uObjCount;
uniform vec3 uObjPos[MAX_OBJ];
uniform vec3 uObjCol[MAX_OBJ];
uniform vec4 uObjParam[MAX_OBJ];   // (radius, stretch, brightness, _)

// ---- geometry overlays (equatorial marker rings; get lensed for free) -----
uniform float uHorizonR;   // outer horizon r+ in units of rs
uniform float uPhotonR;    // photon sphere radius (rs)
uniform float uIscoR;      // ISCO radius (rs)
uniform float uOvHorizon;
uniform float uOvPhoton;
uniform float uOvISCO;
uniform float uOvErgo;
uniform float uAnnotate;   // master: faintly enables all rings

vec3 markerRing(float rd, float R, float on, vec3 col){
    float d = abs(rd - R);
    float e = smoothstep(0.07, 0.0, d) + 0.35 * smoothstep(0.16, 0.0, d);
    return col * e * 1.6 * clamp(on, 0.0, 1.0);
}

const float RS         = 1.0;          // Schwarzschild radius (our length unit)
const float PHOTON_R   = 1.5;          // photon sphere
const float PI         = 3.14159265359;
const int   MAX_STEPS  = 800;          // hard compile-time cap (> any quality budget)

// ===========================================================================
//  Hash / noise helpers (procedural texture + star field)
// ===========================================================================
float hash13(vec3 p3){
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3){
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float vnoise(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p);
    f = f*f*(3.0-2.0*f);
    float n000 = hash13(i+vec3(0,0,0)), n100 = hash13(i+vec3(1,0,0));
    float n010 = hash13(i+vec3(0,1,0)), n110 = hash13(i+vec3(1,1,0));
    float n001 = hash13(i+vec3(0,0,1)), n101 = hash13(i+vec3(1,0,1));
    float n011 = hash13(i+vec3(0,1,1)), n111 = hash13(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
               mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm(vec3 p){
    float v = 0.0, a = 0.5;
    for(int i=0;i<5;i++){ v += a*vnoise(p); p *= 2.02; a *= 0.5; }
    return v;
}

// ===========================================================================
//  Colour temperature -> linear RGB
//  (compact fit to the Planckian locus; warm < 6500K, cool > 6500K)
// ===========================================================================
vec3 blackbody(float t){
    t = clamp(t, 1000.0, 40000.0);
    mat3 m = (t <= 6500.0)
      ? mat3(0.0, -2902.1955373783176, -8257.7997278925690,
             0.0,  1669.5803561666639,  2575.2827530017594,
             1.0,  1.3302673723350029,  1.8993753891711275)
      : mat3(1745.0425298314172,  1216.6168361476490, -8257.7997278925690,
            -2666.3474220535695, -2173.1012343082230,  2575.2827530017594,
             0.55995389139931482, 0.70381203140554553, 1.8993753891711275);
    vec3 col = clamp(vec3(m[0] / (vec3(t) + m[1]) + m[2]), 0.0, 1.0);
    col = mix(col, vec3(1.0), smoothstep(1000.0, 0.0, t));
    // remove sRGB gamma -> linear, so HDR maths stays physical
    return pow(col, vec3(2.2));
}

// ===========================================================================
//  Procedural background: deep-space star field + faint Milky-Way nebula.
//  Sampled in the photon's FINAL (escape) direction, so it is automatically
//  gravitationally lensed by the curved path that produced that direction.
// ===========================================================================
// One layer of crisp star points.  The star's angular size is a fraction of
// the cell size (sz < cell), so a star and its small halo stay WITHIN one
// cell — neighbouring stars don't overlap into a uniform glow, and most of
// the sky stays black (as real deep space does).
vec3 starLayer(vec3 dir, float scale, float prob){
    vec3 p  = dir * scale;
    vec3 id = floor(p);
    vec3 col = vec3(0.0);
    float sz = 0.62 / scale;                 // star radius < cell size (1/scale)
    for(int x=-1;x<=1;x++)
    for(int y=-1;y<=1;y++)
    for(int z=-1;z<=1;z++){
        vec3 c = id + vec3(float(x), float(y), float(z));
        vec3 h = hash33(c + 13.7);
        if(h.x < prob){
            vec3 sp = c + 0.5 + (h - 0.5) * 0.7;
            vec3 sd = normalize(sp);
            float dd   = length(dir - sd);          // ~= angular distance
            float core = smoothstep(sz,        0.0, dd);
            float halo = smoothstep(sz * 1.8,  0.0, dd) * 0.05;
            float bright = mix(0.12, 1.6, h.z * h.z * h.z);  // few bright, many dim
            float tw = 0.70 + 0.30 * sin(uTime * (1.5 + h.y * 3.0) + h.z * 30.0); // twinkle
            vec3  sc = mix(vec3(0.75, 0.83, 1.0), vec3(1.0, 0.85, 0.62), h.y);
            col += sc * (core * tw + halo) * bright;
        }
    }
    return col;
}
vec3 background(vec3 dir){
    dir = normalize(dir);
    vec3 col = vec3(0.0);
    float dens = clamp(uStarDensity, 0.0, 2.0);
    col += starLayer(dir, 120.0, 0.13 * dens) * 1.00;   // bright nearby stars
    col += starLayer(dir, 300.0, 0.10 * dens) * 0.70;   // mid field
    col += starLayer(dir, 560.0, 0.08 * dens) * 0.45;   // faint dust (kept >1px)

    // faint galactic band + cool nebula clouds
    vec3 galN = normalize(vec3(0.35, 0.92, 0.18));
    float band = exp(-12.0 * abs(dot(dir, galN)));
    float neb  = fbm(dir * 3.5 + 11.0);
    neb = smoothstep(0.45, 0.95, neb);
    vec3 nebCol = mix(vec3(0.05,0.07,0.13), vec3(0.16,0.10,0.16), fbm(dir*6.0));
    col += nebCol * (0.18 * band + 0.05) * neb;
    col += vec3(0.012, 0.016, 0.03);   // very dim ambient sky
    return col;
}

// ===========================================================================
//  Geodesic acceleration (Schwarzschild, units rs = 1).
//  a = -1.5 * h^2 * r / |r|^5
// ===========================================================================
vec3 accel(vec3 pos, float h2){
    float r2 = dot(pos, pos);
    float r  = sqrt(r2);
    float invR5 = 1.0 / (r2 * r2 * r);
    return -1.5 * h2 * pos * invR5;
}

// ===========================================================================
//  Accretion-disk emission at an equatorial-plane crossing.
//    hit       : crossing point (y ~ 0)
//    rd        : in-plane radius
//    photonDir : marching direction (observer -> emitter)
//  Returns linear RGB radiance already corrected for all enabled effects.
// ===========================================================================
vec3 diskEmission(vec3 hit, float rd, vec3 photonDir, out float opacity){
    float x = uDiskInner / rd;                       // in (0,1)
    // Shakura-Sunyaev flux shape (no-torque inner boundary):
    float flux = (1.0 - sqrt(x)) * x*x*x;            // ∝ r^-3 (1 - sqrt(r_in/r))
    flux = max(flux, 0.0);
    // temperature shape T ∝ F^(1/4), normalised so the peak ≈ 1
    float Tshape = pow(flux, 0.25) / 0.488;

    // local blackbody colour
    float Tkelvin = uDiskTemp * clamp(Tshape, 0.0, 1.4) + 1200.0;

    // ----- relativistic kinematics of the orbiting gas --------------------
    // circular-orbit speed (local static observer):  beta = sqrt(M/(r-2M))
    float M = 0.5 * RS;
    float beta = sqrt(max(M / (rd - RS), 0.0));
    beta = min(beta, 0.95);
    // prograde tangential direction in the y=0 plane (CCW about +y)
    vec3 vdir = normalize(vec3(-hit.z, 0.0, hit.x));
    vec3 vel  = beta * vdir;
    // unit vector emitter -> observer (photon arrived travelling +photonDir,
    // so observer lies in -photonDir from the emission point)
    vec3 nObs = normalize(-photonDir);
    float gamma = 1.0 / sqrt(1.0 - beta*beta);
    float doppler = 1.0 / (gamma * (1.0 - dot(vel, nObs)));   // δ  (>1 approaching)

    // gravitational redshift (emitted->observed frequency ratio)
    float grav = sqrt(max(1.0 - RS / rd, 1e-4));

    // combined frequency ratio observed/emitted
    float shift = 1.0;
    if(uDopplerShift  > 0.5) shift *= doppler;
    if(uGravRedshift  > 0.5) shift *= grav;

    // colour follows the frequency shift (Wien): higher freq -> hotter/bluer
    float Tobs = Tkelvin * mix(1.0, shift, 0.85);
    vec3 col = blackbody(Tobs);

    // intensity: normalised thermal flux (peak ~1 near 1.36 r_in), with HDR
    // headroom so the bright inner disk blooms.
    float bright = flux / 0.0568;                                            // ~0..1
    float intensity = bright * 1.8;
    if(uBeaming      > 0.5) intensity *= pow(clamp(doppler, 0.05, 6.0), 3.0); // δ^3 beaming
    if(uGravRedshift > 0.5) intensity *= grav*grav;                          // dimming

    // ----- turbulent, sheared gas texture ---------------------------------
    float ang = atan(hit.z, hit.x);
    float omega = sqrt(M / (rd*rd*rd));              // Keplerian angular vel
    float swirl = ang + omega * uTime * 6.0;
    float tex = fbm(vec3(cos(swirl)*rd, sin(swirl)*rd, rd*0.7) * 1.6
                    + vec3(0.0, 0.0, uTime*0.05));
    // finer sheared filaments for a more detailed, living disk
    float fine = vnoise(vec3(cos(swirl)*rd, sin(swirl)*rd, rd) * 5.5 + uTime*0.12);
    float turb = mix(0.5, 1.4, tex) * (0.82 + 0.34 * fine);

    // soft radial taper at both edges
    float edge = smoothstep(uDiskInner, uDiskInner*1.18, rd)
               * (1.0 - smoothstep(uDiskOuter*0.85, uDiskOuter, rd));

    opacity = clamp(uDiskAlpha * edge * (0.5 + 0.7*tex), 0.0, 1.0);
    return col * intensity * turb * edge * uDiskBright;
}

// ===========================================================================
//  Main: cast and integrate one photon per pixel.
// ===========================================================================
void main(){
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    vec3 dir = normalize(uCamForward
                       + uv.x * uTanHalfFov * uCamRight
                       + uv.y * uTanHalfFov * uCamUp);

    vec3 pos = uCamPos;
    vec3 vel = dir;

    // conserved specific angular momentum of this ray
    vec3 Lvec = cross(pos, vel);
    float h2  = dot(Lvec, Lvec);

    vec4 acc = vec4(0.0);     // accumulated disk colour (rgb) + coverage (a)
    vec3 emit = vec3(0.0);    // emissive infalling objects (lensed)
    bool captured = false;

    for(int i=0; i<MAX_STEPS; i++){
        if(i >= uSteps) break;

        float r = length(pos);

        // adaptive step: fine near the hole, coarse far away
        float dt = uStepScale * clamp(0.09 * r, 0.012, 0.55);

        vec3 prevPos = pos;

        if(uLensing > 0.5){
            // ---- RK4 step of the curved geodesic ----
            vec3 k1x = vel,                    k1v = accel(pos,               h2);
            vec3 k2x = vel + 0.5*dt*k1v,       k2v = accel(pos + 0.5*dt*k1x,  h2);
            vec3 k3x = vel + 0.5*dt*k2v,       k3v = accel(pos + 0.5*dt*k2x,  h2);
            vec3 k4x = vel + dt*k3v,           k4v = accel(pos + dt*k3x,      h2);
            pos += dt/6.0 * (k1x + 2.0*k2x + 2.0*k3x + k4x);
            vel += dt/6.0 * (k1v + 2.0*k2v + 2.0*k3v + k4v);
        } else {
            // ---- straight ray (flat space) for A/B comparison ----
            pos += vel * dt;
        }

        // event horizon
        if(length(pos) < RS){ captured = true; break; }

        // equatorial-plane (y = 0) crossing: accretion disk + geometry rings
        if(prevPos.y * pos.y <= 0.0 && prevPos.y != pos.y){
            float t   = prevPos.y / (prevPos.y - pos.y);
            vec3  hit = mix(prevPos, pos, t);
            float rd  = length(vec3(hit.x, 0.0, hit.z));
            if(acc.a < 0.99 && rd > uDiskInner && rd < uDiskOuter){
                float op;
                vec3 em = diskEmission(hit, rd, normalize(vel), op);
                acc.rgb += (1.0 - acc.a) * em;   // front-to-back compositing
                acc.a   += (1.0 - acc.a) * op;
            }
            // geometry overlay rings (lensed automatically; independent of disk)
            vec3 mk = vec3(0.0);
            mk += markerRing(rd, uHorizonR, max(uOvHorizon, uAnnotate), vec3(0.62, 0.56, 1.0));
            mk += markerRing(rd, uPhotonR,  max(uOvPhoton,  uAnnotate), vec3(0.40, 0.92, 1.0));
            mk += markerRing(rd, uIscoR,    max(uOvISCO,    uAnnotate), vec3(1.00, 0.72, 0.22));
            mk += markerRing(rd, 1.0,       max(uOvErgo,    uAnnotate), vec3(1.00, 0.40, 0.62));
            emit += (1.0 - acc.a) * mk;
        }

        // ---- infalling objects: lensed, tidally stretched, redshifted ----
        for(int k = 0; k < MAX_OBJ; k++){
            if(k >= uObjCount) break;
            vec3 op = uObjPos[k];
            vec4 pp = uObjParam[k];                  // radius, stretch, brightness
            // distance from this march SEGMENT to the object (robust to step size)
            vec3 ab = pos - prevPos;
            float abl = max(dot(ab, ab), 1e-6);
            float tt = clamp(dot(op - prevPos, ab) / abl, 0.0, 1.0);
            vec3 cp = prevPos + tt * ab;
            vec3 dd = cp - op;
            // anisotropic metric -> radial stretching (spaghettification)
            vec3 radDir = op / max(length(op), 1e-3);
            float along = dot(dd, radDir);
            vec3  perp  = dd - along * radDir;
            float st = max(pp.y, 1.0);
            float dist = sqrt(along*along/(st*st) + dot(perp, perp));
            float oe = smoothstep(pp.x, 0.0, dist);
            emit += uObjCol[k] * pp.z * oe * (1.0 - acc.a);
        }

        // escaped to "infinity"
        if(r > uEscapeR && dot(pos, vel) > 0.0) break;
    }

    vec3 color = acc.rgb + emit;
    if(!captured){
        vec3 bg = background(vel) * uBgBright;
        color += (1.0 - acc.a) * bg;
    }
    // (captured photons contribute only whatever disk light was picked up
    //  in front of the horizon -> the central "shadow" emerges for free.)

    fragColor = vec4(color, 1.0);
}
`;
