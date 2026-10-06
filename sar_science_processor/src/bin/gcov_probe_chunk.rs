use std::collections::BTreeMap;
use std::process;

use rustyhdf5::MmapFile;
use rustyhdf5_format::chunked_read::collect_chunk_info;
use rustyhdf5_format::data_layout::DataLayout;
use rustyhdf5_format::filter_pipeline::FilterPipeline;
use rustyhdf5_format::filters::decompress_chunk;
use rustyhdf5_format::message_type::MessageType;
use rustyhdf5_format::object_header::ObjectHeader;

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: gcov_probe_chunk <file.h5> <dataset path> [probe_row probe_col]");
        process::exit(2);
    }
    let path = &args[1];
    let dpath = &args[2];
    let (prow, pcol) = if args.len() >= 5 {
        (
            args[3].parse::<u64>().unwrap_or(0),
            args[4].parse::<u64>().unwrap_or(0),
        )
    } else {
        (0, 0)
    };

    let file = MmapFile::open(path)?;
    let sb = file.superblock();
    let data = file.as_bytes();

    let addr = rustyhdf5_format::group_v2::resolve_path_any(data, sb, dpath)?;
    let hdr = ObjectHeader::parse(data, addr as usize, sb.offset_size, sb.length_size)?;

    let layout = {
        let m = hdr
            .messages
            .iter()
            .find(|m| m.msg_type == MessageType::DataLayout)
            .ok_or_else(|| anyhow::anyhow!("no DataLayout message"))?;
        DataLayout::parse(&m.data, sb.offset_size, sb.length_size)?
    };

    let pipeline = hdr
        .messages
        .iter()
        .find(|m| m.msg_type == MessageType::FilterPipeline)
        .map(|m| FilterPipeline::parse(&m.data))
        .transpose()?;

    let (chunk_dims, btree) = match &layout {
        DataLayout::Chunked {
            chunk_dimensions,
            btree_address,
            ..
        } => (chunk_dimensions.clone(), btree_address.clone().unwrap_or(0)),
        _ => return Err(anyhow::anyhow!("dataset is not chunked")),
    };

    println!("dataset      : {}", dpath);
    println!("chunk dims   : {:?}", chunk_dims);
    println!("pipeline     : {}", pipeline.as_ref().map(|p| p.filters.iter().map(|f| format!("{}", f.filter_id)).collect::<Vec<_>>().join("->")).unwrap_or_else(|| "none".into()));

    let chunks = collect_chunk_info(data, btree, chunk_dims.len(), sb.offset_size, sb.length_size)?;
    println!("chunks in btree: {}", chunks.len());

    println!();
    println!("first 5 chunk offsets (to learn coordinate ordering):");
    for c in chunks.iter().take(5) {
        println!("   offsets={:?} addr={} size={} mask=0x{:x}", c.offsets, c.address, c.chunk_size, c.filter_mask);
    }

    let mut masks: BTreeMap<u32, usize> = BTreeMap::new();
    for c in &chunks {
        *masks.entry(c.filter_mask).or_insert(0) += 1;
    }
    println!();
    println!("filter_mask histogram: {:?}", masks);

    let total_compressed: u64 = chunks.iter().map(|c| c.chunk_size as u64).sum();
    let avg = total_compressed / chunks.len().max(1) as u64;
    println!("compressed total: {} MB, avg/chunk {} KB", total_compressed / (1024 * 1024), avg / 1024);

    let mut with_col_offset = 0usize;
    let mut max_off1 = 0u64;
    let mut max_off2 = 0u64;
    for c in &chunks {
        if c.offsets.len() >= 3 {
            if c.offsets[2] != 0 {
                with_col_offset += 1;
            }
            max_off1 = max_off1.max(c.offsets[1]);
            max_off2 = max_off2.max(c.offsets[2]);
        }
    }
    println!();
    println!("chunks with offsets[2] != 0 : {}", with_col_offset);
    println!("max offsets[1] (row chunk?) : {}", max_off1);
    println!("max offsets[2] (col chunk?) : {}", max_off2);

    let mut max_off0 = 0u64;
    for c in &chunks {
        if c.offsets.len() >= 3 {
            max_off0 = max_off0.max(c.offsets[0]);
        }
    }
    println!();
    println!("chunks with offsets[2] != 0 : {}", with_col_offset);
    println!("max offsets[0]              : {}", max_off0);
    println!("max offsets[1] (row chunk?) : {}", max_off1);
    println!("max offsets[2] (col chunk?) : {}", max_off2);
    println!();

    let hint = chunk_dims.iter().map(|d| *d as usize).product::<usize>() * 4;
    let pipeline_ref = pipeline.as_ref().unwrap();

    let mut samples: Vec<(usize, f32, u64)> = Vec::new();
    let step = (chunks.len() / 40).max(1);
    for (i, c) in chunks.iter().enumerate() {
        if i % step != 0 {
            continue;
        }
        let s = c.address as usize;
        let e = s + c.chunk_size as usize;
        if e > data.len() {
            continue;
        }
        if let Ok(dec) = decompress_chunk(&data[s..e], pipeline_ref, hint, 4) {
            if dec.len() % 4 != 0 {
                continue;
            }
            let vals = bytemuck_slice(&dec);
            let finite = vals.iter().filter(|v| v.is_finite()).count();
            samples.push((i, finite as f32 / vals.len() as f32, c.offsets[1]));
        }
    }
    println!("sampled {} chunks across the btree:", samples.len());
    for (i, frac, off) in samples.iter().take(40) {
        println!("   idx {:<6} off1={:<7} finite={:>6.1}%", i, off, frac * 100.0);
    }
    if let Some((best_i, _, _)) = samples.iter().max_by(|a, b| a.1.partial_cmp(&b.1).unwrap()) {
        println!();
        println!("densest data chunk: index {}", best_i);
        let c = &chunks[*best_i];
        let s = c.address as usize;
        let e = s + c.chunk_size as usize;
        let decoded = decompress_chunk(&data[s..e], pipeline_ref, hint, 4)?;
        let vals = bytemuck_slice(&decoded);
        println!("  offsets={:?} addr={} compressed={} KB", c.offsets, c.address, c.chunk_size / 1024);
        let finite: Vec<f32> = vals.iter().copied().filter(|v| v.is_finite()).collect();
        if !finite.is_empty() {
            let min = finite.iter().cloned().fold(f32::INFINITY, f32::min);
            let max = finite.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
            let mean: f64 = finite.iter().map(|v| *v as f64).sum::<f64>() / finite.len() as f64;
            println!("  finite     : {}/{}", finite.len(), vals.len());
            println!("  min        : {:e}  ({:.2} dB)", min, 10.0 * min.max(1e-30).log10());
            println!("  max        : {:e}  ({:.2} dB)", max, 10.0 * max.max(1e-30).log10());
            println!("  mean       : {:e}  ({:.2} dB)", mean, 10.0 * mean.max(1e-30).log10());
            let neg = finite.iter().filter(|v| **v < 0.0).count();
            let zero = finite.iter().filter(|v| **v == 0.0).count();
            println!("  negative   : {}", neg);
            println!("  exact zero : {}", zero);
        }
        let again = decompress_chunk(&data[s..e], pipeline_ref, hint, 4)?;
        println!("  deterministic: {}", again == decoded);
    }
    println!();
    println!("requested pixel row={} col={} (informational)", prow, pcol);

    Ok(())
}

fn bytemuck_slice(bytes: &[u8]) -> &[f32] {
    let ptr = bytes.as_ptr() as *const f32;
    unsafe { std::slice::from_raw_parts(ptr, bytes.len() / 4) }
}
