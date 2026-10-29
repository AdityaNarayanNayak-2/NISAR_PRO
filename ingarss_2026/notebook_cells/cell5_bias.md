## 2. Eliminating the "Wet-Baseline Bias" via 4-Epoch Multi-Temporal Tracking

A critical pitfall in operational SAR flood mapping over monsoon-dominated river basins (such as the Ganga in Bihar or the Brahmaputra in Assam) is the **Wet-Baseline Bias**:

### 2.1 The Single-Pair Wet-Baseline Failure Mode
In a conventional 2-date change detection pipeline comparing two intra-monsoon passes (e.g., **31 August 2026** vs. **12 September 2026**), low-lying floodplains and `diara` depressions that were *already inundated* prior to 31 August exhibit specularly dark backscatter ($\gamma^0_{\text{HH}} < -13.0\text{ dB}$) on **both** dates:
$$\gamma^0_{\text{Aug 31}} \approx -18.5\text{ dB}, \quad \gamma^0_{\text{Sep 12}} \approx -19.0\text{ dB} \implies \Delta\gamma^0_{\text{dB}} = -0.5\text{ dB} \approx 0\text{ dB}$$
Because $\Delta\gamma^0_{\text{dB}}$ is near zero and both observations fall below the static water threshold ($-13.0\text{ dB}$), a 2-date classifier lumps **long-duration monsoon inundation** into `Class 1 (Stable / Permanent Water)`. Look at our Aug 31 $\rightarrow$ Sep 12 table above: `Class 1` is **3,978.67 km²** (`983,151 acres`), whereas in our July 26 $\rightarrow$ Sep 12 run, `Class 1` was only **2,740.36 km²** (`677,157 acres`). The difference—**1,238.31 km² (`305,994 acres`)**—is not permanent river channel; it is **early-monsoon inundation** that arrived before August 31 and persisted through September 12!

### 2.2 How Our 4-Epoch Multi-Temporal Stack Solves This
By ingesting four orbital repeat passes along **Ascending Track 098, Frame 014** (`26 Jul` $\rightarrow$ `31 Aug` $\rightarrow$ `12 Sep` $\rightarrow$ `18 Oct 2026`), our architecture decouples **true perennial river channels** from **seasonal monsoon persistence**:

| Epoch Pair / Combination | Hydrological Role | Key Physical Finding in Bihar Swath |
| :--- | :--- | :--- |
| **Epoch 1 (`26 Jul`) $\cap$ Epoch 4 (`18 Oct`)** | **True Perennial Water Reference ($W_{\text{perennial}}$)** | Identifies the true dry/post-monsoon Ganga, Kosi, and Gandak river channels (**~2,574–2,740 km²**), preventing seasonal standing water from inflating `Class 1`. |
| **Epoch 1 (`26 Jul`) $\rightarrow$ Epoch 3 (`12 Sep`)** | **Cumulative Monsoon Inundation Envelope** | Captures the full seasonal expansion (**2,501.63 km²** / `618,165 acres` of water gain) from pre-peak vegetated floodplain to peak monsoon inundation. |
| **Epoch 2 (`31 Aug`) $\rightarrow$ Epoch 3 (`12 Sep`)** | **Late-Monsoon Pulse (Phase 1 Expansion)** | Isolates the specific 12-day late-monsoon surge (**+1,173.56 km²** new inundation across 1,746 clusters) while simultaneously capturing **943.25 km²** of localized tributary drainage. |
| **Epoch 3 (`12 Sep`) $\rightarrow$ Epoch 4 (`18 Oct`)** | **Post-Monsoon Drainage (Phase 2 Recession)** | Tracks the **2,650.27 km²** (`Class 5`) recession wave as floodwaters drain back into the main Ganga channel and expose bare alluvial sandbars. |

**Conclusion for Operational Disaster Response:** Combining a multi-epoch temporal baseline ($\bigcap_{t} W_t$) with our bidirectional 5-class log-ratio detector (`Classes 2–4` Gain + `Class 5` Loss) ensures that both **short-duration flash pulses** and **multi-week stagnant inundation** are accurately separated from permanent hydrography.
