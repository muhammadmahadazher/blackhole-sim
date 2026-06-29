// ============================================================================
//  content.js  —  Educational content + real-object presets (data only).
//  Sourced from the research/synthesis pass; numbers cross-checked in the
//  adversarial verification phase. Consumed by the info/"Learn" system and the
//  preset selector. See docs/PHYSICS.md for full citations.
// ============================================================================
window.BH = window.BH || {};

// ---- Real black holes (carry MEASURED parameters that drive every readout) --
//  M       : mass in solar masses
//  spin    : dimensionless a* (sign: + prograde view convention)
//  distLy  : distance in light-years
//  incl    : inclination of the disk to the line of sight (deg; 0 = face-on)
//  ringUas : EHT-measured emission-ring diameter (µas) where applicable
//  view    : suggested camera {radiusRs, fovDeg}
window.BH.PRESETS = {
    "Sgr A* — Milky Way": {
        M: 4.297e6, spin: 0.5, distLy: 26996, incl: 40, fEdd: 1e-4,
        ringUas: 51.8, diskOuter: 12, diskTemp: 9500, beaming: true,
        view: { radiusRs: 18, fovDeg: 55 },
        cite: "GRAVITY Collab. 2022 (mass/distance); EHT 2022 (ring 51.8±2.3 µas)"
    },
    "M87* — EHT 2019": {
        M: 6.5e9, spin: 0.9, distLy: 5.48e7, incl: 17, fEdd: 1e-5,
        ringUas: 42, diskOuter: 16, diskTemp: 7000, beaming: true,
        view: { radiusRs: 24, fovDeg: 50 },
        cite: "EHT Collab. 2019 (M=6.5×10⁹ M☉, D=16.8 Mpc, ring 42±3 µas)"
    },
    "Cygnus X-1 — stellar-mass": {
        M: 21.2, spin: 0.95, distLy: 7240, incl: 27, fEdd: 0.02,
        diskOuter: 14, diskTemp: 12000, beaming: true,
        view: { radiusRs: 20, fovDeg: 55 },
        cite: "Miller-Jones et al. 2021 (M=21.2±2.2 M☉, high spin)"
    },
    "GW150914 remnant": {
        M: 62, spin: 0.67, distLy: 1.3e9, incl: 30, fEdd: 0,
        diskOuter: 10, diskTemp: 9000, beaming: false,
        view: { radiusRs: 16, fovDeg: 55 },
        cite: "LIGO/Virgo 2016 — first GW detection; 36+29→62 M☉, a*=0.67"
    },
    "GW190521 — intermediate-mass": {
        M: 142, spin: 0.72, distLy: 1.7e10, incl: 30, fEdd: 0,
        diskOuter: 11, diskTemp: 8500, beaming: false,
        view: { radiusRs: 18, fovDeg: 55 },
        cite: "LIGO/Virgo 2020 — remnant ≈142 M☉ (intermediate-mass)"
    },
    "TON 618 — ultramassive": {
        M: 6.6e10, spin: 0.9, distLy: 1.04e10, incl: 25, fEdd: 0.5,
        diskOuter: 18, diskTemp: 6000, beaming: true,
        view: { radiusRs: 26, fovDeg: 50 },
        cite: "Shemmer et al. 2004 — quasar, M≈6.6×10¹⁰ M☉"
    },
    "Gargantua — Interstellar": {
        M: 1e8, spin: 0.999, distLy: 0, incl: 5, fEdd: 0.3,
        diskOuter: 20, diskTemp: 6200, beaming: false,
        view: { radiusRs: 30, fovDeg: 50 },
        cite: "James, von Tunzelmann, Franklin & Thorne 2015 (DNGR; fictional)"
    },
    "If the Sun were a black hole": {
        M: 1, spin: 0.0, distLy: 0, incl: 25, fEdd: 0.01,
        diskOuter: 14, diskTemp: 9000, beaming: true,
        view: { radiusRs: 22, fovDeg: 55 },
        cite: "Illustrative — rₛ = 2.95 km"
    }
};

// ---- "Learn" topics: what is happening & what we know ----------------------
window.BH.LEARN = [
    { id: "horizon", section: "spacetime", title: "Event Horizon & Shadow",
      body: "The event horizon is the point of no return — a one-way surface where the escape velocity equals the speed of light. For a non-rotating hole it is a sphere of radius rₛ = 2GM/c². The horizon itself is invisible; what telescopes capture is the larger dark 'shadow' cast on surrounding light, about 2.6× wider than the horizon because gravity bends in light from a much larger region.",
      analogy: "Like the lip of a waterfall: past one invisible line the current is committed to going over.",
      numbers: "rₛ = 2.95 km × (M/M☉). Shadow diameter = 6√3·GM/c² ≈ 5.2 rₛ.",
      formula: "rₛ = 2GM/c²" },
    { id: "photonring", section: "spacetime", title: "Photon Sphere & Photon Ring",
      body: "At 1.5 rₛ lies the photon sphere, where gravity bends light into (unstable) circular orbits. Light that loops around once or more before reaching us forms the razor-thin photon ring — a stack of self-similar sub-rings, each successive one exponentially fainter (≈ e^−π ≈ 1/23 for a non-spinning hole). It is a near-pure prediction of general relativity.",
      analogy: "A whispering gallery for light — each extra lap is a fainter echo-ring.",
      numbers: "Photon sphere r_ph = 1.5 rₛ. Critical impact parameter b_c = 3√3·GM/c².",
      formula: "r_ph = 3GM/c² ;  b_c = 3√3 GM/c²" },
    { id: "lensing", section: "relativity", title: "Gravitational Lensing",
      body: "Mass bends light, so a black hole is a powerful lens, distorting and multiplying background images. GR predicts exactly twice the Newtonian deflection (confirmed in 1919). Near a hole the far side of the accretion disk is bent up and over the shadow, so you see the disk's underside arching above the hole; a perfectly aligned background source smears into an Einstein ring.",
      analogy: "Like looking through the foot of a wine glass — everything behind warps into arcs.",
      numbers: "Deflection = 4GM/(c²b). Sun: 1.75″ (1919). ",
      formula: "Δφ = 4GM/(c²b)" },
    { id: "disk", section: "accretion", title: "The Accretion Disk",
      body: "Infalling gas settles into a hot, rotating disk. Friction heats it as it drifts inward, so it glows as a multi-temperature blackbody — hottest/bluest at the inner edge, cooler/redder outward (T ∝ r^−3/4). Peak temperature scales as M^−1/4, so stellar-mass holes blaze in X-rays while supermassive ones peak in UV/optical.",
      analogy: "Water circling a drain — but the water is plasma glowing white-hot at the center.",
      numbers: "T(r) ∝ r^−3/4. Stellar: ~10⁷ K (X-ray). Supermassive: ~10⁵ K (UV).",
      formula: "T(r) = [3GMṀ/(8πσr³)·(1−√(r_in/r))]^¼" },
    { id: "beaming", section: "relativity", title: "Doppler Beaming & Redshift",
      body: "The inner disk orbits at a sizable fraction of c, so the side rotating toward us is boosted brighter and bluer while the receding side dims and reddens — turning a symmetric ring into a lopsided bright crescent. Light climbing out of the well is also gravitationally redshifted. Observed brightness scales as the shift factor cubed.",
      analogy: "A passing ambulance siren — but for light: approaching side 'louder and bluer'.",
      numbers: "Doppler factor δ = 1/[γ(1−β·cosθ)]; intensity ∝ δ^(3+α). β ≈ 0.5 at the ISCO.",
      formula: "δ = 1/[γ(1−β cosθ)] ;  I_obs ∝ δ³" },
    { id: "isco", section: "spacetime", title: "ISCO — Innermost Stable Circular Orbit",
      body: "Unlike Newtonian gravity, GR forbids stable circular orbits below a critical radius — the ISCO — which marks the disk's inner edge. Its radius depends strongly on spin: 6 GM/c² for a non-spinning hole, shrinking to just 1 GM/c² for a maximal co-rotating one. Because matter can orbit closer and release more energy before plunging, the ISCO sets how efficiently a hole converts mass to light.",
      analogy: "The inner rim of a skateboard bowl — cross it and you drop straight to the bottom.",
      numbers: "Schwarzschild ISCO = 6GM/c² = 3 rₛ. Extremal prograde → 1 GM/c². β ≈ 0.5c.",
      formula: "r_ISCO(a*) — Bardeen-Press-Teukolsky 1972" },
    { id: "kerr", section: "spacetime", title: "Spin, Kerr & the Ergosphere",
      body: "Real black holes rotate (spin a* between 0 and 1). Spin shrinks the horizon, splits it into outer and inner horizons, and turns the singularity into a ring. Outside the horizon lies the ergosphere, where spacetime itself is dragged around so hard that nothing can stand still — frame dragging (Lense-Thirring). Rotational energy can even be extracted (the Penrose process).",
      analogy: "A whirlpool — near enough the drain, you can't tread water; the current carries you around.",
      numbers: "a* = Jc/GM². Outer horizon r₊ = M(1+√(1−a*²)): 2M→M. Ergosphere = 2M at equator.",
      formula: "r₊ = M(1+√(1−a*²)) ;  r_E(θ) = M(1+√(1−a*²cos²θ))" },
    { id: "timedilation", section: "relativity", title: "Gravitational Time Dilation",
      body: "Clocks run slower deeper in a gravity well. Near a black hole this is extreme: a clock just above the horizon ticks far slower than a distant one, and at the horizon it appears (to us) to freeze. This is why infalling matter never seems to cross — its light stretches redder, fainter, and slower into a frozen image.",
      analogy: "Filming a friend walk into thick fog: they slow, dim, redden, and freeze — but to them it's instant.",
      numbers: "dτ/dt = √(1−rₛ/r). ISCO: 0.816. Photon sphere: 0.577. Horizon: 0.",
      formula: "dτ/dt = √(1 − rₛ/r)" },
    { id: "tidal", section: "relativity", title: "Spaghettification & Tidal Forces",
      body: "Gravity weakens with distance, so your near side is pulled harder than your far side — a stretching tidal force that, close enough, draws an object into a thin strand. Counterintuitively, smaller holes are deadlier: the tidal gradient at the horizon scales as 1/M². You'd be shredded outside a stellar-mass hole, yet could cross a supermassive one's horizon intact.",
      analogy: "Pulling taffy — feet yanked harder than your head, stretched into 'spaghetti'.",
      numbers: "Tidal gradient = 2GM/r³ per unit length; strength at horizon ∝ 1/M².",
      formula: "Δa = 2GML/r³" },
    { id: "hawking", section: "thermo", title: "Hawking Radiation & Evaporation",
      body: "Quantum mechanics makes black holes not quite black: they emit a faint thermal glow with a temperature inversely proportional to mass — so smaller holes are hotter. Radiating means losing mass, so holes slowly evaporate, with a lifetime growing as M³. Every real black hole is far colder than the cosmic microwave background, so today they absorb more than they emit.",
      analogy: "A puddle that boils away faster the tinier it is — a solar-mass hole is colder than deep space.",
      numbers: "T_H = 6.17×10⁻⁸ K ×(M☉/M), below the 2.725 K CMB. Lifetime ≈ 2.1×10⁶⁷ yr ×(M/M☉)³.",
      formula: "T_H = ħc³/(8πGMk_B) ;  t ∝ M³" },
    { id: "entropy", section: "thermo", title: "Entropy & Black-Hole Thermodynamics",
      body: "Black holes obey laws parallel to thermodynamics, with surface gravity as temperature and horizon AREA as entropy. The Bekenstein-Hawking entropy is proportional to area (not volume) and is staggeringly large — the seed of the holographic principle, the idea that a volume's information can be encoded on its boundary.",
      analogy: "A library whose capacity is set by its wall area, not its volume — one bit per few Planck tiles.",
      numbers: "S = k_B A c³/(4Għ). For 1 M☉: S ≈ 1.45×10⁵⁴ J/K (≈10⁷⁷ k_B).",
      formula: "S = k_B A c³ / (4Għ)" },
    { id: "singularity", section: "thermo", title: "The Singularity & the Information Paradox",
      body: "GR predicts matter collapses to a point (a ring for spinning holes) of infinite density — a singularity where the theory breaks down. The deepest puzzle is the information paradox: Hawking radiation looks purely thermal, which would erase the quantum information of what fell in, violating quantum mechanics. Modern work (the Page curve, 'islands', ER=EPR) suggests information survives — but how is a great open problem.",
      analogy: "Burning a library — the smoke seems to carry no trace, yet physics says the information must survive.",
      numbers: "No-hair: a hole is just (M, J, Q). Kerr singularity is a ring of radius a*M.",
      formula: "— quantum gravity required" },
    { id: "eht", section: "observation", title: "How We Image Black Holes (EHT)",
      body: "The Event Horizon Telescope linked radio dishes across the planet into an Earth-sized virtual telescope (VLBI at 1.3 mm), resolving the shadow and bright ring for the first time: M87* in 2019, Sgr A* in 2022. Remarkably, despite a ~1500× mass difference, both look nearly the same angular size from Earth — because mass and distance almost exactly cancel.",
      analogy: "A planet-sized camera sharp enough to read a newspaper in New York from a Paris café.",
      numbers: "M87*: 6.5×10⁹ M☉, ring 42±3 µas. Sgr A*: 4.3×10⁶ M☉, ring 51.8±2.3 µas.",
      formula: "θ_g[µas] = 0.0322 ×(M/M☉)/(D/ly)" },
    { id: "populations", section: "observation", title: "Populations: Stellar → Supermassive",
      body: "Observed black holes span a vast mass range. Stellar-mass holes (~3–150 M☉) form from collapsing massive stars and merge to make gravitational waves. Supermassive holes (10⁶–10¹⁰ M☉) anchor essentially every large galaxy. Between them sits the elusive intermediate-mass class. The horizon size scales linearly with mass.",
      analogy: "A family album from grains of sand to mountains — the same object across nine orders of mass.",
      numbers: "Stellar 3–150 M☉; intermediate 10²–10⁵; supermassive 10⁶–10¹⁰. rₛ ∝ M.",
      formula: "rₛ = 2.95 km ×(M/M☉)" }
];

// section → display label + which UI accent it maps to
window.BH.LEARN_SECTIONS = {
    spacetime:   "Spacetime & geometry",
    relativity:  "Relativistic effects",
    accretion:   "Accretion",
    thermo:      "Thermodynamics",
    observation: "Observation & data"
};
