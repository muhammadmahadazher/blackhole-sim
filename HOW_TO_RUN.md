# ▶ How to Run the Black Hole Simulation

A 2-minute guide. No coding needed.

---

## ✅ Easiest way — just open it

1. Open the **`BlackHoleSim`** folder.
2. **Double-click `index.html`.**
3. It opens in your web browser. That's it — drag to look around, scroll to zoom.

**To close it:** just close the browser tab. Nothing is running in the
background, so there's nothing else to shut down.

> If the page looks blank or broken this way, use the "Better way" below instead.

---

## 💪 Better way — use the launcher (recommended)

This runs a tiny local web server, which is more reliable and always loads the
newest version.

### To LAUNCH

1. Open the **`BlackHoleSim`** folder.
2. **Double-click `start.bat`.**
3. A small black window (the server) appears **and your browser opens
   automatically** at `http://localhost:8765`.

Leave that little black window open while you use the simulation.

### To STOP / CLOSE

1. Close the browser tab.
2. Click the **small black server window** and press **`Ctrl` + `C`**
   (or just close that window with the **✕**).

That's it — fully shut down.

---

## 🎮 Controls (once it's open)

| Do this | To... |
|---------|-------|
| **Drag** the mouse | Look around the black hole (full 360°) |
| **Scroll** wheel | Zoom in / out |
| **Click** the scene, or press **T** | Throw matter into the black hole 🪐 |
| **L** | Open the **Learn** drawer (what's happening & what we know) |
| **C** | Cinematic mode (hide menus) — **Esc** to exit |
| **R** | Reset the view |
| **Spacebar** | Start / stop auto-spin |
| **H** | Hide / show the control panel |
| **P** | Save a screenshot |

**Tip:** pick a real black hole from the **Black hole → preset** menu (Sgr A*,
M87*, Cygnus X-1, …) and the **Live readouts** fill in with real numbers. Tap any
**ⓘ** to learn what a control means. For the best quality, see *"Make it look its
best"* below. A pretty illustrated guide lives in **docs/guide.html**.

---

## ⚡ Make it look its best (use your RTX 4060)

By default Windows may run the browser on the weaker built-in Intel graphics.
You'll see an orange bar at the top saying so. Click **"Use my NVIDIA GPU →"**
in that bar for simple steps, or open **`docs/USE_NVIDIA_GPU.md`**.
Once switched, it runs much sharper and smoother — and the little badge in the
panel turns **green**.

---

## ❓ Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page when double-clicking `index.html` | Use `start.bat` instead. |
| `start.bat` flashes and closes | Python may be missing — install it from python.org, tick *"Add to PATH"*, then try again. |
| "Port 8765 in use" | A previous server is still open — close its black window, then run `start.bat` again. |
| Runs slowly / laptop gets hot | It auto-adjusts, but you can pick **Battery** or **Balanced** in the Performance panel, or switch to your NVIDIA GPU (above). |

---

*Want the full technical details and the science behind it?
See [README.md](README.md) and [docs/PHYSICS.md](docs/PHYSICS.md).*
