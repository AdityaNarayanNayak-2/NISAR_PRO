export const KUNDRA_CENTER = [18.7883, 82.6003]; // [Lat, Lng]

export const KUNDRA_AOI_BBOX = [
  18.7433, 82.5533, // South, West
  18.8333, 82.6473  // North, East
];

export const PERMANENT_WATER_POLYGONS = [
  // Upper Kolab Reservoir Northern Arm
  [
    [18.828, 82.610], [18.832, 82.620], [18.830, 82.635], [18.825, 82.645],
    [18.815, 82.642], [18.810, 82.630], [18.812, 82.615], [18.820, 82.608]
  ],
  // Reservoir Southern Branch
  [
    [18.805, 82.625], [18.812, 82.632], [18.808, 82.645], [18.798, 82.640],
    [18.792, 82.630], [18.798, 82.620]
  ],
  // Kolab River Channel running South-West
  [
    [18.802, 82.595], [18.798, 82.592], [18.790, 82.585], [18.782, 82.578],
    [18.775, 82.570], [18.768, 82.565], [18.765, 82.568], [18.772, 82.575],
    [18.780, 82.583], [18.788, 82.590], [18.796, 82.598]
  ]
];

function createPolygon(centerLat, centerLng, size) {
  const points = 6;
  const coords = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const jitter = 0.75 + (Math.sin(i * 3 + centerLat * 1000) * 0.35);
    const lat = centerLat + Math.sin(angle) * size * jitter;
    const lng = centerLng + Math.cos(angle) * size * jitter * 1.05;
    coords.push([Math.round(lat * 10000) / 10000, Math.round(lng * 10000) / 10000]);
  }
  coords.push(coords[0]); // close loop
  return coords;
}

function getRandomInfra(idx) {
  const items = [
    'NH-326 Highway Culvert',
    'Kundra Agricultural Canal South',
    'Kolab River Bank Levee',
    'Digapur Feeder Canal Gate',
    'Jeypore Electrical Substation Grid',
    'Upper Kolab Aqueduct Pier 4',
    'Bagderi Paddy Storage Sheds',
    'Kundra Rural Bridge East',
    'Kolab Irrigation Main Channel'
  ];
  return items[idx % items.length];
}

function generateFloodRegions() {
  const regions = [];
  
  const clusters = [
    { name: 'Kundra Agricultural Delta (North-West)', lat: 18.795, lng: 82.582, radius: 0.015, count: 65, highRatio: 0.6 },
    { name: 'Upper Kolab Spillway Lowlands', lat: 18.812, lng: 82.605, radius: 0.012, count: 50, highRatio: 0.5 },
    { name: 'Digapur River Bend Inundation', lat: 18.778, lng: 82.592, radius: 0.014, count: 45, highRatio: 0.45 },
    { name: 'Bagderi Canal Basin', lat: 18.765, lng: 82.615, radius: 0.018, count: 44, highRatio: 0.4 }
  ];

  const keyRegionsData = [
    { id: 'region-087', num: 87, acres: 2.80, conf: 'medium', lat: 18.7912, lng: 82.6041, infra: 'Kundra-Kolab Dam Road (NH-326)', dist: 180, db: -6.4 },
    { id: 'region-012', num: 12, acres: 6.45, conf: 'high', lat: 18.7985, lng: 82.5842, infra: 'Kundra Grain Storage Facility', dist: 95, db: -8.9 },
    { id: 'region-001', num: 1, acres: 8.92, conf: 'high', lat: 18.8142, lng: 82.6085, infra: 'Upper Kolab Hydro Electric Outlet', dist: 220, db: -10.2 },
    { id: 'region-045', num: 45, acres: 4.15, conf: 'high', lat: 18.7820, lng: 82.5910, infra: 'Digapur Elementary School', dist: 310, db: -7.8 },
    { id: 'region-104', num: 104, acres: 1.95, conf: 'medium', lat: 18.7690, lng: 82.6120, infra: 'Bagderi Canal Sluice Gate 3', dist: 60, db: -5.1 }
  ];

  keyRegionsData.forEach(kr => {
    const poly = createPolygon(kr.lat, kr.lng, Math.sqrt(kr.acres) * 0.0018);
    regions.push({
      id: kr.id,
      regionNumber: kr.num,
      acres: kr.acres,
      confidence: kr.conf,
      centroid: [kr.lat, kr.lng],
      polygonCoords: poly,
      meanDeltaDb: kr.db,
      preEventDb: -10.5,
      postEventDb: -10.5 + kr.db,
      nearestInfrastructure: kr.infra,
      distanceToInfraMeters: kr.dist,
      perimeterMeters: Math.round(Math.sqrt(kr.acres) * 520)
    });
  });

  let currentHigh = regions.filter(r => r.confidence === 'high').reduce((s, r) => s + r.acres, 0);
  let currentMed = regions.filter(r => r.confidence === 'medium').reduce((s, r) => s + r.acres, 0);

  const targetHigh = 70.47;
  const targetMed = 74.97;

  let regionCounter = 2;
  let cIndex = 0;

  while (regions.length < 204) {
    if (keyRegionsData.some(k => k.num === regionCounter)) {
      regionCounter++;
      continue;
    }

    const cluster = clusters[cIndex % clusters.length];
    cIndex++;

    const isHigh = currentHigh < targetHigh && (regions.length % 2 === 0 || currentMed >= targetMed);
    const conf = isHigh ? 'high' : 'medium';

    const remainingCount = 204 - regions.length;
    const remainingAcresNeeded = isHigh ? (targetHigh - currentHigh) : (targetMed - currentMed);
    
    let acreVal = Math.max(0.12, Math.min(2.5, remainingAcresNeeded / Math.max(1, (remainingCount / 2))));
    acreVal = Math.round(acreVal * 100) / 100;

    if (isHigh) {
      if (currentHigh + acreVal > targetHigh) acreVal = Math.max(0.08, Math.round((targetHigh - currentHigh) * 100) / 100);
      currentHigh += acreVal;
    } else {
      if (currentMed + acreVal > targetMed) acreVal = Math.max(0.08, Math.round((targetMed - currentMed) * 100) / 100);
      currentMed += acreVal;
    }

    const angle = (regions.length * 137.5) * (Math.PI / 180);
    const dist = Math.sqrt(regions.length / 204) * cluster.radius;
    const lat = cluster.lat + dist * Math.sin(angle);
    const lng = cluster.lng + dist * Math.cos(angle);

    const deltaDb = isHigh ? -(6.0 + Math.random() * 4.5) : -(3.5 + Math.random() * 2.5);
    const poly = createPolygon(lat, lng, Math.sqrt(acreVal) * 0.0014);

    regions.push({
      id: `region-${String(regionCounter).padStart(3, '0')}`,
      regionNumber: regionCounter,
      acres: Math.max(0.08, acreVal),
      confidence: conf,
      centroid: [lat, lng],
      polygonCoords: poly,
      meanDeltaDb: Math.round(deltaDb * 10) / 10,
      preEventDb: -10.8,
      postEventDb: Math.round((-10.8 + deltaDb) * 10) / 10,
      nearestInfrastructure: getRandomInfra(regionCounter),
      distanceToInfraMeters: Math.round(50 + Math.random() * 450),
      perimeterMeters: Math.round(Math.sqrt(acreVal) * 520)
    });

    regionCounter++;
  }

  return regions;
}

export const DETECTED_FLOOD_REGIONS = generateFloodRegions();
