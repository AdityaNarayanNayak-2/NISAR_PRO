mod controller;
mod crd;

use crate::controller::{error_policy, reconcile, Context, Result};
use crate::crd::SarJob;
use futures::StreamExt;
use kube::{api::Api, client::Client};
use kube_runtime::controller::Controller;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    let client = Client::try_default().await?;
    let context = Arc::new(Context {
        client: client.clone(),
    });

    Controller::new(Api::<SarJob>::all(client.clone()), Default::default())
        .shutdown_on_signal()
        .run(reconcile, error_policy, context)
        .for_each(|res| async move {
            match res {
                Ok(o) => log::info!("reconciled {:?}", o),
                Err(e) => log::error!("reconcile failed: {}", e),
            }
        })
        .await;

    Ok(())
}
