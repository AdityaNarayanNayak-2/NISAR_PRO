export const QUESTIONS = {
  'explorer-e1-physics': [
    {
      id: 'q1',
      difficulty: 'silver',
      question: 'Which of the following best describes an Active Sensor in radar terminology?',
      options: [
        'A sensor that measures naturally emitted thermal radiation from the Earth.',
        'A system that provides its own energy source to illuminate a target and measures the backscatter.',
        'A camera system that operates only during daylight hours.',
        'A satellite component that actively maneuvers to maintain orbital altitude.'
      ],
      correct: 1,
      explanation: 'Active sensors, like SAR, transmit their own electromagnetic pulses and measure the echo (backscatter) that returns, allowing them to operate day or night.',
      scientistNote: 'Governed by the Radar Equation: Pr = (Pt * Gt * Gr * λ² * σ) / ((4π)³ * R⁴)'
    },
    {
      id: 'q2',
      difficulty: 'gold',
      question: 'What is the primary advantage of using a Chirp (Linear Frequency Modulation) signal?',
      options: [
        'It reduces the power required to transmit the signal.',
        'It allows the satellite to operate in the optical spectrum.',
        'It decouples range resolution from pulse duration via pulse compression.',
        'It prevents the signal from being scattered by atmospheric clouds.'
      ],
      correct: 2,
      explanation: 'A chirp signal sweeps across a frequency band, allowing a long pulse (high energy) to be compressed upon reception into a narrow pulse (high resolution).',
      scientistNote: 'Pulse compression utilizes a matched filter. The compressed pulse width is roughly 1/Bandwidth.'
    },
    {
      id: 'q3',
      difficulty: 'silver',
      question: 'Why does SAR (Synthetic Aperture Radar) use microwave frequencies instead of visible light?',
      options: [
        'Microwaves travel faster than visible light.',
        'Microwaves can penetrate clouds, fog, and light rain without significant attenuation.',
        'Visible light cannot reflect off metallic surfaces.',
        'Microwave antennas are cheaper to manufacture than optical lenses.'
      ],
      correct: 1,
      explanation: 'Microwaves have longer wavelengths than visible light, allowing them to pass through atmospheric obstacles like clouds and smoke, making SAR an "all-weather" sensor.',
      scientistNote: 'Scattering falls off dramatically when the wavelength is much larger than the particle size (Rayleigh scattering limit).'
    },
    {
      id: 'q4',
      difficulty: 'silver',
      question: 'What term describes the portion of radar energy that reflects directly back towards the antenna?',
      options: [
        'Specular Reflection',
        'Forward Scatter',
        'Backscatter',
        'Refraction'
      ],
      correct: 2,
      explanation: 'Backscatter is the portion of the incident radar energy that is scattered back in the direction of the radar antenna. This is the signal that forms the SAR image.',
      scientistNote: 'Quantified as σ⁰ (Normalized Radar Cross Section), strongly dependent on surface roughness, dielectric constant, and incidence angle.'
    }
  ],
  'explorer-e2-geometry': [
    {
      id: 'q5',
      difficulty: 'silver',
      question: 'In SAR geometry, what does the "azimuth" direction represent?',
      options: [
        'The direction perpendicular to the satellite flight path.',
        'The vertical distance from the satellite to the ground.',
        'The direction parallel to the satellite flight path.',
        'The angle at which the radar beam strikes the Earth.'
      ],
      correct: 2,
      explanation: 'Azimuth refers to the along-track direction, parallel to the flight path of the satellite or aircraft.',
      scientistNote: 'Azimuth resolution is fundamentally limited by antenna length (L/2) in stripmap mode.'
    }
  ],
  'explorer-e3-data': [
    {
      id: 'q6',
      difficulty: 'silver',
      question: 'What does "SLC" stand for in SAR data products?',
      options: [
        'Standard Level Correction',
        'Single Look Complex',
        'Synthetic Line Calculation',
        'Sub-Level Compression'
      ],
      correct: 1,
      explanation: 'SLC stands for Single Look Complex. It is a fundamental Level-1 SAR product that preserves both amplitude and phase information.',
      scientistNote: 'SLC data contains complex numbers (I + jQ) representing the focused radar return before multi-looking.'
    }
  ],
  'explorer-e4-applications': [
    {
      id: 'q7',
      difficulty: 'silver',
      question: 'Which of the following is NOT a typical application of InSAR (Interferometric SAR)?',
      options: [
        'Measuring land subsidence over time.',
        'Creating high-resolution Digital Elevation Models (DEMs).',
        'Detecting sea surface temperature anomalies.',
        'Monitoring volcanic inflation prior to eruption.'
      ],
      correct: 2,
      explanation: 'InSAR measures phase differences to detect millimeter-level surface deformation or topography. It cannot measure temperature.',
      scientistNote: 'Thermal emissions are measured by passive infrared radiometers, not active microwave radar systems.'
    }
  ]
};

// Helper function to fetch questions
export function getQuestionsForModule(moduleId) {
  return QUESTIONS[moduleId] || [];
}
