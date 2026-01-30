use crate::models::{EsaODataResponse, SarScene};
use log::{error, info};
use reqwest::Client;
use std::env;

pub struct EsaClient {
    client: Client,
    base_url: String,
}

impl EsaClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            base_url: "https://catalogue.dataspace.copernicus.eu/odata/v1".to_string(),
        }
    }

    pub async fn get_access_token(&self) -> Result<String, Box<dyn std::error::Error>> {
        let username = env::var("ESA_USERNAME").map_err(|_| "ESA_USERNAME not set")?;
        let password = env::var("ESA_PASSWORD").map_err(|_| "ESA_PASSWORD not set")?;

        let params = [
            ("client_id", "cdse-public"),
            ("username", &username),
            ("password", &password),
            ("grant_type", "password"),
        ];

        let resp = self.client.post("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token")
            .form(&params)
            .send()
            .await?;

        if !resp.status().is_success() {
            let error_text = resp.text().await?;
            error!("ESA Auth Error: {}", error_text);
            return Err(format!("Failed to authenticate with ESA").into());
        }

        let json: serde_json::Value = resp.json().await?;
        let token = json["access_token"]
            .as_str()
            .ok_or("No access_token in response")?;

        Ok(token.to_string())
    }

    pub async fn search_scenes(
        &self,
        lat: f64,
        lon: f64,
        start_date: Option<String>,
        end_date: Option<String>,
    ) -> Result<Vec<SarScene>, Box<dyn std::error::Error>> {
        let token = self.get_access_token().await?;

        // Construct OData filter for spatial intersection
        // POINT(lon lat)
        let mut filter = format!(
            "OData.CSC.Intersects(area=geography'SRID=4326;POINT({} {})')",
            lon, lat
        );

        // Add collection filter (Sentinel-1)
        filter = format!("{} and Collection/Name eq 'SENTINEL-1'", filter);

        // Add product type filter (GRD)
        filter = format!("{} and Attributes/OData.CSC.StringAttribute/any(i:i/Name eq 'productType' and i/Value eq 'GRD')", filter);

        // Add date filters if provided
        if let Some(start) = start_date {
            filter = format!("{} and ContentDate/Start ge {}", filter, start);
        }
        if let Some(end) = end_date {
            filter = format!("{} and ContentDate/End le {}", filter, end);
        }

        let url = format!(
            "{}/Products?$filter={}&$top=10&$orderby=ContentDate/Start desc",
            self.base_url, filter
        );

        info!("Querying ESA: {}", url);

        let resp = self.client.get(&url).bearer_auth(token).send().await?;

        if !resp.status().is_success() {
            let error_text = resp.text().await?;
            error!("ESA API Error: {}", error_text);
            return Err(format!("ESA API returned error").into());
        }

        let odata_response: EsaODataResponse = resp.json().await?;

        let scenes = odata_response
            .value
            .into_iter()
            .map(|p| SarScene {
                id: p.id,
                platform: "Sentinel-1".to_string(),
                date: p.content_date.start,
                footprint: "TODO".to_string(), // We would parse the footprint here
                quicklook_url: None,           // We can construct this later
            })
            .collect();

        Ok(scenes)
    }
}
