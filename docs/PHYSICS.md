# The Physics Behind the Simulation

This document explains, effect by effect, what the renderer computes and the
research it is grounded in. The goal is a visualization that is *physically
faithful where it can be in real time*, and *honest about its approximations*
where it can't.

All the heavy physics lives in [`shaders/blackhole.frag.js`](../shaders/blackhole.frag.js).

---

## 1. Units and geometry

We work in **geometric units** (`G = c = 1`) and set the **Schwarzschild radius
`rₛ = 1`** as the length unit. With `rₛ = 2M`, the mass is `M = ½`. The
characteristic radii then sit at clean values:

| Feature | Radius (Schwarzschild) | In our units (`rₛ = 1`) |
|--------|------------------------|--------------------------|
| Event horizon | `rₛ = 2M` | **1.0** |
| Photon sphere | `1.5 rₛ = 3M` | **1.5** |
| ISCO (non-spinning) | `3 rₛ = 6M` | **3.0** |

The black hole sits at the origin; the accretion disk lies in the equatorial
(`y = 0`) plane.

---

## 2. Light bending: null geodesics

A photon near a black hole does not travel in a straight line — it follows a
**null geodesic** of curved spacetime. For the Schwarzschild metric, the path
of light obeys the orbit equation (with `u = 1/r`):

```
d²u/dφ²  +  u  =  3 M u²
```

The left side is the flat-space (Newtonian) result; the `3Mu²` term is the
general-relativistic correction that bends light. ([Standard result — see e.g.
the derivation context here.](https://arxiv.org/pdf/1911.05311))

To integrate this efficiently per-pixel, we use the equivalent **Cartesian
form**. A photon at position **r** with velocity **v** has a conserved specific
angular momentum `h = |r × v|`, and its trajectory satisfies

```
d²r/dλ²  =  -1.5 · h² · r / |r|⁵          (with rₛ = 1, since 3M = 1.5)
```

We advance each ray with a **4th-order Runge–Kutta (RK4)** step and an
*adaptive step size* (fine near the hole, coarse far away). This is the same
acceleration-based formulation used in well-known real-time geodesic ray
tracers. ([overview of the approach](https://eliot1019.github.io/Black-Hole-Raytracer/))

**In the app:** the *Gravitational lensing* toggle switches between this curved
integration and straight rays — a direct before/after of general relativity.

---

## 3. The shadow and the photon ring

As we march a ray from the camera:

- If it reaches `r < rₛ`, the photon is **captured** → that pixel is black.
- If it escapes to large `r`, we sample the background sky in its final
  (bent) direction.

Two famous features emerge **for free** from this integration:

- **The shadow** — the central dark region. It is *larger* than the horizon
  (apparent radius ≈ `√27/2 · rₛ ≈ 2.6 rₛ`) because lensing wraps the horizon's
  silhouette outward.
- **The photon ring** — a bright, thin ring at the shadow's edge made of photons
  that looped around the **photon sphere** (`1.5 rₛ`) one or more times before
  escaping. This is exactly the ring the Event Horizon Telescope resolved.

---

## 4. Black-hole spin and the ISCO

Real black holes spin. Full **Kerr** photon dynamics (frame dragging,
non-planar orbits) are expensive for real time, so this simulation integrates
**Schwarzschild** photon paths but models spin's most visible *disk* signature:
**the inner edge of the disk moves inward as spin increases.**

Matter can't orbit stably inside the **Innermost Stable Circular Orbit (ISCO)**.
The ISCO radius for a prograde orbit comes from
**Bardeen, Press & Teukolsky (1972)**:

```
Z₁ = 1 + (1−a²)^⅓ [ (1+a)^⅓ + (1−a)^⅓ ]
Z₂ = √(3a² + Z₁²)
r_isco / M = 3 + Z₂ − √[(3 − Z₁)(3 + Z₁ + 2Z₂)]
```

with `a = a*` the dimensionless spin in `[0, 1)`. It runs from `6M` (= `3 rₛ`)
at `a* = 0` down toward `1M` for a maximally spinning hole — so high-spin disks
reach closer in, where the gas is hotter and brighter. The app computes this
live (`ui.js`) and displays the resulting ISCO.

---

## 5. The accretion disk

The disk is a geometrically thin, optically thick disk in the equatorial plane,
detected by **equatorial-plane crossings** of each ray (which is why the lensed
*top and underside* of the disk both appear, arcing over and under the shadow).

### 5.1 Temperature & brightness — Shakura–Sunyaev (1973)

The first comprehensive accretion-disk theory, **Shakura & Sunyaev (1973)**
(relativistic version: **Novikov & Thorne 1973 / Page & Thorne 1974**), gives
the local energy flux of a thin disk with a no-torque inner boundary:

```
F(r)  ∝  r⁻³ · (1 − √(r_in / r))
```

The local surface temperature follows from Stefan–Boltzmann, `T ∝ F^¼`, so
`T ∝ r^(−3/4)` far from the edge. The flux peaks near `r ≈ 1.36 r_in`, then
falls off — this produces the characteristic bright inner ring with a darker
inner gap and a cooler, redder outer disk.

### 5.2 Colour — blackbody

Each disk element radiates as a **blackbody** at its local temperature. We map
temperature → RGB with a compact fit to the Planckian locus (hot inner regions
white/blue, cooler outer regions orange/red).

### 5.3 Relativistic effects on the disk

The disk gas orbits at relativistic speed. For a Schwarzschild circular orbit
the speed measured by a local static observer is

```
β = √( M / (r − 2M) )       ⇒  β = 0.5 c at the ISCO (r = 6M)
```

Three effects then act on the light we receive (each independently toggleable):

- **Relativistic Doppler beaming** — the side of the disk rotating *toward* us
  is strongly brightened; the receding side dims. The observed intensity scales
  as `δ³` where `δ = 1 / (γ(1 − β·n̂))` is the Doppler factor. This is the
  pronounced **brightness asymmetry** seen in the EHT images and in *Interstellar*.
- **Doppler colour shift** — the approaching side is blueshifted, the receding
  side redshifted (colour follows the frequency ratio `δ`).
- **Gravitational redshift** — light climbing out of the gravitational well
  loses energy by `g = √(1 − rₛ/r)`, reddening and dimming the innermost disk.

The combination — a symmetric ring of gas rendered **asymmetric** purely by
relativity — is exactly the insight of **Luminet (1979)**, who produced the
first simulated image of a black-hole accretion disk.
([an illustrated history of black-hole imaging](https://arxiv.org/pdf/1902.11196))

A sheared turbulence texture (Keplerian `Ω ∝ r^(−3/2)`, so inner gas laps the
outer) is layered on top for a living, churning look.

---

## 6. The background sky and lensing

The sky is a procedural multi-layer star field plus a faint galactic band and
nebula. Because each star is sampled in the photon's **final bent direction**,
the entire background is automatically **gravitationally lensed** — stars near
the line of sight to the hole smear into arcs and the **Einstein ring**.

---

## 7. Rendering pipeline

1. **Geodesic pass** → linear HDR scene (`RGBA16F`).
2. **Bright-pass + Gaussian bloom** (the disk and photon ring glow like real
   over-exposed astronomical imagery).
3. **Composite** → ACES filmic tone-mapping, exposure, vignette, gamma.

---

## 8. Approximations & limitations (honesty section)

This is a real-time visualization, not a research GRMHD code. Knowingly
simplified:

- **Photon paths are Schwarzschild, not Kerr.** Spin affects the disk's inner
  edge (ISCO) and orbital velocities, but *not* photon frame-dragging, so the
  shadow stays circular instead of becoming the slightly D-shaped Kerr shadow.
- **Thin, optically-thick disk.** No volumetric/optically-thin emission, no
  radiative transfer, no synchrotron spectrum — emission is treated as local
  blackbody with relativistic boosting.
- **No light travel-time delays** across the disk, no secondary thermal
  reverberation, no polarization.
- The **beaming exponent** (`δ³`) and temperature/colour mapping are tuned for a
  plausible, legible image rather than absolute photometric calibration.
- The starfield is procedural, not a real astrometric catalog.

These keep it interactive at 30–60 fps while preserving the *qualitatively
correct* relativistic appearance.

---

## 9. Real black holes (for the presets)

| Object | Mass | Notable measurement | Distance |
|--------|------|---------------------|----------|
| **Sgr A\*** (Milky Way) | (4.297 ± 0.012) × 10⁶ M☉ (GRAVITY 2022) | Ring **51.8 ± 2.3 μas**; inferred shadow ~48.7 μas (EHT 2022) | 8277 pc ≈ **27,000 ly** |
| **M87\*** | (6.5 ± 0.7) × 10⁹ M☉ | Ring **42 ± 3 μas** (EHT 2019) | 16.8 Mpc ≈ **54.8 Mly** |
| **Cygnus X-1** | 21.2 ± 2.2 M☉, high spin | X-ray binary (Miller-Jones 2021) | ~7,240 ly |
| **GW150914 remnant** | 62 M☉, a* ≈ 0.67 | First GW detection (LIGO 2016) | ~1.3 Gly |
| **GW190521 remnant** | ~142 M☉ (intermediate-mass) | LIGO/Virgo 2020 | ~17 Gly |
| **TON 618** | ~6.6 × 10¹⁰ M☉ | Ultramassive quasar | ~10.4 Gly |
| **Gargantua** (*Interstellar*) | ~10⁸ M☉ (fictional), a* ≈ 0.999 | Rendered with DNGR | — |

> **Shadow vs ring.** What the EHT *measures* is the bright **emission ring**;
> the **shadow** (critical curve) is the dark interior, slightly smaller. The
> app shows the theoretical shadow `6√3·GM/(c²D)` and θ_g, while each preset's
> citation carries the EHT-measured ring for direct comparison. A lovely
> consequence: M87* and Sgr A* differ ~1500× in mass yet look nearly the same
> size, because mass and distance almost cancel (θ_g[µas] = 0.0322·(M/M☉)/(D/ly)).

---

## 10. The Explorer: real units, Kerr geometry & thermodynamics

The interactive build (`js/physics.js`) computes, live, from **{mass, spin a\*,
inclination, distance, accretion rate}**:

**Geometry (Kerr).** Outer horizon `r₊ = M(1+√(1−a*²))`; ergosphere
`r_E(θ) = M(1+√(1−a*²cos²θ))` (= 2M at the equator for any spin); equatorial
photon orbit `r_ph = 2M[1+cos(⅔·arccos(∓a*))]`; **ISCO** via Bardeen–Press–
Teukolsky (6M at a=0 → 1M extremal prograde → 9M extremal retrograde). The disk
inner edge tracks the ISCO; geometry-overlay rings are drawn in the equatorial
plane and lensed by the same geodesic map as the rest of the scene.

**Photon-path tracer (`js/photons.js`).** A teaching overlay that integrates a
fan of Schwarzschild null geodesics (the same `a = −1.5·h²·r/|r|⁵`, on the CPU
with RK4) for parallel rays of varying impact parameter `b`, drawn as 3D lines
coloured by fate: **captured** for `b < b_c`, **orbiting** for `b ≈ b_c`, and
**escaping** (deflected) for `b > b_c`, where the critical impact parameter
`b_c = 3√3·GM/c² = 1.5√3·rₛ ≈ 2.598 rₛ` is exactly what sets the shadow's edge.
(Unlike the rendered scene, these are coordinate-space paths drawn with the
camera's view–projection matrix, so they are *not* re-lensed.)

**Accretion energetics.** Radiative efficiency `η = 1 − E_ISCO` ranges **5.7 %**
(a=0) → ~**32 %** (a*=0.998, the Thorne limit) → **42.3 %** (a→1), and **3.8 %**
retrograde. Thin-disk peak temperature scales as `T ∝ (Ṁ/M²)^¼`; the Eddington
luminosity `L_Edd ≈ 1.26×10³¹ W ·(M/M☉)` flags super-Eddington accretion.

**Thermodynamics & quantum.** Hawking temperature
`T_H = ħc³/(8πGMk_B) = 6.17×10⁻⁸ K ·(M☉/M)` (every real hole is far colder than
the 2.725 K CMB); Hawking power `P = ħc⁶/(15360πG²M²)`; Bekenstein–Hawking
entropy `S = k_B A c³/(4Għ)` (**≈ 1.45×10⁵⁴ J/K ≈ 1.05×10⁷⁷ k_B** for 1 M☉);
evaporation lifetime `t = 5120πG²M³/(ħc⁴) ≈ 2.10×10⁶⁷ yr ·(M/M☉)³`.

**Verified corrections** applied from the research pass: shadow/ring distinction
(above); θ_g constant **0.0322** (not 1.07×10⁻⁵); specific-intensity beaming
exponent **δ^(3+α)** with bolometric flux **δ⁴** (the renderer uses δ³ as a
bolometric-ish surface-brightness approximation); apparent-freezing e-folding
**τ = 3√3·GM/c³**; entropy value **1.45×10⁵⁴ J/K** for 1 M☉.

---

## 11. References

- **Schwarzschild geodesics / light bending** — orbit equation `d²u/dφ² + u = 3Mu²`:
  [arXiv:1911.05311](https://arxiv.org/pdf/1911.05311) ·
  real-time ray-tracing approach: [CS184 black-hole ray tracer](https://eliot1019.github.io/Black-Hole-Raytracer/)
- **Bardeen, Press & Teukolsky (1972)** — ISCO of a Kerr black hole.
- **Shakura & Sunyaev (1973)** — thin accretion-disk model; relativistic
  extension **Novikov & Thorne (1973)** / **Page & Thorne (1974)**.
- **Luminet, J.-P. (1979)** — *Image of a spherical black hole with thin
  accretion disk* — first simulated black-hole image; history:
  [arXiv:1902.11196](https://arxiv.org/pdf/1902.11196)
- **James, von Tunzelmann, Franklin & Thorne (2015)** — *Gravitational lensing
  by spinning black holes in astrophysics, and in the movie Interstellar*
  (the DNGR renderer): [arXiv:1502.03808](https://arxiv.org/abs/1502.03808) ·
  [Building Gargantua, CERN Courier](https://cerncourier.com/a/building-gargantua/)
- **Event Horizon Telescope Collaboration (2019)** — *First M87 EHT Results I:
  The Shadow of the Supermassive Black Hole*:
  [arXiv:1906.11238](https://arxiv.org/abs/1906.11238)
- **Event Horizon Telescope Collaboration (2022)** — first image of **Sgr A\***.
