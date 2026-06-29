# Running the simulation on your dedicated GPU (NVIDIA RTX)

This simulation is GPU-heavy by design (it ray-traces curved spacetime per
pixel). On a laptop with **hybrid graphics** — an integrated Intel GPU **and** a
dedicated NVIDIA RTX — Windows often forces the *browser* onto the weaker Intel
chip, even though the page explicitly requests the high-performance GPU. When
that happens you'll see the orange warning banner and the GPU badge will say
*"Integrated GPU"*.

The page cannot override this by itself — it's a Windows/driver assignment. Do
the following once and you'll get the full power of your **RTX 4060**.

> The performance badge in the control panel turns **green** and says
> *"High-end GPU"* once a dedicated card is detected — that's your confirmation.

---

## 1. Plug in & set the power mode

On battery, Windows aggressively forces the integrated GPU.

- Plug in the charger.
- Settings → System → **Power & battery** → *Power mode* → **Best performance**.

## 2. Windows Graphics settings (most reliable)

1. **Settings → System → Display → Graphics** (or search "Graphics settings").
2. Find your browser in the list. If it isn't there: *Add desktop app* →
   browse to the browser's `.exe`, e.g.
   `C:\Program Files\Google\Chrome\Application\chrome.exe`
   (Edge: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`).
3. Select it → **Options** → choose **High performance**
   (it will show your *NVIDIA GeForce RTX 4060*) → **Save**.

## 3. NVIDIA Control Panel (belt and suspenders)

1. Right-click the desktop → **NVIDIA Control Panel**.
2. **Manage 3D settings** → **Program Settings** tab.
3. Select your browser (add it if needed).
4. *"Select the preferred graphics processor for this program"* →
   **High-performance NVIDIA processor** → **Apply**.
   (Or set it globally under the *Global Settings* tab.)

## 4. Fully restart the browser

Close **every** browser window (not just the tab) so the process exits, then
reopen and load the simulation again. GPU assignment is decided when the browser
process starts.

## 5. Verify

Open `chrome://gpu` (or `edge://gpu`) and look near the top for **GL_RENDERER**.
It should now read something like
`ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 ...)` instead of *Intel … UHD Graphics*.

Reload the simulation. The badge should be **green / "High-end GPU"**, the
banner is gone, and **Auto** quality will ramp up to full resolution and deep
ray-marching. You can also pick **Ultra** for 1.35× supersampling.

---

### Notes

- **Firefox:** set the GPU via the Windows Graphics settings (step 2);
  Firefox follows the per-app Windows preference.
- If `chrome://gpu` still shows Intel after all this, check for a BIOS option
  like *"GPU mode / Hybrid / Discrete"* and ensure it isn't locked to the iGPU,
  and update your NVIDIA drivers.
- Once on the RTX 4060 (8 GB VRAM) you have *huge* headroom — try **Ultra**,
  crank **Quality (steps)**, widen the disk, and throw lots of matter in.
