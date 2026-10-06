//! Dumps the raw Fill Value message bytes so the parser can be checked against
//! what libhdf5 actually wrote.

use rustyhdf5::MmapFile;
use rustyhdf5_format::message_type::MessageType;
use rustyhdf5_format::object_header::ObjectHeader;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let file = MmapFile::open(&args[1]).expect("open");
    let ds = &args[2];
    let sb = file.superblock();
    let addr = rustyhdf5_format::group_v2::resolve_path_any(file.as_bytes(), sb, ds).expect("resolve");
    let hdr = ObjectHeader::parse(file.as_bytes(), addr as usize, sb.offset_size, sb.length_size).expect("header");

    for m in hdr.messages.iter() {
        let label = format!("{:?}", m.msg_type);
        if matches!(m.msg_type, MessageType::FillValue | MessageType::FillValueOld) {
            println!("{} (type 0x{:04x}) len {}", label, m.msg_type.to_u16(), m.data.len());
            println!("  bytes: {:02x?}", m.data);
            if m.data.len() >= 8 {
                let v = f32::from_le_bytes([m.data[4], m.data[5], m.data[6], m.data[7]]);
                println!("  as f32 from offset 4: {v:?}  bits 0x{:08x}", v.to_bits());
            }
            if m.data.len() >= 12 {
                let v = f32::from_le_bytes([m.data[8], m.data[9], m.data[10], m.data[11]]);
                println!("  as f32 from offset 8: {v:?}  bits 0x{:08x}", v.to_bits());
            }
        } else if matches!(m.msg_type, MessageType::Datatype | MessageType::DataLayout | MessageType::Dataspace) {
            println!("{} present, {} bytes", label, m.data.len());
        }
    }
}
