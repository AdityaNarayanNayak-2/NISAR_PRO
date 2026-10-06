"""nisar_probe.py -- independent libhdf5 oracle for NISAR GCOV windowed reads.

Every golden produced here comes from h5py's bundled libhdf5, which shares no
code with the Rust reader. Goldens are raw little-endian f32 bytes so the Rust
side can be compared bit-for-bit rather than through a lossy text format.

modes:
  recon    dump dataset metadata, libhdf5 chunk table, real pixel spacing,
           and the chunk with the highest file byte offset
  goldens  write raw f32 golden windows selected from the recon findings
"""

import hashlib
import json
import math
import os
import sys

import numpy as np
import h5py

DATASET = "/science/LSAR/GCOV/grids/frequencyA/HHHH"
COORD_X = "/science/LSAR/GCOV/grids/frequencyA/xCoordinates"
COORD_Y = "/science/LSAR/GCOV/grids/frequencyA/yCoordinates"
COORD_ALT = "/science/LSAR/GCOV/grids/frequencyB/xCoordinates"
COORD_ALT_Y = "/science/LSAR/GCOV/grids/frequencyB/yCoordinates"


def find_coord(f, base):
    """Locate xCoordinates/yCoordinates under base or its frequency siblings."""
    for base_try in (base, "/science/LSAR/GCOV/grids/frequencyB"):
        for name in ("xCoordinates", "yCoordinates"):
            p = base_try + "/" + name
            if p in f:
                yield p
                break
        else:
            continue
        break


def mode_recon(path, out_dir):
    with h5py.File(path, "r") as f:
        print("h5py            :", h5py.__version__)
        print("HDF5 library    :", h5py.version.hdf5_version)
        print("numpy           :", np.__version__)
        print("superblock      :", f.libver, "| file userblock:", f.userblock_size)

        d = f[DATASET]
        print()
        print("dataset         :", DATASET)
        print("  shape         :", d.shape)
        print("  dtype         :", d.dtype)
        print("  chunks        :", d.chunks)
        print("  compression   :", d.compression, "| compression_opts:", d.compression_opts)
        print("  shuffle       :", d.shuffle)
        print("  fletcher32    :", d.fletcher32)
        print("  fillvalue     :", repr(d.fillvalue))
        print("  fill bytes    :", d.fillvalue.tobytes().hex() if hasattr(d.fillvalue, "tobytes") else "n/a")
        print("  total bytes   :", d.size * d.dtype.itemsize, "=", round(d.size * d.dtype.itemsize / 2**30, 3), "GiB")

        nchunks = d.id.get_num_chunks()
        print("  libhdf5 chunks:", nchunks)

        table = []
        for i in range(nchunks):
            ci = d.id.get_chunk_info(i)
            table.append(
                {
                    "row": int(ci.chunk_offset[0]),
                    "col": int(ci.chunk_offset[1]),
                    "filter_mask": int(ci.filter_mask),
                    "byte_offset": int(ci.byte_offset),
                    "size": int(ci.size),
                }
            )

        chunk_rows = d.chunks[0]
        chunk_cols = d.chunks[1]
        grid_rows = (d.shape[0] + chunk_rows - 1) // chunk_rows
        grid_cols = (d.shape[1] + chunk_cols - 1) // chunk_cols
        print("  grid cells    :", grid_rows, "x", grid_cols, "=", grid_rows * grid_cols)

        masks = {}
        for t in table:
            masks[t["filter_mask"]] = masks.get(t["filter_mask"], 0) + 1
        print("  filter_mask histogram:", masks)

        seen = set((t["row"], t["col"]) for t in table)
        missing = [(r, c) for r in range(grid_rows) for c in range(grid_cols) if (r * chunk_rows, c * chunk_cols) not in seen]
        print("  grid cells absent from libhdf5 chunk index:", len(missing))
        if missing[:8]:
            print("  first missing:", missing[:8])

        hi = max(table, key=lambda t: t["byte_offset"])
        print("  highest-address chunk:", {k: hi[k] for k in ("row", "col", "byte_offset", "size", "filter_mask")})

        lowest = min(table, key=lambda t: t["byte_offset"])
        print("  lowest-address  chunk:", {k: lowest[k] for k in ("row", "col", "byte_offset", "size", "filter_mask")})

        print()
        xs = None
        ys = None
        for name in ("xCoordinates", "yCoordinates"):
            for base in ("/science/LSAR/GCOV/grids/frequencyA", "/science/LSAR/GCOV/grids/frequencyB"):
                p = base + "/" + name
                if p in f:
                    a = np.asarray(f[p][...])
                    print("coords", p, a.shape, a.dtype)
                    print("   first:", a[:3], "last:", a[-3:])
                    if name == "xCoordinates":
                        xs = a
                    else:
                        ys = a
                    break

        meta = {
            "dataset": DATASET,
            "shape": list(d.shape),
            "dtype": str(d.dtype),
            "chunks": list(d.chunks),
            "fillvalue_hex": d.fillvalue.tobytes().hex(),
            "num_chunks": nchunks,
            "grid": [grid_rows, grid_cols],
            "missing_cells": len(missing),
            "filter_mask_histogram": {str(k): v for k, v in masks.items()},
            "highest_address_chunk": hi,
            "h5py_version": h5py.__version__,
            "hdf5_version": h5py.version.hdf5_version,
        }

        if xs is not None and ys is not None:
            dx = float(np.median(np.diff(xs.astype(np.float64))))
            dy = float(np.median(np.diff(ys.astype(np.float64))))
            print()
            print("median pixel spacing: dx=%.4f m  dy=%.4f m" % (dx, dy))
            print("x range: %.4f .. %.4f" % (xs[0], xs[-1]))
            print("y range: %.4f .. %.4f" % (ys[0], ys[-1]))
            meta["dx_m"] = dx
            meta["dy_m"] = dy
            meta["x_range"] = [float(xs[0]), float(xs[-1])]
            meta["y_range"] = [float(ys[0]), float(ys[-1])]
            np.save(os.path.join(out_dir, "xCoordinates.npy"), xs)
            np.save(os.path.join(out_dir, "yCoordinates.npy"), ys)

        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "chunk_table.json"), "w") as fh:
            json.dump(table, fh)
        with open(os.path.join(out_dir, "recon.json"), "w") as fh:
            json.dump(meta, fh, indent=2)
        print()
        print("wrote", os.path.join(out_dir, "recon.json"))
        print("wrote", os.path.join(out_dir, "chunk_table.json"))


def read_projection(f, freq="frequencyA"):
    g = f["/science/LSAR/GCOV/grids/%s/projection" % freq]
    a = g.attrs
    return {
        "epsg": int(a["epsg_code"]),
        "lon0": float(a["longitude_of_central_merinder"]) if "longitude_of_central_merinder" in a else float(a["longitude_of_central_meridian"]),
        "k0": float(a["scale_factor_at_central_meridian"]),
        "fe": float(a["false_easting"]),
        "fn": float(a["false_northing"]),
        "a": float(a["semi_major_axis"]),
        "inv_f": float(a["inverse_flattening"]),
        "lat0": float(a["latitude_of_projection_origin"]),
        "north": float(a["false_northing"]) == 0.0,
    }


def utm_forward(lat_deg, lon_deg, pr):
    """WGS84 transverse Mercator forward using the file's own projection parameters."""
    a = pr["a"]
    f = 1.0 / pr["inv_f"]
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    k0 = pr["k0"]

    phi = math.radians(lat_deg)
    lam = math.radians(lon_deg - pr["lon0"])
    sp, cp, tp = math.sin(phi), math.cos(phi), math.tan(phi)

    n = a / math.sqrt(1 - e2 * sp * sp)
    t = tp * tp
    c = ep2 * cp * cp
    aa = lam * cp
    m = a * (
        (1 - e2 / 4 - 3 * e2 * e2 / 64) * phi
        - (3 * e2 / 8 + 3 * e2 * e2 / 32) * math.sin(2 * phi)
        + (15 * e2 * e2 / 256) * math.sin(4 * phi)
        - (35 * e2 ** 3 / 4096) * math.sin(6 * phi)
    )

    easting = k0 * n * (aa + (1 - t + c) * aa ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * aa ** 5 / 120) + pr["fe"]
    northing = k0 * (m + n * tp * (aa * aa / 2 + (5 - t + 9 * c + 4 * c * c) * aa ** 4 / 24)) + pr["fn"]
    if not pr["north"]:
        northing += 10000000.0
    return easting, northing


def _row_range(ys, y_lo, y_hi):
    """Row indices for a y span on a north-to-south descending coordinate array."""
    ys_asc = ys[::-1]
    lo = int(np.searchsorted(ys_asc, y_lo, "left"))
    hi = int(np.searchsorted(ys_asc, y_hi, "right"))
    return min(lo, hi), max(lo, hi)


def _col_range(xs, x_lo, x_hi):
    lo = int(np.searchsorted(xs, x_lo, "left"))
    hi = int(np.searchsorted(xs, x_hi, "right"))
    return min(lo, hi), max(lo, hi)


def describe(name, arr):
    finite = arr[np.isfinite(arr)]
    nan_bits = sorted(set(arr[~np.isfinite(arr)].view(np.uint32).tolist()))
    d = {
        "name": name,
        "rows": int(arr.shape[0]),
        "cols": int(arr.shape[1]),
        "elements": int(arr.size),
        "sha256": hashlib.sha256(arr.tobytes()).hexdigest(),
        "finite": int(finite.size),
        "nan_count": int(arr.size - finite.size),
        "nan_bitpatterns": [hex(b) for b in nan_bits[:8]],
        "n_nan_bitpatterns": len(nan_bits),
        "exact_zero": int((arr == 0).sum()),
    }
    if finite.size:
        d["min"] = float(finite.min())
        d["max"] = float(finite.max())
        d["mean"] = float(finite.mean())
        d["mean_db"] = float(10.0 * math.log10(max(finite.mean(), 1e-30)))
    return d


def emit(d, arr, out_dir):
    fn = "%s_%d_%d_%d.f32" % (d["name"], d["rows"], d["cols"], d["elements"])
    p = os.path.join(out_dir, fn)
    with open(p, "wb") as fh:
        fh.write(arr.tobytes())
    d["file"] = fn
    d["bytes"] = os.path.getsize(p)
    cov = d.get("coverage", d["finite"] / float(d["elements"]))
    print(
        "  %-18s rows=%-6d cols=%-6d finite=%-8d nan=%-8d mean=%-8s cov=%5.1f%%  %s"
        % (
            d["name"],
            d["rows"],
            d["cols"],
            d["finite"],
            d["nan_count"],
            ("%.2f dB" % d["mean_db"]) if "mean_db" in d else "n/a",
            cov * 100.0,
            d["sha256"][:16],
        )
    )


def mode_goldens(path, out_dir, aoi_lat, aoi_lon, radius_km):
    with h5py.File(path, "r") as f:
        d = f[DATASET]
        xs = np.asarray(f[COORD_X][...])
        ys = np.asarray(f[COORD_Y][...])
        pr = read_projection(f, "frequencyA")
        print("projection      : EPSG:%d  lon0=%.1f k0=%.4f fe=%.0f" % (pr["epsg"], pr["lon0"], pr["k0"], pr["fe"]))

        cr, cc = d.chunks
        nr, nc = d.shape
        with open(os.path.join(out_dir, "recon.json")) as fh:
            recon = json.load(fh)
        hi = recon["highest_address_chunk"]

        print("frame extent: x %.0f..%.0f m, y %.0f..%.0f m" % (xs[0], xs[-1], ys[0], ys[-1]))
        print("pixel spacing: dx=%+.4f dy=%+.4f m" % (recon["dx_m"], recon["dy_m"]))
        print()

        cx_utm, cy_utm = utm_forward(aoi_lat, aoi_lon, pr)
        span = radius_km * 1000.0
        x_lo, x_hi = cx_utm - span, cx_utm + span
        y_lo, y_hi = cy_utm - span, cy_utm + span
        print("AOI lon=%.4f lat=%.4f r=%g km -> EPSG:%d x=%.1f y=%.1f" % (aoi_lon, aoi_lat, radius_km, pr["epsg"], cx_utm, cy_utm))
        assert xs[0] <= x_lo and x_hi <= xs[-1], "AOI east/west outside frame"
        assert ys[-1] <= y_lo and y_hi <= ys[0], "AOI north/south outside frame"

        footprint_path = os.path.join(out_dir, "footprint.npy")
        if os.path.exists(footprint_path):
            footprint = np.load(footprint_path)
            print("footprint map  : cached %s (chunk cells with data: %d/%d)"
                  % (footprint.shape, int(footprint.sum()), footprint.size))
        else:
            print("footprint map  : computing one sample per chunk (reads all chunks once) ...")
            footprint = np.isfinite(np.asarray(d[::cr, ::cc]))
            np.save(footprint_path, footprint)
            print("footprint map  : %s (chunk cells with data: %d/%d)"
                  % (footprint.shape, int(footprint.sum()), footprint.size))

        def coverage_of(lon_c, lat_c):
            """Chunk-resolution coverage: pure numpy, no data read."""
            cxu, cyu = utm_forward(lat_c, lon_c, pr)
            rr = _row_range(ys, cyu - span, cyu + span)
            ccx = _col_range(xs, cxu - span, cxu + span)
            r_lo, r_hi = rr[0] // cr, (rr[1] - 1) // cr + 1
            c_lo, c_hi = ccx[0] // cc, (ccx[1] - 1) // cc + 1
            blk = footprint[r_lo:r_hi, c_lo:c_hi]
            return float(blk.mean()) if blk.size else 0.0

        aoi_rows = _row_range(ys, y_lo, y_hi)
        aoi_cols = _col_range(xs, x_lo, x_hi)
        cov = coverage_of(aoi_lon, aoi_lat)
        print("  centre coverage %.1f%%" % (cov * 100))

        poly_lon = (94.3, 94.9)
        poly_lat = (26.2, 26.7)
        if cov < 0.95:
            print("  snapping centre to full-coverage point inside lon %s lat %s ..." % (poly_lon, poly_lat))
            best = (cov, aoi_lon, aoi_lat)
            lons = [poly_lon[0] + 0.01 * i for i in range(int(round((poly_lon[1] - poly_lon[0]) / 0.01)) + 1)]
            lats = [poly_lat[0] + 0.01 * i for i in range(int(round((poly_lat[1] - poly_lat[0]) / 0.01)) + 1)]
            for la in lats:
                for lo in lons:
                    c = coverage_of(lo, la)
                    if c > best[0]:
                        best = (c, lo, la)
            cov, aoi_lon, aoi_lat = best
            cx_utm, cy_utm = utm_forward(aoi_lat, aoi_lon, pr)
            x_lo, x_hi = cx_utm - span, cx_utm + span
            y_lo, y_hi = cy_utm - span, cy_utm + span
            aoi_rows = _row_range(ys, y_lo, y_hi)
            aoi_cols = _col_range(xs, x_lo, x_hi)
            print("  snapped centre lon=%.4f lat=%.4f coverage %.1f%%" % (aoi_lon, aoi_lat, cov * 100))

        print("  box: x %.0f..%.0f m, y %.0f..%.0f m" % (x_lo, x_hi, y_lo, y_hi))
        aoi = np.ascontiguousarray(d[aoi_rows[0]:aoi_rows[1], aoi_cols[0]:aoi_cols[1]])
        cov = float(np.isfinite(aoi).mean())
        print("  AOI pixels: rows %d..%d cols %d..%d = %d x %d, finite coverage %.1f%%"
              % (aoi_rows[0], aoi_rows[1], aoi_cols[0], aoi_cols[1],
                 aoi.shape[0], aoi.shape[1], cov * 100))
        if cov < 0.9:
            print("  WARNING: AOI coverage under 90%")
        print()

        windows = []
        windows.append(("aoi", aoi_rows, aoi_cols))

        c = 200
        windows.append(("corner_tl", (0, c), (0, c)))
        windows.append(("corner_tr", (0, c), (nc - c, nc)))
        windows.append(("corner_bl", (nr - c, nr), (0, c)))
        windows.append(("corner_br", (nr - c, nr), (nc - c, nc)))

        rb = cr * 20
        cb = cc * 10
        h = 64
        windows.append(("straddle_r_exact", (rb - h, rb + h), (cb - h, cb + h)))
        windows.append(("straddle_r_plus1", (rb - h + 1, rb + h + 1), (cb - h, cb + h)))
        windows.append(("straddle_c_exact", (rb - h, rb + h), (cb - h, cb + h)))
        windows.append(("straddle_c_plus1", (rb - h, rb + h), (cb - h + 1, cb + h + 1)))

        windows.append(("single_chunk", (hi["row"], hi["row"] + 64), (hi["col"], hi["col"] + 64)))
        windows.append(("highaddr_chunk", (hi["row"], hi["row"] + cr), (hi["col"], hi["col"] + cc)))
        windows.append(("nan_region", (0, cr), (0, cc)))

        last_r = ((nr - 1) // cr) * cr
        last_c = ((nc - 1) // cc) * cc
        windows.append(("edge_partial_r", (last_r, nr), (cc * 30, cc * 31)))
        windows.append(("edge_partial_c", (cr * 30, cr * 31), (last_c, nc)))
        windows.append(("edge_corner", (last_r, nr), (last_c, nc)))
        windows.append(("edge_straddle_last", (last_r - 64, last_r + 64), (last_c - 64, last_c + 64)))

        print("gamma-0 windows (GCOV HHHH; sigma0 requires rtcGammaToSigmaFactor):")
        manifest = {"dataset": DATASET, "dtype": "float32", "layout": "C order (row-major)",
                    "projection_epsg": pr["epsg"], "aoi_lon_lat_radius_km": [aoi_lon, aoi_lat, radius_km],
                    "aoi_rows": list(aoi_rows), "aoi_cols": list(aoi_cols), "windows": []}
        for name, (r0, r1), (c0, c1) in windows:
            r0i, r1i = max(0, r0), min(nr, r1)
            c0i, c1i = max(0, c0), min(nc, c1)
            if r1i <= r0i or c1i <= c0i:
                print("  %-18s SKIPPED (empty)" % name)
                continue
            arr = np.ascontiguousarray(d[r0i:r1i, c0i:c1i])
            ent = describe(name, arr)
            ent["row_range"] = [r0i, r1i]
            ent["col_range"] = [c0i, c1i]
            ent["chunks_touched"] = ((r1i - 1) // cr - r0i // cr + 1) * ((c1i - 1) // cc - c0i // cc + 1)
            ent["coverage"] = float(np.isfinite(arr).mean())
            emit(ent, arr, out_dir)
            manifest["windows"].append(ent)

        fb = f["/science/LSAR/GCOV/grids/frequencyB/HHHH"]
        bxs = np.asarray(f["/science/LSAR/GCOV/grids/frequencyB/xCoordinates"][...])
        bys = np.asarray(f["/science/LSAR/GCOV/grids/frequencyB/yCoordinates"][...])
        fbr, fbc = fb.chunks
        print()
        print("frequencyB (S-band, %.0f m) differential-test windows, shape %s:" % (recon["dx_m"] * 8, fb.shape))
        fb_rows = _row_range(bys, y_lo, y_hi)
        fb_cols = _col_range(bxs, x_lo, x_hi)
        fwindows = [
            ("fb_aoi", fb_rows, fb_cols),
            ("fb_topleft", (0, 1500), (0, 1500)),
            ("fb_straddle", (fbr * 7 - 33, fbr * 7 + 33), (fbc * 5 - 33, fbc * 5 + 33)),
            ("fb_edge", (fb.shape[0] - 137, fb.shape[0]), (fb.shape[1] - 211, fb.shape[1])),
            ("fb_tiny", (1234, 1234 + 3), (2345, 2345 + 5)),
        ]
        manifest["frequencyB"] = {"dataset": "/science/LSAR/GCOV/grids/frequencyB/HHHB".replace("HHB", "HHH"),
                                  "shape": list(fb.shape), "chunks": list(fb.chunks),
                                  "dx_m": float(bxs[1] - bxs[0]), "fillvalue_hex": fb.fillvalue.tobytes().hex(),
                                  "windows": []}
        for name, (r0, r1), (c0, c1) in fwindows:
            r0i, r1i = max(0, r0), min(fb.shape[0], r1)
            c0i, c1i = max(0, c0), min(fb.shape[1], c1)
            arr = np.ascontiguousarray(fb[r0i:r1i, c0i:c1i])
            ent = describe(name, arr)
            ent["row_range"] = [r0i, r1i]
            ent["col_range"] = [c0i, c1i]
            ent["chunks_touched"] = ((r1i - 1) // fbr - r0i // fbr + 1) * ((c1i - 1) // fbc - c0i // fbc + 1)
            ent["coverage"] = float(np.isfinite(arr).mean())
            emit(ent, arr, out_dir)
            manifest["frequencyB"]["windows"].append(ent)

        with open(os.path.join(out_dir, "goldens.json"), "w") as fh:
            json.dump(manifest, fh, indent=2)

        tsv_path = os.path.join(out_dir, "goldens.tsv")
        with open(tsv_path, "w") as fh:
            fh.write("name\tdataset\trows\tcols\trow_start\trow_end\tcol_start\tcol_end\tsha256\tfile\n")
            for ent in manifest["windows"]:
                fh.write("%s\t%s\t%d\t%d\t%d\t%d\t%d\t%d\t%s\t%s\n" % (
                    ent["name"], DATASET, ent["rows"], ent["cols"],
                    ent["row_range"][0], ent["row_range"][1],
                    ent["col_range"][0], ent["col_range"][1],
                    ent["sha256"], ent["file"]))
            for ent in manifest["frequencyB"]["windows"]:
                fh.write("%s\t%s\t%d\t%d\t%d\t%d\t%d\t%d\t%s\t%s\n" % (
                    ent["name"], manifest["frequencyB"]["dataset"], ent["rows"], ent["cols"],
                    ent["row_range"][0], ent["row_range"][1],
                    ent["col_range"][0], ent["col_range"][1],
                    ent["sha256"], ent["file"]))
        print()
        print("wrote", os.path.join(out_dir, "goldens.json"))
        print("wrote", tsv_path)



def make_fixture(path):
    """Synthetic chunked fixture: NaN fill, unwritten chunks, ragged edges.

    Written with per-chunk hyperslab slices so that some grid cells are never
    allocated. A whole-array assignment would materialise every chunk and the
    missing-chunk path would go untested.
    """
    cr, cc = 8, 8
    rows, cols = 20, 35
    grid_r = (rows + cr - 1) // cr
    grid_c = (cols + cc - 1) // cc

    with h5py.File(path, "w") as f:
        d = f.create_dataset(
            "/ragged",
            shape=(rows, cols),
            chunks=(cr, cc),
            dtype="float32",
            fillvalue=np.float32("nan"),
            compression="gzip",
            compression_opts=4,
            shuffle=True,
        )
        written_cells = []
        for gr in range(grid_r):
            for gc in range(grid_c):
                if (gr + gc) % 3 == 0:
                    continue
                r0, r1 = gr * cr, min((gr + 1) * cr, rows)
                c0, c1 = gc * cc, min((gc + 1) * cc, cols)
                rr = np.arange(r0, r1)[:, None]
                cc_ = np.arange(c0, c1)[None, :]
                d[r0:r1, c0:c1] = (rr * 1000 + cc_).astype(np.float32)
                written_cells.append((gr, gc))

        stored = d.id.get_num_chunks()
        print("fixture shape %s chunks %s fillvalue %s" % (d.shape, d.chunks, d.fillvalue))
        print("grid cells: %d x %d = %d" % (grid_r, grid_c, grid_r * grid_c))
        print("hyperslab-written cells: %d" % len(written_cells))
        print("libhdf5 chunks stored:  %d" % stored)
        print("cells absent (must be > 0): %d" % (grid_r * grid_c - stored))
        full = d[...]
        print("finite fraction of full read: %.4f" % float(np.isfinite(full).mean()))

        with open(path + ".tsv", "w") as fh:
            fh.write("name\trows\tcols\trow_start\trow_end\tcol_start\tcol_end\tsha256\tfile\n")
            cases = [
                ("all", 0, rows, 0, cols),
                ("first_chunk", 0, cr, 0, cc),
                ("missing_only", cr, 2 * cr, 0, cc),
                ("ragged_edge_r", rows - 5, rows, 0, cols),
                ("ragged_edge_c", 0, rows, cols - 6, cols),
                ("ragged_corner", rows - 3, rows, cols - 3, cols),
                ("single_pixel", 7, 8, 9, 10),
                ("straddle", cr - 1, cr + 1, cc - 1, cc + 1),
            ]
            for name, r0, r1, c0, c1 in cases:
                arr = np.ascontiguousarray(d[r0:r1, c0:c1])
                fn = "fixture_%s.f32" % name
                with open(os.path.join(os.path.dirname(path), fn), "wb") as g:
                    g.write(arr.tobytes())
                fh.write("%s\t%d\t%d\t%d\t%d\t%d\t%d\t%s\t%s\n" % (
                    name, arr.shape[0], arr.shape[1], r0, r1, c0, c1,
                    hashlib.sha256(arr.tobytes()).hexdigest(), fn))
        print("wrote", path)
        print("wrote", path + ".tsv")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    if sys.argv[2] == "fixture" and len(sys.argv) >= 4:
        make_fixture(sys.argv[3])
        return
    path = sys.argv[1]
    mode = sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else "goldens"
    os.makedirs(out_dir, exist_ok=True)
    if mode == "recon":
        mode_recon(path, out_dir)
    elif mode == "goldens":
        lat = float(sys.argv[4]) if len(sys.argv) > 4 else 26.40
        lon = float(sys.argv[5]) if len(sys.argv) > 5 else 94.75
        rad = float(sys.argv[6]) if len(sys.argv) > 6 else 10.0
        mode_goldens(path, out_dir, lat, lon, rad)
    elif mode == "fixture":
        make_fixture(sys.argv[3])
    else:
        print("mode %r not implemented yet" % mode)
        sys.exit(2)


if __name__ == "__main__":
    main()
