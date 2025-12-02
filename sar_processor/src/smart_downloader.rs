use reqwest::Client;
use std::error::Error;
use std::io::{Seek, SeekFrom, Write};
use std::path::Path;

#[allow(dead_code)]
pub struct SmartDownloader {
    client: Client,
}

#[allow(dead_code)]
impl SmartDownloader {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// Downloads a specific byte range from a URL and saves it to a file.
    /// This is used to fetch only the necessary parts of a large GeoTIFF (e.g., header + specific tiles).
    pub async fn download_range(
        &self,
        url: &str,
        start_byte: u64,
        end_byte: u64,
        output_path: &Path,
    ) -> Result<(), Box<dyn Error>> {
        let range_header = format!("bytes={}-{}", start_byte, end_byte);

        println!("Downloading range: {} from {}", range_header, url);

        let response = self
            .client
            .get(url)
            .header("Range", range_header)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Failed to download range: {}", response.status()).into());
        }

        let bytes = response.bytes().await?;

        // Open file in read-write mode, create if not exists
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .open(output_path)?;

        // Seek to the start position to write the chunk
        file.seek(SeekFrom::Start(start_byte))?;
        file.write_all(&bytes)?;

        Ok(())
    }

    /// Fetches the file size using a HEAD request.
    pub async fn get_file_size(&self, url: &str) -> Result<u64, Box<dyn Error>> {
        let response = self.client.head(url).send().await?;

        let content_length = response
            .headers()
            .get("content-length")
            .ok_or("No content-length header")?
            .to_str()?
            .parse::<u64>()?;

        Ok(content_length)
    }
}
