# Dynamic and Seasonal Surface-Water Mapping & Change Detection over the Bihar Ganga Alluvial Plain Using NISAR L2 GCOV SAR
**IEEE InGARSS 2026 Young Professionals (YP) Hackathon — Phase 1 Technical Notebook**

---

## 1. Physical Principles of L-Band & S-Band SAR Surface-Water Detection

### 1.1 Specular Reflection & Rayleigh Surface Roughness Criterion
Synthetic Aperture Radar (SAR) is an active side-looking microwave sensor. For a geocoded terrain-corrected covariance matrix product (**NISAR Level-2 GCOV**), the calibrated radar backscatter coefficient $\gamma^0$ (stored in linear power along the covariance diagonal, e.g., $C_{11} = \langle |S_{\text{HH}}|^2 \rangle$) is governed by the surface dielectric constant $\varepsilon_r$ and surface root-mean-square (RMS) height $h_{\text{rms}}$ relative to the radar wavelength $\lambda$:
* **NASA L-Band (LSAR):** $f_c = 1.239\text{ GHz} \implies \lambda \approx 24.20\text{ cm}$
* **ISRO S-Band (SSAR):** $f_c = 3.200\text{ GHz} \implies \lambda \approx 9.37\text{ cm}$

Under the **Fraunhofer / Rayleigh smoothness criterion**, a surface acts as a smooth specular mirror when:
$$h_{\text{rms}} < \frac{\lambda}{8 \cos\theta_i}$$
where $\theta_i$ is the local incidence angle ($\approx 37^\circ\text{--}41^\circ$). Calm open water satisfies $h_{\text{rms}} \ll \lambda$, reflecting incident microwave energy away from the side-looking antenna toward the specular direction. This produces a strong radiometric drop ($\gamma^0_{\text{HH}} < -13.0\text{ dB}$ in L-band, $\gamma^0_{\text{HV}} < -22.0\text{ dB}$). Conversely, rough alluvial soil, urban structures, and vegetated floodplains produce diffuse Bragg/volume scattering or dihedral double-bounce returns ($\gamma^0_{\text{HH}} > -8.0\text{ dB}$).

### 1.2 Calibrated Log-Ratio Change Metric ($\Delta\text{dB}$)
Because SAR intensity is contaminated by multiplicative Gamma-distributed speckle noise $I = R \cdot n$, taking a ratio of linear intensities between an active pass ($t_2$) and a baseline pass ($t_1$) transforms multiplicative speckle into an additive difference in decibel ($\text{dB}$) space while canceling out static terrain roughness and incidence-angle biases:
$$\gamma^0_{\text{dB}}(t) = 10 \log_{10}\!\left(\gamma^0_{\text{linear}}(t)\right), \qquad \Delta\gamma^0_{\text{dB}} = \gamma^0_{\text{dB}}(t_{\text{active}}) - \gamma^0_{\text{dB}}(t_{\text{baseline}}) = 10 \log_{10}\!\left(\frac{\gamma^0_{\text{active}}}{\gamma^0_{\text{baseline}}}\right)$$
* **Newly Detected Water (Water Gain):** Dry/vegetated land at $t_1$ inundated by open water at $t_2$ exhibits a strong negative excursion ($\Delta\gamma^0_{\text{dB}} \le T_{\text{Otsu}} < -3.0\text{ dB}$).
* **Receded Water (Water Loss):** Flooded/wet surfaces at $t_1$ that drain or expose rough alluvial sediment (`diara` sandbars) by $t_2$ exhibit a strong positive excursion ($\Delta\gamma^0_{\text{dB}} \ge +3.0\text{ dB}$ with $\gamma^0_{\text{baseline}} < -13.0\text{ dB}$ and $\gamma^0_{\text{active}} \ge -13.0\text{ dB}$).

### 1.3 Permanent-Water-Excluded Otsu Thresholding & Hysteresis Region Growing
Global Otsu thresholding maximizes inter-class variance $\sigma^2_B(T) = \omega_0(T)\omega_1(T)[\mu_0(T) - \mu_1(T)]^2$. However, over major river basins like the Ganga, persistent river channels (`Class 1`) and out-of-swath Noise-Equivalent Sigma Zero (NESZ $< -40\text{ dB}$) dropouts dominate the histogram and skew the threshold. Our pipeline:
1. Masks out out-of-swath feathering noise ($\gamma^0_{\text{linear}} < 10^{-4}$ or $-40\text{ dB}$) and persistent water ($\gamma^0_{t_1}, \gamma^0_{t_2} < -13.0\text{ dB}$) *prior* to histogram binning.
2. Evaluates a 256-bin bounded Otsu split over the physical specular drop domain $[-25.0\text{ dB}, 0.0\text{ dB}]$, computing $T_{\text{Otsu}} = -3.26\text{ dB}$ for the Aug 31 $\rightarrow$ Sep 12 Bihar pair.
3. Executes 8-connected hysteresis region growing from high-confidence seeds ($\Delta\gamma^0_{\text{dB}} < -5.0\text{ dB}$) out to the growth limit ($\Delta\gamma^0_{\text{dB}} < -2.5\text{ dB}$).
