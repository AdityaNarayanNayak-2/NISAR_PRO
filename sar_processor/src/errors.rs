use thiserror::Error;

#[derive(Error, Debug)]
pub enum ProcessorError {
    #[error("HTTP Request Error: {0}")]
    ReqwestError(#[from] reqwest::Error),
    #[error("I/O Error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Image Error: {0}")]
    ImageError(#[from] image::ImageError),
    #[error("Missing environment variable: {0}")]
    MissingEnvVar(String),
}

pub type Result<T> = std::result::Result<T, ProcessorError>;
