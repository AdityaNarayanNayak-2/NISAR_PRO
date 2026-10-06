//! Memory-bounded windowed reader for chunked 2-D `f32` HDF5 datasets.
//!
//! `rustyhdf5`'s high-level reader materialises a whole dataset before any
//! slicing happens, which needs 4.28 GiB for a NISAR GCOV band. This module
//! decodes only the chunks that intersect a requested pixel window, so cost is
//! proportional to the window rather than the scene.
//!
//! Everything address-bearing is `u64`: the granules exceed 4 GiB, so a 32-bit
//! intermediate would silently wrap. Any layout, dtype, filter, or length the
//! reader does not fully understand surfaces as a [`WindowError`] rather than
//! degrading into a full-band read.

use std::collections::HashMap;
use std::fmt;
use std::path::Path;

use rustyhdf5::MmapFile;
use rustyhdf5_format::chunked_read::{collect_chunk_info, ChunkInfo};
use rustyhdf5_format::data_layout::DataLayout;
use rustyhdf5_format::dataspace::Dataspace;
use rustyhdf5_format::datatype::{Datatype, DatatypeByteOrder};
use rustyhdf5_format::error::FormatError;
use rustyhdf5_format::filter_pipeline::{FilterDescription, FilterPipeline};
use rustyhdf5_format::filters::decompress_chunk;
use rustyhdf5_format::message_type::MessageType;
use rustyhdf5_format::object_header::ObjectHeader;
use rustyhdf5_format::superblock::Superblock;

/// Only 32-bit IEEE little-endian floats are supported.
pub const ELEMENT_SIZE: u64 = 4;

/// Reasons a windowed read can refuse to produce data.
#[derive(Debug)]
pub enum WindowError {
    /// The file could not be opened or mapped.
    Open { detail: String },
    /// The dataset path did not resolve to an object.
    NotFound { path: String },
    /// The dataspace is not a 2-D simple array.
    UnsupportedRank { rank: u8 },
    /// The datatype is not 32-bit IEEE float.
    UnsupportedDatatype { detail: String },
    /// The layout is not chunked, or the chunk index is unusable.
    UnsupportedLayout { detail: String },
    /// A filter in the pipeline is not one this reader can undo.
    UnsupportedFilter { filter_id: u16 },
    /// The chunk index could not be walked.
    MissingChunkIndex { detail: String },
    /// A chunk offset is inconsistent with the declared chunk dimensions.
    InconsistentOffsets { detail: String },
    /// The requested window is empty, inverted, or outside the dataset.
    BadWindow { detail: String },
    /// A chunk's byte range falls outside the mapped file.
    ChunkOutOfFile {
        start: u64,
        end: u64,
        file_len: u64,
    },
    /// A chunk decoded to a length other than a full chunk of elements.
    ShortChunk {
        addr: u64,
        expected: u64,
        got: u64,
    },
    /// A size computation exceeded the addressable range.
    SizeOverflow { detail: String },
    /// Underlying HDF5 structure error.
    Format(FormatError),
}

impl fmt::Display for WindowError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WindowError::Open { detail } => write!(f, "cannot open file: {detail}"),
            WindowError::NotFound { path } => write!(f, "dataset not found: {path}"),
            WindowError::UnsupportedRank { rank } => {
                write!(f, "unsupported dataspace rank {rank}, expected 2")
            }
            WindowError::UnsupportedDatatype { detail } => write!(f, "unsupported datatype: {detail}"),
            WindowError::UnsupportedLayout { detail } => write!(f, "unsupported layout: {detail}"),
            WindowError::UnsupportedFilter { filter_id } => {
                write!(f, "unsupported filter id {filter_id}")
            }
            WindowError::MissingChunkIndex { detail } => write!(f, "chunk index unusable: {detail}"),
            WindowError::InconsistentOffsets { detail } => {
                write!(f, "inconsistent chunk offsets: {detail}")
            }
            WindowError::BadWindow { detail } => write!(f, "invalid window: {detail}"),
            WindowError::ChunkOutOfFile {
                start,
                end,
                file_len,
            } => write!(
                f,
                "chunk byte range {start}..{end} outside file of {file_len} bytes"
            ),
            WindowError::ShortChunk {
                addr,
                expected,
                got,
            } => write!(
                f,
                "chunk at {addr} decoded to {got} bytes, expected {expected}"
            ),
            WindowError::SizeOverflow { detail } => write!(f, "size overflow: {detail}"),
            WindowError::Format(e) => write!(f, "hdf5 format error: {e}"),
        }
    }
}

impl std::error::Error for WindowError {}

impl From<FormatError> for WindowError {
    fn from(e: FormatError) -> Self {
        WindowError::Format(e)
    }
}

/// Pixel rectangle, half-open, in dataset coordinates.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Window {
    pub row_start: u64,
    pub row_end: u64,
    pub col_start: u64,
    pub col_end: u64,
}

impl Window {
    pub fn rows(&self) -> u64 {
        self.row_end - self.row_start
    }
    pub fn cols(&self) -> u64 {
        self.col_end - self.col_start
    }
    pub fn elements(&self) -> u64 {
        self.rows() * self.cols()
    }
    pub fn validate(&self, rows: u64, cols: u64) -> Result<(), WindowError> {
        if self.row_start >= self.row_end || self.col_start >= self.col_end {
            return Err(WindowError::BadWindow {
                detail: format!(
                    "empty range rows {}..{} cols {}..{}",
                    self.row_start, self.row_end, self.col_start, self.col_end
                ),
            });
        }
        if self.row_end > rows || self.col_end > cols {
            return Err(WindowError::BadWindow {
                detail: format!(
                    "rows {}..{} cols {}..{} exceeds dataset {}x{}",
                    self.row_start, self.row_end, self.col_start, self.col_end, rows, cols
                ),
            });
        }
        Ok(())
    }
}

/// What a single windowed read actually touched.
#[derive(Debug, Clone, Default)]
pub struct WindowStats {
    /// Distinct chunk grid cells the window overlaps.
    pub cells_touched: u64,
    /// Chunks present in the chunk index and decoded.
    pub chunks_decoded: u64,
    /// Overlapping grid cells absent from the chunk index, left at the fill value.
    pub chunks_missing: u64,
    pub compressed_bytes: u64,
    pub decoded_bytes: u64,
    pub elapsed_ms: u128,
}

/// Chunk metadata for one 2-D `f32` dataset, plus the cache that avoids
/// re-walking the B-tree for every window.
pub struct ChunkIndex {
    pub dataset: String,
    pub rows: u64,
    pub cols: u64,
    pub chunk_rows: u64,
    pub chunk_cols: u64,
    /// Fill value from the dataset's Fill Value message, used where no chunk exists.
    pub fill: f32,
    /// How the fill value was determined, for reporting.
    pub fill_source: String,
    pub pipeline: FilterPipeline,
    /// Chunks in the index, keyed by their top-left pixel `(row, col)`.
    chunks: HashMap<(u64, u64), ChunkInfo>,
    /// Chunks the index reported.
    pub stored_chunks: usize,
    /// Grid cells the dataset shape implies.
    pub grid_cells: u64,
}

impl ChunkIndex {
    /// Grid cells present in the index, for reporting index completeness.
    pub fn stored_cells(&self) -> usize {
        self.chunks.len()
    }
}

/// A memory-mapped file plus the per-dataset chunk-index cache.
pub struct ChunkedF32Reader {
    file: MmapFile,
    cache: HashMap<String, ChunkIndex>,
}

impl ChunkedF32Reader {
    /// Map a file without reading any data pages.
    pub fn open(path: &Path) -> Result<Self, WindowError> {
        let file = MmapFile::open(path).map_err(|e| WindowError::Open {
            detail: format!("{e}"),
        })?;
        Ok(Self {
            file,
            cache: HashMap::new(),
        })
    }

    /// Mapped length of the file, for reporting.
    pub fn file_len(&self) -> u64 {
        self.file.as_bytes().len() as u64
    }

    /// Number of dataset indexes currently cached.
    pub fn cached_indexes(&self) -> usize {
        self.cache.len()
    }

    /// Build and cache the chunk index for `dataset` unless already present.
    pub fn ensure_index(&mut self, dataset: &str) -> Result<(), WindowError> {
        if self.cache.contains_key(dataset) {
            return Ok(());
        }
        let index = build_index(self.file.as_bytes(), self.file.superblock(), dataset)?;
        self.cache.insert(dataset.to_string(), index);
        Ok(())
    }

    /// Cached index for `dataset`, if it has been built.
    pub fn index_of(&self, dataset: &str) -> Option<&ChunkIndex> {
        self.cache.get(dataset)
    }

    /// Read a pixel window, decoding only intersecting chunks.
    pub fn read_window(&mut self, dataset: &str, window: Window) -> Result<Vec<f32>, WindowError> {
        self.read_window_with(dataset, window, |_| {})
            .map(|(data, _)| data)
    }

    /// Read a pixel window, reporting progress after every chunk decode.
    pub fn read_window_with<F>(
        &mut self,
        dataset: &str,
        window: Window,
        mut on_chunk: F,
    ) -> Result<(Vec<f32>, WindowStats), WindowError>
    where
        F: FnMut(&WindowStats),
    {
        let started = std::time::Instant::now();
        self.ensure_index(dataset)?;
        let index = self
            .cache
            .get(dataset)
            .expect("index inserted by ensure_index");
        let (mut data, mut stats) =
            read_window_from_with(index, self.file.as_bytes(), window, &mut on_chunk)?;
        stats.elapsed_ms = started.elapsed().as_millis();
        on_chunk(&stats);
        data.shrink_to_fit();
        Ok((data, stats))
    }
}

/// Decode the Fill Value message (type 0x0005) for a 32-bit float dataset.
fn parse_fill_value(msg: &[u8]) -> Result<(f32, String), WindowError> {
    // Layout confirmed against the bytes libhdf5 wrote for both a user-defined
    // NaN fill and a default fill:
    //   version(1) alloc(1) write(1) defined(1) size(4) value(size)
    // A zero size means no value is stored and the type default applies, which
    // is why the granule's HHHH dataset reads back as 0.0 despite `_FillValue`
    // being advertised as NaN. Callers pass only messages of at least 8 bytes;
    // the length check below stays as a guard for direct use.
    if msg.len() < 8 {
        return Err(WindowError::UnsupportedLayout {
            detail: format!("FillValue message too short: {} bytes", msg.len()),
        });
    }
    let version = msg[0];
    let defined = msg[3];
    if version != 1 && version != 2 {
        return Err(WindowError::UnsupportedLayout {
            detail: format!("FillValue message version {version}"),
        });
    }
    let size = u32::from_le_bytes([msg[4], msg[5], msg[6], msg[7]]);

    if size == 0 {
        return Ok((
            0.0,
            format!("size 0, no stored value, default 0.0 (defined flag {defined})"),
        ));
    }
    // The stored fill must match the element width of this f32 dataset, so
    // anything else (including a width-8 value that would belong to an f64
    // dataset) is refused rather than reinterpreted at the wrong offset.
    if size as u64 != ELEMENT_SIZE {
        return Err(WindowError::UnsupportedDatatype {
            detail: format!("fill value is {size} bytes, expected {ELEMENT_SIZE}"),
        });
    }
    let base = 8;
    if msg.len() < base + 4 {
        return Err(WindowError::UnsupportedLayout {
            detail: format!("FillValue declares {size} bytes but message is {}", msg.len()),
        });
    }
    let bytes: [u8; 4] = [msg[base], msg[base + 1], msg[base + 2], msg[base + 3]];
    Ok((
        f32::from_le_bytes(bytes),
        format!("stored, bits 0x{:08x} (defined flag {defined})", u32::from_le_bytes(bytes)),
    ))
}

/// Build the chunk index for a 2-D chunked `f32` dataset.
pub fn build_index(
    data: &[u8],
    sb: &Superblock,
    dataset: &str,
) -> Result<ChunkIndex, WindowError> {
    let addr = rustyhdf5_format::group_v2::resolve_path_any(data, sb, dataset)
        .map_err(|_| WindowError::NotFound {
            path: dataset.to_string(),
        })?;
    let header = ObjectHeader::parse(data, addr as usize, sb.offset_size, sb.length_size)?;

    let msg = |ty: MessageType| header.messages.iter().find(|m| m.msg_type == ty);

    let space = match msg(MessageType::Dataspace) {
        Some(m) => Dataspace::parse(&m.data, sb.length_size)?,
        None => {
            return Err(WindowError::UnsupportedLayout {
                detail: "no Dataspace message".to_string(),
            })
        }
    };
    if space.rank != 2 {
        return Err(WindowError::UnsupportedRank { rank: space.rank });
    }
    let rows = space.dimensions[0];
    let cols = space.dimensions[1];

    match msg(MessageType::Datatype) {
        Some(m) => {
            let (dtype, _) = Datatype::parse(&m.data)?;
            match dtype {
                Datatype::FloatingPoint {
                    size,
                    byte_order,
                    bit_offset,
                    bit_precision,
                    exponent_size,
                    mantissa_size,
                    exponent_bias,
                    ..
                } => {
                    if size as u64 != ELEMENT_SIZE
                        || bit_offset != 0
                        || bit_precision != 32
                        || mantissa_size != 23
                        || exponent_size != 8
                        || exponent_bias != 127
                        || byte_order != DatatypeByteOrder::LittleEndian
                    {
                        return Err(WindowError::UnsupportedDatatype {
                            detail: format!(
                                "size {size}, order {byte_order:?}, precision {bit_precision}, \
                                 mantissa {mantissa_size}, exponent {exponent_size}, bias {exponent_bias}"
                            ),
                        });
                    }
                }
                other => {
                    return Err(WindowError::UnsupportedDatatype {
                        detail: format!("{other:?}"),
                    })
                }
            }
        }
        None => {
            return Err(WindowError::UnsupportedDatatype {
                detail: "no Datatype message".to_string(),
            })
        }
    }

    let layout = match msg(MessageType::DataLayout) {
        Some(m) => DataLayout::parse(&m.data, sb.offset_size, sb.length_size)?,
        None => {
            return Err(WindowError::UnsupportedLayout {
                detail: "no DataLayout message".to_string(),
            })
        }
    };
    let (chunk_dims, btree, version) = match &layout {
        DataLayout::Chunked {
            chunk_dimensions,
            btree_address,
            version,
            ..
        } => (
            chunk_dimensions.clone(),
            *btree_address,
            *version,
        ),
        other => {
            return Err(WindowError::UnsupportedLayout {
                detail: format!("{other:?}"),
            })
        }
    };
    if chunk_dims.len() < 2 {
        return Err(WindowError::UnsupportedLayout {
            detail: format!("chunk dimensions {:?}", chunk_dims),
        });
    }
    if version != 3 {
        return Err(WindowError::UnsupportedLayout {
            detail: format!("chunked layout version {version}, expected 3"),
        });
    }
    let btree = btree_address_of(btree).ok_or(WindowError::MissingChunkIndex {
        detail: "chunked layout has no B-tree address".to_string(),
    })?;

    let chunk_rows = chunk_dims[0] as u64;
    let chunk_cols = chunk_dims[1] as u64;
    if chunk_rows == 0 || chunk_cols == 0 || chunk_rows > rows || chunk_cols > cols {
        return Err(WindowError::UnsupportedLayout {
            detail: format!(
                "chunk {chunk_rows}x{chunk_cols} incompatible with dataset {rows}x{cols}"
            ),
        });
    }

    let pipeline = match msg(MessageType::FilterPipeline) {
        Some(m) => FilterPipeline::parse(&m.data)?,
        None => FilterPipeline {
            version: 0,
            filters: Vec::new(),
        },
    };
    validate_pipeline_filters(&pipeline)?;

    // A truncated FillValue message is legal: it means "no value stored", so the
    // type default applies. Refusing the dataset here would be wrong, but a
    // truncated message must never be mistaken for a stored value either.
    let (fill, fill_source) = match msg(MessageType::FillValue) {
        Some(m) if m.data.len() >= 8 => parse_fill_value(&m.data)?,
        Some(m) => (
            0.0,
            format!("FillValue message truncated ({} bytes), default 0.0", m.data.len()),
        ),
        None => (0.0, "no FillValue message, HDF5 default 0.0".to_string()),
    };

    let infos = collect_chunk_info(data, btree, chunk_dims.len(), sb.offset_size, sb.length_size)
        .map_err(|e| WindowError::MissingChunkIndex {
            detail: format!("{e}"),
        })?;

    let mut chunks: HashMap<(u64, u64), ChunkInfo> = HashMap::with_capacity(infos.len());
    for info in infos {
        if info.offsets.len() < 2 {
            return Err(WindowError::InconsistentOffsets {
                detail: format!("chunk at {} has {} offsets", info.address, info.offsets.len()),
            });
        }
        let key = (info.offsets[0], info.offsets[1]);
        if info.offsets[0] >= rows || info.offsets[1] >= cols {
            return Err(WindowError::InconsistentOffsets {
                detail: format!(
                    "chunk at {} claims {}x{} outside dataset {}x{}",
                    info.address, key.0, key.1, rows, cols
                ),
            });
        }
        if key.0 % chunk_rows != 0 || key.1 % chunk_cols != 0 {
            return Err(WindowError::InconsistentOffsets {
                detail: format!(
                    "chunk at {} offset {}x{} not a multiple of chunk {}x{}",
                    info.address, key.0, key.1, chunk_rows, chunk_cols
                ),
            });
        }
        if info.offsets[2..].iter().any(|v| *v != 0) {
            return Err(WindowError::InconsistentOffsets {
                detail: format!("chunk at {} selects nonzero element offsets", info.address),
            });
        }
        chunks.insert(key, info);
    }

    let grid_rows = rows.div_ceil(chunk_rows);
    let grid_cols = cols.div_ceil(chunk_cols);

    Ok(ChunkIndex {
        dataset: dataset.to_string(),
        rows,
        cols,
        chunk_rows,
        chunk_cols,
        fill,
        fill_source,
        pipeline,
        stored_chunks: chunks.len(),
        grid_cells: grid_rows * grid_cols,
        chunks,
    })
}

fn btree_address_of(addr: Option<u64>) -> Option<u64> {
    match addr {
        Some(v) if v != 0 => Some(v),
        _ => None,
    }
}

/// Refuse filters this reader cannot decode, at index-build time.
///
/// Checking here rather than inside the decode loop keeps the failure a typed
/// [`WindowError`] tied to the dataset, and it means a file using SZIP, N-bit
/// or Scaleoffset is rejected before a single chunk is read instead of failing
/// half way through a window with a format-level error.
fn validate_pipeline_filters(pipeline: &FilterPipeline) -> Result<(), WindowError> {
    for filter in &pipeline.filters {
        match filter.filter_id {
            1 | 2 | 3 => {}
            other => return Err(WindowError::UnsupportedFilter { filter_id: other }),
        }
    }
    Ok(())
}

/// Rebuild the filter pipeline for one chunk, dropping filters its
/// `filter_mask` says were not applied. A set bit means "this filter was
/// skipped for this chunk", so decoding it would corrupt the values.
pub fn pipeline_for_chunk(base: &FilterPipeline, filter_mask: u32) -> FilterPipeline {
    if filter_mask == 0 {
        return base.clone();
    }
    let filters: Vec<FilterDescription> = base
        .filters
        .iter()
        .enumerate()
        .filter(|(i, _)| filter_mask & (1u32 << i) == 0)
        .map(|(_, f)| f.clone())
        .collect();
    FilterPipeline {
        version: base.version,
        filters,
    }
}

/// Decode one window from a prepared index.
pub fn read_window_from(
    index: &ChunkIndex,
    file_data: &[u8],
    window: Window,
) -> Result<(Vec<f32>, WindowStats), WindowError> {
    read_window_from_with(index, file_data, window, |_| {})
}

/// Same as [`read_window_from`], but reports the running [`WindowStats`] after
/// every chunk so a caller can sample resource use while the loop is live.
/// Sampling only after the function returns would miss the per-chunk
/// transient, which is exactly what the memory measurement has to catch.
pub fn read_window_from_with<F>(
    index: &ChunkIndex,
    file_data: &[u8],
    window: Window,
    mut on_chunk: F,
) -> Result<(Vec<f32>, WindowStats), WindowError>
where
    F: FnMut(&WindowStats),
{
    window.validate(index.rows, index.cols)?;

    let win_cols = window.cols();
    let elements = window.elements();
    let out_len = usize::try_from(elements).map_err(|_| WindowError::SizeOverflow {
        detail: format!("window of {elements} elements"),
    })?;
    let file_len = file_data.len() as u64;

    let mut out = vec![index.fill; out_len];
    let mut stats = WindowStats::default();

    let first_row = window.row_start / index.chunk_rows;
    let last_row = (window.row_end - 1) / index.chunk_rows;
    let first_col = window.col_start / index.chunk_cols;
    let last_col = (window.col_end - 1) / index.chunk_cols;

    let expected_decoded = usize::try_from(index.chunk_rows * index.chunk_cols * ELEMENT_SIZE)
        .map_err(|_| WindowError::SizeOverflow {
            detail: "chunk byte size".to_string(),
        })?;

    for chunk_row in first_row..=last_row {
        for chunk_col in first_col..=last_col {
            stats.cells_touched += 1;
            let key = (chunk_row * index.chunk_rows, chunk_col * index.chunk_cols);
            let info = match index.chunks.get(&key) {
                Some(info) => info,
                None => {
                    stats.chunks_missing += 1;
                    on_chunk(&stats);
                    continue;
                }
            };

            let start = info.address;
            let end = start
                .checked_add(info.chunk_size as u64)
                .ok_or(WindowError::SizeOverflow {
                    detail: format!("chunk at {start} plus size {}", info.chunk_size),
                })?;
            if end > file_len {
                return Err(WindowError::ChunkOutOfFile {
                    start,
                    end,
                    file_len,
                });
            }
            let start_usize = start as usize;
            let end_usize = end as usize;
            let compressed = &file_data[start_usize..end_usize];

            let pipeline = pipeline_for_chunk(&index.pipeline, info.filter_mask);
            let decoded = decompress_chunk(compressed, &pipeline, expected_decoded, ELEMENT_SIZE as u32)?;
            if decoded.len() != expected_decoded {
                return Err(WindowError::ShortChunk {
                    addr: start,
                    expected: expected_decoded as u64,
                    got: decoded.len() as u64,
                });
            }
            stats.chunks_decoded += 1;
            stats.compressed_bytes += info.chunk_size as u64;
            stats.decoded_bytes += decoded.len() as u64;

            let chunk_r0 = key.0;
            let chunk_c0 = key.1;
            let chunk_r1 = (chunk_r0 + index.chunk_rows).min(index.rows);
            let chunk_c1 = (chunk_c0 + index.chunk_cols).min(index.cols);

            let src_r0 = chunk_r0.max(window.row_start);
            let src_r1 = chunk_r1.min(window.row_end);
            let src_c0 = chunk_c0.max(window.col_start);
            let src_c1 = chunk_c1.min(window.col_end);

            let width = (src_c1 - src_c0) as usize;

            for row in src_r0..src_r1 {
                let src_off =
                    ((row - chunk_r0) * index.chunk_cols + (src_c0 - chunk_c0)) as usize;
                let dst_off = ((row - window.row_start) * win_cols + (src_c0 - window.col_start))
                    as usize;
                let values: &[f32] = bytemuck_cast(&decoded[src_off * 4..(src_off + width) * 4]);
                out[dst_off..dst_off + width].copy_from_slice(values);
            }

            on_chunk(&stats);
        }
    }

    Ok((out, stats))
}

fn bytemuck_cast(bytes: &[u8]) -> &[f32] {
    let ptr = bytes.as_ptr() as *const f32;
    unsafe { std::slice::from_raw_parts(ptr, bytes.len() / 4) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pipeline_for_chunk_drops_masked_filters() {
        let base = FilterPipeline {
            version: 1,
            filters: vec![
                FilterDescription {
                    filter_id: 2,
                    name: Some("shuffle".into()),
                    flags: 1,
                    client_data: Vec::new(),
                },
                FilterDescription {
                    filter_id: 1,
                    name: Some("deflate".into()),
                    flags: 1,
                    client_data: vec![1],
                },
            ],
        };
        let all = pipeline_for_chunk(&base, 0);
        assert_eq!(all.filters.len(), 2);

        let skip_shuffle = pipeline_for_chunk(&base, 0b01);
        assert_eq!(skip_shuffle.filters.len(), 1);
        assert_eq!(skip_shuffle.filters[0].filter_id, 1);

        let skip_both = pipeline_for_chunk(&base, 0b11);
        assert!(skip_both.filters.is_empty());
    }

    #[test]
    fn fill_value_message_is_decoded_from_the_header() {
        // Byte layout captured from a real libhdf5-written fixture: a version 2
        // message with a 4-byte size field before the value.
        let mut msg = vec![2u8, 3, 2, 2, 4, 0, 0, 0];
        msg.extend_from_slice(&f32::from_bits(0x7fc0_0000).to_le_bytes());
        let (value, source) = parse_fill_value(&msg).expect("fill value");
        assert!(value.is_nan());
        assert!(source.contains("stored"));
        assert!(source.contains("7fc00000"));

        // Version 2, default fill, no size field: the granule's own layout.
        let granule = vec![2u8, 3, 2, 1, 0, 0, 0, 0];
        let (value, source) = parse_fill_value(&granule).expect("default fill");
        assert_eq!(value, 0.0);
        assert!(source.contains("size 0"));

        // Version 1 carries the same size field.
        let mut v1 = vec![1u8, 0, 0, 2, 4, 0, 0, 0];
        v1.extend_from_slice(&1.0f32.to_le_bytes());
        let (value, _) = parse_fill_value(&v1).expect("v1 fill");
        assert_eq!(value, 1.0);

        // A size that is not the element width is refused rather than guessed.
        assert!(parse_fill_value(&[2, 3, 2, 2, 8, 0, 0, 0, 1, 0, 0, 0]).is_err());
        assert!(parse_fill_value(&[1, 0, 0, 2]).is_err());
    }

    #[test]
    fn window_validation_rejects_inverted_and_out_of_range() {
        let ok = Window {
            row_start: 10,
            row_end: 20,
            col_start: 30,
            col_end: 40,
        };
        assert!(ok.validate(100, 100).is_ok());

        let inverted = Window {
            row_start: 20,
            row_end: 20,
            col_start: 30,
            col_end: 40,
        };
        assert!(inverted.validate(100, 100).is_err());

        let outside = Window {
            row_start: 90,
            row_end: 200,
            col_start: 0,
            col_end: 10,
        };
        assert!(outside.validate(100, 100).is_err());
    }

    #[test]
    fn unsupported_filters_are_refused_at_index_build() {
        let supported = FilterPipeline {
            version: 2,
            filters: vec![
                FilterDescription {
                    filter_id: 2,
                    name: None,
                    flags: 0,
                    client_data: Vec::new(),
                },
                FilterDescription {
                    filter_id: 1,
                    name: None,
                    flags: 0,
                    client_data: vec![1],
                },
                FilterDescription {
                    filter_id: 3,
                    name: None,
                    flags: 0,
                    client_data: Vec::new(),
                },
            ],
        };
        validate_pipeline_filters(&supported).expect("shuffle/deflate/fletcher32 are supported");

        for unsupported_id in [4u16, 5, 6, 64, 320] {
            let pipeline = FilterPipeline {
                version: 2,
                filters: vec![FilterDescription {
                    filter_id: unsupported_id,
                    name: Some("vendor".into()),
                    flags: 0,
                    client_data: Vec::new(),
                }],
            };
            match validate_pipeline_filters(&pipeline) {
                Err(WindowError::UnsupportedFilter { filter_id }) => {
                    assert_eq!(filter_id, unsupported_id)
                }
                other => panic!("filter {unsupported_id}: expected UnsupportedFilter, got {other:?}"),
            }
        }
    }

    /// A `filter_mask` bit means the writer skipped that filter for this
    /// chunk, so the decoder must drop it. When every filter is masked out the
    /// payload arrives uncompressed and must be passed through untouched.
    #[test]
    fn fully_masked_chunk_is_passed_through_raw() {
        use rustyhdf5_format::filters::decompress_chunk;

        let base = FilterPipeline {
            version: 1,
            filters: vec![
                FilterDescription {
                    filter_id: 2,
                    name: Some("shuffle".into()),
                    flags: 1,
                    client_data: Vec::new(),
                },
                FilterDescription {
                    filter_id: 1,
                    name: Some("deflate".into()),
                    flags: 1,
                    client_data: vec![1],
                },
            ],
        };
        let pipeline = pipeline_for_chunk(&base, 0b11);
        assert!(pipeline.filters.is_empty());

        let payload: Vec<u8> = (0..256u32).map(|i| i as u8).collect();
        let decoded = decompress_chunk(&payload, &pipeline, payload.len(), 4)
            .expect("raw payload decodes without filters");
        assert_eq!(decoded, payload, "raw bytes must survive untouched");

        // With the mask clear the same chunk still goes through both filters,
        // so the mask is what selects the path, not the payload.
        assert_eq!(pipeline_for_chunk(&base, 0).filters.len(), 2);
    }

    /// Hand-built index so the decode-loop error paths are reachable without
    /// a fixture file: every error here must be a `WindowError`, never a
    /// panic or a format-level error leaking through.
    fn hand_index(chunks: HashMap<(u64, u64), ChunkInfo>) -> ChunkIndex {
        ChunkIndex {
            dataset: "test".into(),
            rows: 8,
            cols: 8,
            chunk_rows: 8,
            chunk_cols: 8,
            fill: -999.0,
            fill_source: "test".into(),
            pipeline: FilterPipeline {
                version: 0,
                filters: Vec::new(),
            },
            stored_chunks: chunks.len(),
            grid_cells: 1,
            chunks,
        }
    }

    #[test]
    fn short_decoded_chunk_is_a_typed_error() {
        let mut chunks = HashMap::new();
        // 8 bytes of chunk data where the dataset layout promises 8x8x4.
        chunks.insert(
            (0u64, 0u64),
            ChunkInfo {
                chunk_size: 8,
                filter_mask: 0,
                offsets: vec![0, 0],
                address: 0,
            },
        );
        let index = hand_index(chunks);
        let file_data = vec![0u8; 64];
        let window = Window { row_start: 0, row_end: 8, col_start: 0, col_end: 8 };

        match read_window_from(&index, &file_data, window) {
            Err(WindowError::ShortChunk { expected, got, .. }) => {
                assert_eq!(expected, 256);
                assert_eq!(got, 8);
            }
            other => panic!("expected ShortChunk, got {:?}", other.map(|_| "ok")),
        }
    }

    #[test]
    fn chunk_address_past_eof_is_a_typed_error() {
        let mut chunks = HashMap::new();
        chunks.insert(
            (0u64, 0u64),
            ChunkInfo {
                chunk_size: 4,
                filter_mask: 0,
                offsets: vec![0, 0],
                address: 4096,
            },
        );
        let index = hand_index(chunks);
        let file_data = vec![0u8; 64];
        let window = Window { row_start: 0, row_end: 8, col_start: 0, col_end: 8 };

        match read_window_from(&index, &file_data, window) {
            Err(WindowError::ChunkOutOfFile { start, end, file_len }) => {
                assert_eq!(start, 4096);
                assert_eq!(end, 4100);
                assert_eq!(file_len, 64);
            }
            other => panic!("expected ChunkOutOfFile, got {:?}", other.map(|_| "ok")),
        }
    }

    #[test]
    fn absent_chunks_are_filled_from_the_header_value() {
        let index = hand_index(HashMap::new());
        let file_data = vec![0u8; 64];
        let window = Window { row_start: 0, row_end: 4, col_start: 0, col_end: 4 };

        let (data, stats) = read_window_from(&index, &file_data, window).expect("read");
        assert_eq!(data.len(), 16);
        assert!(data.iter().all(|v| *v == -999.0), "all cells must be the header fill");
        assert_eq!(stats.chunks_decoded, 0);
        assert_eq!(stats.chunks_missing, 1);
        assert_eq!(stats.decoded_bytes, 0);
    }

    #[test]
    fn progress_callback_sees_every_chunk() {
        // Four grid cells, none of them present in the index, so the callback
        // has to run once per cell rather than once at the end.
        let mut index = hand_index(HashMap::new());
        index.rows = 16;
        index.cols = 16;
        index.chunk_rows = 8;
        index.chunk_cols = 8;
        index.grid_cells = 4;
        let file_data = vec![0u8; 64];
        let window = Window { row_start: 0, row_end: 16, col_start: 0, col_end: 16 };

        let mut seen = Vec::new();
        let (data, stats) =
            read_window_from_with(&index, &file_data, window, |s| seen.push(s.cells_touched))
                .expect("read");
        assert_eq!(seen, vec![1, 2, 3, 4], "callback must fire per chunk");
        assert_eq!(data.len(), 256);
        assert_eq!(stats.chunks_missing, 4);

        let mut single = hand_index(HashMap::new());
        single.rows = 8;
        single.cols = 8;
        let mut seen = Vec::new();
        let window = Window { row_start: 0, row_end: 8, col_start: 0, col_end: 8 };
        read_window_from_with(&single, &file_data, window, |s| seen.push(s.cells_touched))
            .expect("read");
        assert_eq!(seen, vec![1], "single cell must be reported once");
    }
}
