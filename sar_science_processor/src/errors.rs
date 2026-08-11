use thiserror::Error;

#[derive(Error, Debug)]
pub enum ProcessorError {
    #[error("I/O Error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Image Error: {0}")]
    ImageError(#[from] image::ImageError),
    #[error("Serde Error: {0}")]
    SerdeError(#[from] serde_json::Error),
    #[error("Processing Error: {0}")]
    ProcessingError(String),
}

pub type Result<T> = std::result::Result<T, ProcessorError>;
