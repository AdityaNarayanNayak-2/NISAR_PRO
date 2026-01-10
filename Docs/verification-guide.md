# System Verification & Testing Guide

This guide walks you through verifying every component of the SAR Analyzer platform.

## Prerequisites Check

### 1. Local Tools
```bash
# Check versions
rust --version        # Should be 1.70+
node --version        # Should be 20+
kubectl version       # Should be latest
podman --version      # Or docker
```

### 2. Cluster Status
```bash
# Check if Kind cluster exists
./kind get clusters
# Should show: sar-cluster

# Check if it's running
podman ps | grep sar-cluster
# Should show the control-plane container

# If not running, start it:
podman start sar-cluster-control-plane
```

---

## Step 1: GitLab Configuration Check

### CI/CD Variables
Go to: `GitLab → Settings → CI/CD → Variables`

Required variables:
- `ESA_USERNAME` (Your ESA Copernicus email)
- `ESA_PASSWORD` (Your ESA Copernicus password)

### Pipeline Status
```bash
# Go to GitLab project page
# Check: CI/CD → Pipelines
# Latest pipeline should be GREEN
```

---

## Step 2: Kubernetes Secrets Verification

```bash
# Check ESA credentials secret
kubectl get secret esa-credentials
# Should show: NAME, TYPE, DATA, AGE

kubectl describe secret esa-credentials
# Should show 'username' and 'password' in Data section

# Check GitLab registry secret
kubectl get secret regcred
# Should exist

# If missing, recreate:
kubectl apply -f k8s_manifests/esa_secret.yaml
./setup_secrets.sh  # For regcred
```

---

## Step 3: Flux CD Status

```bash
# Check Flux is running
kubectl get pods -n flux-system
# All pods should be Running

# Check Flux sync status
./flux get kustomizations
# Should show: sar-analyzer reconciled

# Force sync if needed
./flux reconcile kustomization sar-analyzer --with-source
```

---

## Step 4: Application Pods Status

```bash
# Check all pods
kubectl get pods

# Expected output:
# NAME                               READY   STATUS
# sar-dashboard-xxxxx                1/1     Running
# sar-gateway-xxxxx                  1/1     Running
# sar-operator-v2-xxxxx              1/1     Running

# If any pod is not Running:
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

---

## Step 5: Dashboard Access Test

```bash
# Start port-forward
kubectl port-forward svc/sar-dashboard-svc 8080:80
```

**In Browser:**
1. Go to `http://localhost:8080`
2. You should see:
   - 3D Spline globe rotating
   - Search bar with "Press Enter to search"
   - "GLOBAL RADAR INTELLIGENCE" title

**✅ Pass:** Dashboard loads with 3D background  
**❌ Fail:** Blank page or errors (check browser console F12)

---

## Step 6: Gateway API Test

```bash
# Test health endpoint
curl http://localhost:8080/api/health
# Expected: {"status":"ok"}

# Test search (Bangalore)
curl "http://localhost:8080/api/search?lat=12.97&lon=77.59"
# Expected: JSON array of Sentinel-1 scenes
```

**✅ Pass:** Returns real ESA data  
**❌ Fail:** 401 error → Check ESA credentials in secret

---

## Step 7: RDA Verification (The Core Test)

The Range-Doppler Algorithm needs to be tested separately.

### Build the Processor
```bash
cd sar_processor
cargo build --release
```

**Expected:** Should compile without errors. Check for:
- `rda.rs` compiles
- `radar_utils.rs` compiles
- Dependencies: `rustfft`, `ndarray`, `num-complex` resolved

### Run Unit Tests (Create These)
```bash
cargo test
```

### Manual RDA Test
Create `test_rda.sh`:
```bash
#!/bin/bash
cd sar_processor
SAR_SCENE_ID="test" SAR_OUTPUT_PATH="/tmp/test.tif" cargo run --release
```

**Expected Output:**
```
INFO - Initializing SAR Processor Engine...
INFO - Generating synthetic L0 data for testing...
INFO - Starting Range Compression on 1024x1024 matrix...
INFO - Range Compression Complete.
INFO - Starting Azimuth Compression...
INFO - Azimuth Compression Complete.
INFO - RDA Processing Successful. Image Dimensions: (1024, 1024)
```

**✅ Pass:** No panics, completes successfully  
**❌ Fail:** Crashes or errors → Check Cargo.toml dependencies

---

## Step 8: End-to-End Integration Test

This tests the full loop: Dashboard → Gateway → (Future: Operator → Processor)

**Currently Working:**
1. Search for scenes ✅
2. Display results ✅

**Not Yet Connected:**
- "Process" button → RDA execution

**To Test:**
1. Search "Bangalore" in dashboard
2. Check browser Network tab (F12)
3. Verify GET request to `/api/search?lat=...`
4. Verify JSON response appears in console

---

## Troubleshooting Common Issues

### Issue: Dashboard shows old version
```bash
# Force rebuild and reload
kubectl delete pod -l app=sar-dashboard
kubectl rollout restart deployment/sar-dashboard
```

### Issue: Gateway can't reach ESA
```bash
# Check secret
kubectl get secret esa-credentials -o yaml
# Decode and verify credentials

# Check gateway logs
kubectl logs $(kubectl get pod -l app=sar-gateway -o name)
```

### Issue: RDA compilation fails
```bash
# Check Cargo.toml versions match
cd sar_processor
cat Cargo.toml | grep -E "rustfft|ndarray|num-complex"

# Clean and rebuild
cargo clean
cargo build --release
```

---

## Success Criteria

Your system is **fully operational** if:

- [ ] GitLab pipeline is GREEN
- [ ] All K8s pods are Running
- [ ] Dashboard loads with 3D globe
- [ ] Search returns real ESA data
- [ ] RDA test completes without errors
- [ ] Flux syncs manifests automatically

---

## Next Steps After Verification

Once all checks pass:
1. Connect "Process" button to spawn processor pods
2. Implement real L0 data ingestion (not synthetic)
3. Add InSAR for 3D height maps
