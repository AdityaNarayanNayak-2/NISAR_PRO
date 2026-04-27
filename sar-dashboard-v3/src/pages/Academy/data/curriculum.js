export const LEVELS = {
  explorer: {
    id: 'explorer',
    modules: [
      {
        id: 'e1-physics',
        title: 'Wave Physics Essentials',
        duration: '45 min',
        topics: ['active-sensor', 'passive-sensor', 'backscatter', 'chirp'],
        quizRequired: true,
        simulation: 'wave-playground',
      },
      {
        id: 'e2-geometry',
        title: 'SAR Geometry',
        duration: '40 min',
        topics: ['azimuth', 'range', 'incidence-angle', 'look-angle'],
        quizRequired: true,
        simulation: 'geometry-visualizer',
      },
      {
        id: 'e3-data',
        title: 'Data Fundamentals',
        duration: '35 min',
        topics: ['hdf5-format', 'slc-product', 'metadata'],
        quizRequired: true,
        simulation: null,
      },
      {
        id: 'e4-applications',
        title: 'Why SAR Matters',
        duration: '30 min',
        topics: ['all-weather', 'night-vision', 'disaster-response'],
        quizRequired: false,
        simulation: null,
      }
    ],
    exam: {
      id: 'explorer-exam',
      title: 'Explorer Certification Exam',
      duration: '60 min',
      questions: 25,
      passingScore: 80,
      format: 'multiple-choice',
      retakeDelay: '24 hours',
    }
  },
  
  operator: {
    id: 'operator',
    modules: [
      {
        id: 'o1-focusing',
        title: 'Range-Doppler Algorithm',
        duration: '90 min',
        topics: ['range-compression', 'azimuth-fft', 'rcmc', 'chirp-rate'],
        quizRequired: true,
        simulation: 'rda-pipeline',
      },
      {
        id: 'o2-insar',
        title: 'Interferometry (InSAR)',
        duration: '75 min',
        topics: ['phase', 'coherence', 'unwrapping', 'displacement'],
        quizRequired: true,
        simulation: 'phase-visualizer',
      },
      {
        id: 'o3-polsar',
        title: 'Polarimetry',
        duration: '60 min',
        topics: ['scattering-matrix', 'polarization', 'decomposition'],
        quizRequired: true,
        simulation: null,
      },
      {
        id: 'o4-applications',
        title: 'Operational Analysis',
        duration: '60 min',
        topics: ['ship-detection', 'change-detection', 'classification'],
        quizRequired: true,
        simulation: 'cfar-minigame',
      }
    ],
    exam: {
      id: 'operator-exam',
      title: 'Operator Certification Exam',
      duration: '90 min',
      questions: 40,
      passingScore: 85,
      format: 'multiple-choice-with-scenario',
      retakeDelay: '48 hours',
    }
  },
  
  architect: {
    id: 'architect',
    modules: [
      {
        id: 'a1-systems',
        title: 'Distributed Processing',
        duration: '120 min',
        topics: ['kubernetes', 'parallel-processing', 'storage', 'streaming'],
        quizRequired: true,
        simulation: 'cluster-rush-game',
      },
      {
        id: 'a2-pipeline',
        title: 'Pipeline Architecture',
        duration: '90 min',
        topics: ['crd-operator', 'gateway-pattern', 'sse-telemetry', 's3-streaming'],
        quizRequired: true,
        simulation: 'pipeline-builder',
      },
      {
        id: 'a3-optimization',
        title: 'Performance Engineering',
        duration: '90 min',
        topics: ['memory-safety', 'rayon-parallelism', 'chunked-io', 'tiling'],
        quizRequired: true,
        simulation: 'memory-optimizer',
      },
      {
        id: 'a4-production',
        title: 'Production Deployment',
        duration: '60 min',
        topics: ['gitops', 'monitoring', 'scaling-policies', 'disaster-recovery'],
        quizRequired: true,
        simulation: null,
      }
    ],
    exam: {
      id: 'architect-exam',
      title: 'Architect Certification Exam',
      duration: '120 min',
      questions: 50,
      passingScore: 90,
      format: 'scenario-based-design',
      retakeDelay: '72 hours',
      includes: ['system-design-whiteboard', 'troubleshooting-scenario']
    }
  }
}

export const DOMAINS = {
  physics: {
    id: 'physics',
    title: 'Wave Physics & Sensors',
    icon: 'Zap',
    color: '#C9A96E',
    topics: {
      'active-sensor': {
        term: 'Active Sensor',
        definitions: {
          kid: 'Like playing Marco Polo in a pool. You shout, listen for echo, figure out where things are.',
          dev: 'POST request pattern. Transmit signal, await response, parse return payload for distance/amplitude.',
          ops: 'Transceiver infrastructure. Must manage transmit power, duty cycles, and thermal budgets.',
          scientist: 'System transmitting electromagnetic energy and measuring backscattered return. Radar equation governs link budget: P_r = P_t G_t G_r λ²σ / (4π)³R⁴'
        }
      },
      'passive-sensor': {
        term: 'Passive Sensor',
        definitions: {
          kid: 'Like using your eyes. No sun or flashlight? You see nothing.',
          dev: 'Event-driven subscriber. External publisher (sun) controls availability. No SLA guarantees.',
          ops: 'Dependent on external infrastructure. No control over uptime or signal quality.',
          scientist: 'Detects naturally occurring radiation. Planck\'s law: B_λ(T) = 2hc²/λ⁵ · 1/(e^(hc/λkT)-1). Limited by atmospheric windows.'
        }
      },
      'backscatter': {
        term: 'Backscatter (σ⁰)',
        definitions: {
          kid: 'Throw ball at mirror: bounces away. Throw at rough wall: bounces everywhere, some comes back.',
          dev: 'Return signal amplitude. Corner reflectors = high response. Specular surfaces = null pointer.',
          ops: 'Signal-to-noise ratio driver. Determines detectability and classification confidence.',
          scientist: 'Normalized radar cross-section. σ⁰ = σ/A. Depends on surface roughness (ks), dielectric constant (ε), and local incidence angle.'
        }
      },
      'chirp': {
        term: 'Chirp Signal',
        definitions: {
          kid: 'Bird whistle sliding from low to high. Longer slide = more information when it bounces back.',
          dev: 'Linear frequency modulation. f(t) = f₀ + Kt. Matched filter correlation for pulse compression gain.',
          ops: 'Bandwidth efficiency. Trade-off between range resolution and processing complexity.',
          scientist: 'LFM pulse: s(t) = rect(t/T) · exp(jπKt²). Ambiguity function χ(τ,ν) = ∫s(t)s*(t+τ)e^(-j2πνt)dt. Thumbtack response for K=B/T.'
        }
      }
    }
  }
}
