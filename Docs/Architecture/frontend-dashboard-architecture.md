# Frontend dashboard architecture

NISAR Pro currently exposes two supported product profiles:

- **Flood Monitoring** — flood configuration, replay/map layers, regions, time series and analysis report.
- **Infrastructure Monitoring** — asset search, environmental context, InSAR upload/processing and structural inspection.

## Ownership boundaries

`AppDashboard.jsx` is the application shell and transport coordinator. It owns gateway health, job lifecycle, map viewport state, URL/deep-link state and the shared Leaflet canvas. It must not become the place where profile-specific cards or panel geometry are designed.

`FloodConfigPanel`, `FloodInsightPanel`, `WorkspaceSidebar` and flood view components own the flood experience. `InfrastructurePanel` owns the infrastructure experience and keeps its own left, right and bottom layout. A change to one profile's panel geometry must not be made by changing the other profile's layout constants.

Shared components are limited to cross-profile concerns: gateway status, job progress, map coordinates, terminal/log output and common navigation. They receive data and callbacks; they do not infer a profile by rendering unrelated placeholder screens.

## Supported profile contract

The canonical profile registry lives in `src/pages/app/constants.js` (`PROFILES`). Only `infrastructure` and `flood` are valid dashboard profiles. Unknown or stale profile URL values normalize to infrastructure; flood is selected explicitly by the flood route or a flood job deep link.

The old SAR Science and standalone InSAR profile placeholders were removed because they had no working product surface and created false navigation affordances. `insar` remains a processor pipeline identifier used internally by Infrastructure Monitoring; it is not a user-facing profile.

## Workflow rule

History is data-driven. Completed runs should be shown only when returned by the gateway and when their report/output artifacts exist. Demo results must be an explicit user action and must not be injected into the initial dashboard state.

## Next safe refactor

If the shell grows further, extract gateway/job orchestration into a hook or controller (`useDashboardWorkflow`) first. Do not split the map and panels until that transport boundary is tested; otherwise profile-specific layout bugs will be moved rather than removed.
