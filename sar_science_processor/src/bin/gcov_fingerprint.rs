use std::collections::HashSet;
use std::process;

use rustyhdf5::{DType, MmapFile, MmapGroup};
use rustyhdf5_format::chunked_read::collect_chunk_info;
use rustyhdf5_format::data_layout::DataLayout;
use rustyhdf5_format::filter_pipeline::FilterPipeline;
use rustyhdf5_format::message_type::MessageType;
use rustyhdf5_format::object_header::ObjectHeader;

fn filter_name(id: u16) -> String {
    match id {
        1 => "deflate".to_string(),
        2 => "shuffle".to_string(),
        3 => "fletcher32".to_string(),
        4 => "szip".to_string(),
        32001 => "blosc".to_string(),
        32004 => "szip".to_string(),
        32008 => "nbit".to_string(),
        32015 => "scaleoffset".to_string(),
        other => format!("id={}", other),
    }
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("usage: gcov_fingerprint <file.h5> [window_rows window_cols]");
        process::exit(2);
    }
    let path = &args[1];
    let (win_rows, win_cols) = if args.len() >= 4 {
        (
            args[2].parse::<u64>().unwrap_or(1000),
            args[3].parse::<u64>().unwrap_or(1000),
        )
    } else {
        (1000, 1000)
    };

    let file = MmapFile::open(path)?;
    let sb = file.superblock();
    let data = file.as_bytes();

    println!("file             : {}", path);
    println!(
        "size on disk     : {:.2} GB",
        std::fs::metadata(path)?.len() as f64 / (1024.0 * 1024.0 * 1024.0)
    );
    println!("mapped bytes     : {} (memory-mapped, not resident)", data.len());
    println!("superblock ver   : {}", sb.version);
    println!("offset_size      : {}", sb.offset_size);
    println!("length_size      : {}", sb.length_size);
    println!();

    let root = file.root();
    println!("root groups      : {:?}", root.groups()?);
    println!("root datasets    : {:?}", root.datasets()?);
    println!();

    let mut paths: Vec<(String, Vec<u64>, String)> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    collect(root, "", 0, &mut paths, &mut seen)?;

    println!("{:<62} {:<18} {}", "dataset", "shape", "dtype");
    println!("{}", "-".repeat(100));
    for (p, shape, dt) in &paths {
        let dims = shape
            .iter()
            .map(|d| d.to_string())
            .collect::<Vec<_>>()
            .join("x");
        println!("{:<62} {:<18} {}", p, dims, dt);
    }
    println!();

    let mut detailed = 0usize;
    for (p, shape, dt) in &paths {
        if dt != "F32" || shape.len() != 2 {
            continue;
        }
        let elems = shape[0].saturating_mul(shape[1]);
        if elems < 1_000_000 {
            continue;
        }
        detailed += 1;
        println!("=== layout detail: {} ===", p);
        detail(&data, sb, p, shape, win_rows, win_cols)?;
        println!();
    }

    if detailed == 0 {
        println!("no chunked 2-D f32 datasets above 1M elements were found");
    }

    Ok(())
}

fn collect(
    group: MmapGroup<'_>,
    prefix: &str,
    depth: usize,
    out: &mut Vec<(String, Vec<u64>, String)>,
    seen: &mut HashSet<String>,
) -> anyhow::Result<()> {
    if depth > 6 {
        return Ok(());
    }
    for name in group.datasets()? {
        let full = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", prefix, name)
        };
        if !seen.insert(full.clone()) {
            continue;
        }
        let ds = match group.dataset(&name) {
            Ok(d) => d,
            Err(_) => continue,
        };
        let shape = match ds.shape() {
            Ok(s) => s,
            Err(_) => continue,
        };
        let dt = format!("{:?}", ds.dtype().unwrap_or(DType::U8));
        out.push((full, shape, dt));
    }
    for gname in group.groups()? {
        let full = if prefix.is_empty() {
            gname.clone()
        } else {
            format!("{}/{}", prefix, gname)
        };
        if let Ok(child) = group.group(&gname) {
            collect(child, &full, depth + 1, out, seen)?;
        }
    }
    Ok(())
}

fn detail(
    data: &[u8],
    sb: &rustyhdf5_format::superblock::Superblock,
    path: &str,
    shape: &[u64],
    win_rows: u64,
    win_cols: u64,
) -> anyhow::Result<()> {
    let addr = match rustyhdf5_format::group_v2::resolve_path_any(data, sb, path) {
        Ok(a) => a,
        Err(e) => {
            println!("  resolve failed  : {}", e);
            return Ok(());
        }
    };
    let hdr = ObjectHeader::parse(data, addr as usize, sb.offset_size, sb.length_size)?;

    let layout_msg = hdr.messages.iter().find(|m| m.msg_type == MessageType::DataLayout);
    let layout = match layout_msg {
        Some(m) => DataLayout::parse(&m.data, sb.offset_size, sb.length_size),
        None => {
            println!("  no DataLayout message");
            return Ok(());
        }
    };
    let layout = match layout {
        Ok(l) => l,
        Err(e) => {
            println!("  DataLayout parse failed: {}", e);
            return Ok(());
        }
    };

    let pipeline = hdr
        .messages
        .iter()
        .find(|m| m.msg_type == MessageType::FilterPipeline)
        .and_then(|m| FilterPipeline::parse(&m.data).ok());

    let filters: Vec<String> = match &pipeline {
        Some(p) => p
            .filters
            .iter()
            .map(|f: &rustyhdf5_format::filter_pipeline::FilterDescription| {
                format!("{}{}", filter_name(f.filter_id), if f.flags & 1 == 1 { "(opt)" } else { "" })
            })
            .collect(),
        None => vec!["none".to_string()],
    };

    match &layout {
        DataLayout::Chunked {
            chunk_dimensions,
            btree_address,
            version,
            chunk_index_type,
            ..
        } => {
            println!("  layout          : Chunked v{}", version);
            println!("  chunk dims      : {:?}", chunk_dimensions);
            println!("  chunk index type: {:?}", chunk_index_type);
            println!("  btree address   : {:?}", btree_address);
            println!("  filters         : {}", filters.join(" -> "));

            if chunk_dimensions.len() < 2 {
                return Ok(());
            }
            let elem_size: u64 = 4;
            let rows = shape[0];
            let cols = shape[1];
            // chunk_dimensions is [row_chunk, col_chunk, element_size]: the
            // layout message stores the trailing element-size dimension too.
            // Reading [1] and [2] would divide the column count by 4 and
            // report a chunk grid of 66x8550 instead of 66x67.
            let chunk_r = chunk_dimensions[0] as u64;
            let chunk_c = chunk_dimensions[1] as u64;

            let full_bytes = rows.saturating_mul(cols).saturating_mul(elem_size);
            let chunks_r = rows.div_ceil(chunk_r);
            let chunks_c = cols.div_ceil(chunk_c);
            let total_chunks = chunks_r.saturating_mul(chunks_c);

            println!("  full-band read  : {:.2} GB  ({} rows x {} cols x {} B)", full_bytes as f64 / 1073741824.0, rows, cols, elem_size);
            println!("  chunk grid      : {} x {} = {} chunks", chunks_r, chunks_c, total_chunks);
            println!("  chunk uncompressed: {} MB", total_chunks.saturating_mul(chunk_r).saturating_mul(chunk_c).saturating_mul(elem_size) / (1024 * 1024));

            let wr = win_rows.min(rows);
            let wc = win_cols.min(cols);
            let r0 = (rows.saturating_sub(wr)) / 2;
            let c0 = (cols.saturating_sub(wc)) / 2;
            let r1 = (r0 + wr).min(rows);
            let c1 = (c0 + wc).min(cols);
            let span_r = (r1.saturating_sub(1) / chunk_r) - (r0 / chunk_r) + 1;
            let span_c = (c1.saturating_sub(1) / chunk_c) - (c0 / chunk_c) + 1;
            let window_chunks = span_r.saturating_mul(span_c);
            let window_bytes = window_chunks
                .saturating_mul(chunk_r)
                .saturating_mul(chunk_c)
                .saturating_mul(elem_size);
            let out_bytes = wr.saturating_mul(wc).saturating_mul(elem_size);

            println!();
            println!("  -- centered window {}x{} px --", wr, wc);
            println!("  chunks touched  : {} of {}  ({:.2}% of the grid)", window_chunks, total_chunks, 100.0 * window_chunks as f64 / total_chunks.max(1) as f64);
            println!("  chunk bytes     : {:.2} MB (decompressed working set)", window_bytes as f64 / (1024.0 * 1024.0));
            println!("  output array    : {:.2} MB", out_bytes as f64 / (1024.0 * 1024.0));
            println!("  vs full read    : {:.0}x less", full_bytes as f64 / window_bytes.max(1) as f64);

            if let Some(bt) = btree_address {
                match collect_chunk_info(data, *bt, chunk_dimensions.len(), sb.offset_size, sb.length_size) {
                    Ok(chunks) => {
                        println!("  btree v1 chunks : {} entries (index scan OK)", chunks.len());
                    }
                    Err(e) => println!("  btree v1 scan failed: {}", e),
                }
            }
        }
        other => println!("  layout          : {:?}", std::mem::discriminant(other)),
    }

    Ok(())
}
