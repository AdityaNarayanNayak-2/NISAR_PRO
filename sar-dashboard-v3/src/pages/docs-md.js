// ============================================================================
// Docs manifest — renders the LIVE markdown in the repo's Docs/ folder.
// Single source of truth: edit Docs/UserGuide or Docs/Architecture and the
// dashboard docs page updates on the next build.
// ============================================================================

import userguideMd from '../../../Docs/UserGuide/userguide.md?raw'
import gettingStartedMd from '../../../Docs/UserGuide/getting-started.md?raw'
import windowsLocalRunMd from '../../../Docs/UserGuide/windows-local-run.md?raw'
import verificationGuideMd from '../../../Docs/UserGuide/verification-guide.md?raw'
import insarVerificationLogMd from '../../../Docs/UserGuide/insar-verification-log.md?raw'
import devOpsGuideMd from '../../../Docs/UserGuide/DevOpsGuide.md?raw'
import apiReferenceMd from '../../../Docs/UserGuide/api-reference.md?raw'
import damMonitoringMd from '../../../Docs/UserGuide/dam_monitoring.md?raw'

import architectureDiagramsMd from '../../../Docs/Architecture/architecture-diagrams.md?raw'
import projectJourneyMd from '../../../Docs/Architecture/project_journey.md?raw'
import gatewayOrchestrationMd from '../../../Docs/Architecture/gateway_orchestration.md?raw'
import processorIngestionMd from '../../../Docs/Architecture/processor_ingestion.md?raw'
import coreSarMathMd from '../../../Docs/Architecture/core_sar_mathematics.md?raw'
import dataExportHealthMd from '../../../Docs/Architecture/data_export_and_health.md?raw'
import floodDetectionPipelineMd from '../../../Docs/Architecture/flood_detection_pipeline.md?raw'
import gunwDataFlowMd from '../../../Docs/Architecture/gunw_data_flow.md?raw'
import sarDashboardInternalsMd from '../../../Docs/Architecture/sar_dashboard_internals.md?raw'

import architectureOverview from '../../../Docs/assets/architecture_overview.png'
import userWorkflow from '../../../Docs/assets/user_workflow.png'
import floodRunCompleted from '../../../Docs/assets/flood_run_completed.webp'
import finalFloodMapView from '../../../Docs/assets/final_flood_map_view.png'

// Relative image paths as written inside the markdown files.
export const assetMap = {
    '../assets/architecture_overview.png': architectureOverview,
    'architecture_overview.png': architectureOverview,
    '../assets/user_workflow.png': userWorkflow,
    'user_workflow.png': userWorkflow,
    '../assets/flood_run_completed.webp': floodRunCompleted,
    'flood_run_completed.webp': floodRunCompleted,
    '../assets/final_flood_map_view.png': finalFloodMapView,
    'final_flood_map_view.png': finalFloodMapView,
}

export const homeAssets = { architectureOverview, userWorkflow }

export const docGroups = [
    {
        title: 'Start here',
        blurb: 'The friendly path from zero to a running flood / InSAR analysis.',
        items: [
            { id: 'friendly', label: 'Friendly User Guide', file: 'Docs/UserGuide/userguide.md', md: userguideMd },
            { id: 'getting-started', label: 'Getting Started', file: 'Docs/UserGuide/getting-started.md', md: gettingStartedMd },
            { id: 'windows-run', label: 'Windows Local Run', file: 'Docs/UserGuide/windows-local-run.md', md: windowsLocalRunMd },
        ],
    },
    {
        title: 'Operating the platform',
        blurb: 'Verify, test, deploy, and talk to the gateway.',
        items: [
            { id: 'verification', label: 'Verification & Testing Guide', file: 'Docs/UserGuide/verification-guide.md', md: verificationGuideMd },
            { id: 'verification-log', label: 'InSAR Verification Log', file: 'Docs/UserGuide/insar-verification-log.md', md: insarVerificationLogMd },
            { id: 'deployment', label: 'Deployment Guide (DevOps)', file: 'Docs/UserGuide/DevOpsGuide.md', md: devOpsGuideMd },
            { id: 'api', label: 'API Reference', file: 'Docs/UserGuide/api-reference.md', md: apiReferenceMd },
        ],
    },
    {
        title: 'Use cases',
        blurb: 'Real monitoring workflows built on the platform.',
        items: [
            { id: 'dam-monitoring', label: 'Dam & Infrastructure Monitoring', file: 'Docs/UserGuide/dam_monitoring.md', md: damMonitoringMd },
        ],
    },
    {
        title: 'Architecture',
        blurb: 'Design notes, math, and data flows behind the engine.',
        items: [
            { id: 'diagrams', label: 'Platform Architecture & Diagrams', file: 'Docs/Architecture/architecture-diagrams.md', md: architectureDiagramsMd },
            { id: 'journey', label: 'Project Journey', file: 'Docs/Architecture/project_journey.md', md: projectJourneyMd },
            { id: 'gateway-orchestration', label: 'Gateway Orchestration Walkthrough', file: 'Docs/Architecture/gateway_orchestration.md', md: gatewayOrchestrationMd },
            { id: 'ingestion', label: 'Processor Ingestion & Subsetting', file: 'Docs/Architecture/processor_ingestion.md', md: processorIngestionMd },
            { id: 'mathematics', label: 'Core SAR Mathematics', file: 'Docs/Architecture/core_sar_mathematics.md', md: coreSarMathMd },
            { id: 'export', label: 'Data Export & Health Analysis', file: 'Docs/Architecture/data_export_and_health.md', md: dataExportHealthMd },
            { id: 'flood-pipeline', label: 'Flood Detection Pipeline', file: 'Docs/Architecture/flood_detection_pipeline.md', md: floodDetectionPipelineMd },
            { id: 'gunw-flow', label: 'GUNW Data Flow', file: 'Docs/Architecture/gunw_data_flow.md', md: gunwDataFlowMd },
            { id: 'dashboard-internals', label: 'Dashboard Internals', file: 'Docs/Architecture/sar_dashboard_internals.md', md: sarDashboardInternalsMd },
        ],
    },
]

export const flatDocs = docGroups.flatMap(group => group.items.map(item => ({ ...item, group: group.title })))

export function findDoc(id) {
    return flatDocs.find(doc => doc.id === id) || null
}

const escapeHtml = value => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Pull $...$ / $$...$$ math out of markdown BEFORE parsing so CommonMark
// doesn't mangle it, and hand it to KaTeX as a data attribute. Code fences
// are shielded first so bash `$` prompts never get touched.
export function shimMath(src) {
    const blocks = []
    const shielded = src.replace(/```[\s\S]*?```/g, fence => {
        blocks.push(fence)
        return `@@MD_FENCE_${blocks.length - 1}@@`
    })

    let out = shielded.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) =>
        `<div class="doc-math" data-math="${escapeHtml(math.trim())}"></div>`)
    out = out.replace(/\$([^$\n]+?)\$/g, (_, math) =>
        `<span class="doc-math-inline" data-math="${escapeHtml(math.trim())}"></span>`)

    return out.replace(new RegExp('@@MD_FENCE_(\\d+)@@', 'g'), (_, i) => blocks[Number(i)])
}

export function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[*_`~]/g, '')
        .replace(/[^a-z0-9 \-/]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}