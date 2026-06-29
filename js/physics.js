// ============================================================================
//  physics.js  —  Real-world black-hole quantities (SI), for scientist-grade
//                 readouts. Pure functions, no rendering/UI dependencies.
//
//  Conventions:
//    * "geometric length" GM/c²  ==  half the Schwarzschild radius (rₛ = 2GM/c²)
//    * spin a* is dimensionless in [0, 1)
//    * radii returned in units of rₛ unless noted; SI helpers convert to km.
//
//  Every formula here is standard GR / astrophysics; values are cross-checked
//  against known references (e.g. rₛ(Sun) ≈ 2.95 km, T_H(Sun) ≈ 6.2e-8 K,
//  M87* shadow ≈ 40 µas). See docs/PHYSICS.md for sources.
// ============================================================================
window.BH = window.BH || {};

window.BH.Physics = (function () {
    "use strict";

    // ---- fundamental constants (SI) ----
    const C  = 2.99792458e8;       // m/s
    const G  = 6.67430e-11;        // m^3 kg^-1 s^-2
    const HBAR = 1.054571817e-34;  // J s
    const KB = 1.380649e-23;       // J/K
    const SIGMA = 5.670374419e-8;  // W m^-2 K^-4
    const MSUN = 1.98892e30;       // kg
    const LSUN = 3.828e26;         // W

    // ---- units ----
    const KM = 1e3;
    const PC = 3.0856775814913673e16;   // m
    const LY = 9.4607304725808e15;      // m
    const AU = 1.495978707e11;          // m
    const YR = 3.1557e7;                // s (Julian year)
    const UAS = Math.PI / 180 / 3600 / 1e6; // 1 micro-arcsecond in radians

    // =====================================================================
    //  Geometry (dimensionless / geometric)
    // =====================================================================

    // Outer (event) horizon radius in units of rₛ, for spin a*.
    //   r₊ = M(1+√(1−a²));  rₛ = 2M  ⇒  r₊/rₛ = (1+√(1−a²))/2
    function horizonRs(a) { return (1 + Math.sqrt(Math.max(0, 1 - a*a))) / 2; }

    // Ergosphere outer boundary in units of rₛ at polar angle θ (rad).
    //   r_E = M(1+√(1−a²cos²θ))  ⇒  /rₛ = (1+√(1−a²cos²θ))/2
    function ergosphereRs(a, theta) {
        const c = Math.cos(theta);
        return (1 + Math.sqrt(Math.max(0, 1 - a*a*c*c))) / 2;
    }

    // ISCO radius in units of rₛ (Bardeen–Press–Teukolsky 1972).
    //   prograde: sign=-1 ; retrograde: sign=+1  (radius in units of M)
    function iscoRs(a, prograde) {
        a = Math.min(0.9999, Math.max(0, a));
        const s = prograde ? -1 : 1;
        const Z1 = 1 + Math.cbrt(1 - a*a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
        const Z2 = Math.sqrt(3*a*a + Z1*Z1);
        const rM = 3 + Z2 + s * Math.sqrt((3 - Z1) * (3 + Z1 + 2*Z2)); // in units of M
        return rM / 2; // rₛ = 2M
    }

    // Photon sphere / circular photon orbit radius in units of rₛ.
    //   Schwarzschild: 1.5 rₛ (=3M).  Kerr equatorial (Bardeen):
    //   r_ph = 2M{1+cos[(2/3)arccos(∓a)]}  (∓ : prograde/retrograde)
    function photonSphereRs(a, prograde) {
        a = Math.min(0.9999, Math.max(0, a));
        const s = prograde ? -1 : 1;
        const rM = 2 * (1 + Math.cos((2/3) * Math.acos(s * a))); // in units of M
        return rM / 2;
    }

    // Marginally bound orbit (units of rₛ).  Kerr (Bardeen):
    //   r_mb/M = 2 ∓ a + 2√(1 ∓ a)   (∓: prograde/retrograde).
    //   Schwarzschild a=0 → 4M = 2 rₛ.
    function marginallyBoundRs(a, prograde) {
        a = Math.min(0.9999, Math.max(0, a));
        const s = prograde ? -1 : 1;          // sign in front of a
        const rM = 2 + s * a + 2 * Math.sqrt(1 + s * a); // units of M
        return rM / 2;                         // rₛ = 2M
    }

    // Radiative efficiency of a Novikov–Thorne disk (energy per rest mass),
    //   η = 1 − E_isco, with E_isco the specific energy at the ISCO.
    //   a=0 → 0.0572 ; a*=0.998 (Thorne limit) → ~0.321 ; a→1 → 0.4226
    //   (iscoRs clamps a at 0.9999, so the strict extremal 0.4226 isn't returned).
    function radiativeEfficiency(a, prograde) {
        const r = iscoRs(a, prograde) * 2; // back to units of M
        const s = prograde ? 1 : -1;
        // E/μ for equatorial circular geodesic (Bardeen):
        // E = (r^1.5 − 2 r^0.5 ± a) / (r^0.75 √(r^1.5 − 3 r^0.5 ± 2a))
        const sq = Math.sqrt(r);
        const num = Math.pow(r, 1.5) - 2*sq + s*a;
        const den = Math.pow(r, 0.75) * Math.sqrt(Math.pow(r, 1.5) - 3*sq + 2*s*a);
        const E = num / den;
        return 1 - E;
    }

    // Gravitational time-dilation factor for a static observer at r (in rₛ):
    //   dτ/dt = √(1 − rₛ/r).  (Schwarzschild.)
    function timeDilation(rRs) { return Math.sqrt(Math.max(0, 1 - 1 / rRs)); }

    // Circular-orbit speed measured by a local static observer (Schwarzschild),
    //   β = √(M/(r−2M)) = √(0.5/(rRs−1)).  (=0.5c at the ISCO r=6M.)
    function orbitSpeedBeta(rRs) {
        if (rRs <= 1) return 0.95;
        return Math.min(0.999, Math.sqrt(0.5 / (rRs - 1)));
    }

    // =====================================================================
    //  Dimensional quantities (depend on mass / distance)
    // =====================================================================

    // Schwarzschild radius rₛ = 2GM/c²  (metres).  ≈ 2954 m per solar mass.
    function rsMeters(Msolar) { return 2 * G * Msolar * MSUN / (C * C); }

    // Apparent shadow angular DIAMETER (micro-arcseconds).
    //   Schwarzschild shadow radius = √27 · GM/c² = (√27/2) rₛ.
    //   diameter = √27 · rₛ ;  θ = diameter / D.
    function shadowUas(Msolar, distanceLy) {
        const diam = Math.sqrt(27) * rsMeters(Msolar);   // metres
        const D = distanceLy * LY;
        return (diam / D) / UAS;
    }

    // Hawking temperature (Kelvin):  T = ħc³/(8πGMk_B).  ≈ 6.17e-8 K per Msun⁻¹.
    function hawkingK(Msolar) {
        return HBAR * C * C * C / (8 * Math.PI * G * (Msolar * MSUN) * KB);
    }

    // Bekenstein–Hawking entropy (in units of k_B):  S/k_B = A c³/(4 G ħ),  A=4π r₊².
    function entropyOverKB(Msolar, a) {
        const rplus = horizonRs(a) * rsMeters(Msolar);   // metres
        const A = 4 * Math.PI * rplus * rplus;
        return A * C * C * C / (4 * G * HBAR);
    }

    // Evaporation lifetime (years):  t = 5120 π G² M³ /(ħ c⁴) ≈ 2.10e67 (M/Msun)³ yr.
    function evaporationYears(Msolar) {
        const M = Msolar * MSUN;
        const t = 5120 * Math.PI * G * G * M * M * M / (HBAR * Math.pow(C, 4));
        return t / YR;
    }

    // Eddington luminosity (Watts):  L_Edd = 4πGMm_p c/σ_T ≈ 1.26e31 W ·(M/Msun).
    function eddingtonW(Msolar) { return 1.26e31 * Msolar; }

    // Peak accretion-disk effective temperature (Kelvin), order-of-magnitude.
    //   T_eff ∝ (Ṁ / M²)^¼ ; here parametrised by Eddington ratio fEdd.
    //   Inner T ≈ 2e7 K · (M/Msun)^(−1/4) · fEdd^(1/4)  (thin-disk scaling).
    function diskPeakK(Msolar, fEdd) {
        return 2.0e7 * Math.pow(Msolar, -0.25) * Math.pow(Math.max(fEdd, 1e-3), 0.25);
    }

    // Tidal "spaghettification" radius (metres): where tidal stretching on a
    //   ~human/object of size L and density ρ becomes lethal/disruptive.
    //   r_tidal ≈ (2GM L / Δg_crit)^(1/3) form; we use the classic
    //   r_tidal ≈ R_obj (M/m_obj)^(1/3) analogue → for a body of density ρ:
    //   r_tidal ≈ (GM/ a_crit · L)^(1/3). We expose the simpler comparison:
    //   tidal acceleration across length L at radius r: Δa = 2GML/r³.
    function tidalAccel(Msolar, r_m, L_m) {
        return 2 * G * (Msolar * MSUN) * L_m / Math.pow(r_m, 3);
    }

    // =====================================================================
    //  Formatting helpers
    // =====================================================================
    function fmtLength(m) {
        if (m >= 9.461e15) return (m / LY).toPrecision(3) + " ly";
        if (m >= 1.496e11) return (m / AU).toPrecision(3) + " AU";
        if (m >= 1e9)      return (m / 1e9).toPrecision(3) + " Gm";
        if (m >= 1e3)      return (m / 1e3).toPrecision(3) + " km";
        return m.toPrecision(3) + " m";
    }
    function fmtTime(yr) {
        if (yr >= 1e9) return (yr / 1e9).toPrecision(3) + " Gyr";
        if (yr >= 1e6) return (yr / 1e6).toPrecision(3) + " Myr";
        if (yr >= 1)   return yr.toPrecision(3) + " yr";
        const s = yr * YR;
        if (s >= 1) return s.toPrecision(3) + " s";
        return s.toExponential(2) + " s";
    }
    function fmtSci(x, unit) {
        if (!isFinite(x)) return "—";
        const a = Math.abs(x);
        if (a !== 0 && (a < 1e-3 || a >= 1e5)) return x.toExponential(2) + (unit ? " " + unit : "");
        return (Math.abs(x) >= 100 ? x.toFixed(0) : x.toPrecision(3)) + (unit ? " " + unit : "");
    }
    function fmtMass(Msolar) {
        const sup = { 3: "³", 6: "⁶", 9: "⁹", 10: "¹⁰", 12: "¹²" };
        if (Msolar >= 1e3) {
            const e = Math.floor(Math.log10(Msolar));
            const m = Msolar / Math.pow(10, e);
            return m.toFixed(2) + "×10" + (sup[e] || ("^" + e)) + " M☉";
        }
        return Msolar.toPrecision(3) + " M☉";
    }

    // Compute a full readout bundle for given inputs.
    function summary(Msolar, a, distanceLy, prograde, fEdd) {
        prograde = prograde !== false;
        fEdd = fEdd || 0.1;
        const rs = rsMeters(Msolar);
        return {
            rsMeters: rs,
            horizonKm: horizonRs(a) * rs / KM,
            iscoRs: iscoRs(a, prograde),
            iscoKm: iscoRs(a, prograde) * rs / KM,
            photonRs: photonSphereRs(a, prograde),
            ergoEqRs: ergosphereRs(a, Math.PI / 2),
            shadowUas: shadowUas(Msolar, distanceLy),
            hawkingK: hawkingK(Msolar),
            entropyKB: entropyOverKB(Msolar, a),
            evaporationYr: evaporationYears(Msolar),
            eddingtonW: eddingtonW(Msolar),
            diskPeakK: diskPeakK(Msolar, fEdd),
            efficiency: radiativeEfficiency(a, prograde),
            iscoBeta: orbitSpeedBeta(iscoRs(a, prograde))
        };
    }

    return {
        C, G, HBAR, KB, SIGMA, MSUN, PC, LY, AU, YR, UAS,
        horizonRs, ergosphereRs, iscoRs, photonSphereRs, marginallyBoundRs,
        radiativeEfficiency, timeDilation, orbitSpeedBeta,
        rsMeters, shadowUas, hawkingK, entropyOverKB, evaporationYears,
        eddingtonW, diskPeakK, tidalAccel,
        fmtLength, fmtTime, fmtSci, fmtMass, summary
    };
})();
