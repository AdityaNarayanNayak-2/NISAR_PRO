export const academyClusters = [
  {
    id: "physics",
    title: "1. The Physics of Sound & Light",
    color: "#3b82f6", // Blue
    terms: [
      { id: "Active Sensor", eli5: "A camera needs sunlight to take a picture (Passive). But a radar brings its own flashlight (Active). It shoots a pulse and waits for it to bounce back." },
      { id: "Passive Sensor", eli5: "Like a normal phone camera. It just sits there and waits for the sun's light to bounce off an object into its lens." },
      { id: "Backscatter", eli5: "The echo. When you yell into a canyon, the sound that returns to your ears is the backscatter." },
      { id: "Chirp", eli5: "Instead of a single 'beep', the radar yells a sound that goes from low-pitch to high-pitch. This helps it hear the echo much clearer." },
      { id: "Azimuth", eli5: "The direction the satellite is flying. If you are running forward, the 'azimuth' is the line of your run." },
      { id: "Range", eli5: "The direction pointing sideways from the satellite towards the ground." },
      { id: "Doppler", eli5: "Like an ambulance siren. Higher pitch when it drives towards you, lower as it drives away. Radar uses this to figure out exactly where the echo came from." },
      { id: "Incidence Angle", eli5: "The angle at which the radar beam hits the ground. Shining a flashlight straight down vs. at an angle." },
      { id: "Look Angle", eli5: "The angle the satellite points its antenna away from looking straight down." },
      { id: "Resolution", eli5: "How sharp the picture is. High resolution means you can clearly see a small car instead of a blurry blob." },
      { id: "Chirp Rate", eli5: "How fast the radar 'chirp' changes from a low pitch to a high pitch." },
      { id: "PRF", eli5: "Pulse Repetition Frequency. How many times per second the satellite yells 'Ping!' (usually thousands of times)." },
      { id: "Swath Width", eli5: "The width of the giant stripe of land the satellite can see as it flies over." }
    ]
  },
  {
    id: "data",
    title: "2. Data Containers & Specs",
    color: "#8b5cf6", // Purple
    terms: [
      { id: "SAR", eli5: "Synthetic Aperture Radar. Using math to pretend a tiny antenna is actually a giant one, making blurry pictures incredibly sharp." },
      { id: "SLC", eli5: "Single Look Complex. The rawest, purest radar image where every pixel has both brightness and a 'phase' (exact timing of the light wave)." },
      { id: "RSLC", eli5: "Resampled SLC. Like an SLC, but stretched or squeezed perfectly to match a map grid so it lines up with other pictures." },
      { id: "GCOV", eli5: "Geocoded Covariance. A processed NISAR file that is super easy to drop onto a map, ready for anyone to look at." },
      { id: "HDF5", eli5: "The Backpack. A massive container file that holds gigabytes of radar numbers, organized into neat folders inside." },
      { id: "GeoTIFF", eli5: "A standard picture file (like JPEG) but it has hidden map coordinates stitched inside it." },
      { id: "COG", eli5: "Cloud Optimized GeoTIFF. A GeoTIFF cut into smart puzzle pieces so your browser can load huge maps instantly without downloading the whole file." }
    ]
  },
  {
    id: "focusing",
    title: "3. Focusing Algorithms",
    color: "#f43f5e", // Rose/Red
    terms: [
      { id: "RDA", eli5: "Range-Doppler Algorithm. The heavy math engine that turns raw, messy echoes into a focused picture." },
      { id: "RCMC", eli5: "Range Cell Migration Correction. Because the satellite moves incredibly fast, a single tree's echo gets smeared into a curve. RCMC mathematically straightens it out." },
      { id: "Azimuth Compression", eli5: "Using the Doppler siren effect (pitch change) to perfectly pinpoint a signal along the satellite's flight path." },
      { id: "Range Compression", eli5: "Squeezing the long 'chirp' sound into a single, sharp dot of light on the ground sideways." },
      { id: "Sinc Interpolation", eli5: "A math trick to safely guess the values between pixels so you can resize the image without making it blocky." },
      { id: "CFAR", eli5: "Constant False Alarm Rate. A filter that prevents ocean waves from accidentally looking like ships." },
      { id: "CA-CFAR", eli5: "Cell-Averaging CFAR. Looking at the darkness of the sea around a bright spot to prove it's definitely a ship and not just sea clutter." }
    ]
  },
  {
    id: "superpowers",
    title: "4. Superpowers & Analytics",
    color: "#f59e0b", // Amber
    terms: [
      { id: "InSAR", eli5: "Interferometry. Subtracting two SAR pictures of the same place to see if the ground moved by even a millimeter (like tracking earthquakes)." },
      { id: "PS-InSAR", eli5: "Looking only at highly reflective objects (like steel bridges) because they never change shape. The most accurate way to measure sinking buildings." },
      { id: "PolSAR", eli5: "Polarimetry. Shooting signals horizontally AND vertically at the same time. The way they bounce lets you know if a spot is a forest, a lake, or a city." },
      { id: "Coherence", eli5: "If you take two pictures of a forest, the leaves blow in the wind, ruining the math. This is 'low coherence'. Concrete cities don't move, causing 'high coherence'." },
      { id: "Interferometry", eli5: "The general science of smashing two waves together and looking at the resulting pattern to measure microscopic changes." },
      { id: "Deformation", eli5: "When the ground actually sinks or rises." },
      { id: "Persistent Scatterer", eli5: "A rock or a metal pole that shines brightly and flawlessly in radar every single time the satellite flies over." },
      { id: "Covariance Matrix", eli5: "A giant math grid storing how all the different polarizations relate to each other." },
      { id: "HH/VV/HV", eli5: "H = Horizontal. V = Vertical. 'HV' means the satellite shot it Horizontal, but the object twisted it and bounced it back Vertical. Trees twist signals. Flat streets do not." }
    ]
  },
  {
    id: "mapgrid",
    title: "5. Geospatial Map Grid",
    color: "#10b981", // Emerald
    terms: [
      { id: "WGS84", eli5: "The coordinate system that the entire Earth agreed to use. GPS uses this." },
      { id: "Geocoding", eli5: "Taking a raw radar image from space and stretching/pinning it onto a 3D globe so it matches the real world." },
      { id: "Bounding Box", eli5: "Drawing a rectangle over a map with 4 coordinates (North, South, East, West) to define an exact area." },
      { id: "SRS", eli5: "Spatial Reference System. Rules for how to flatten a 3D Earth onto a 2D computer screen without messing up distances." },
      { id: "TiTiler", eli5: "A dynamic server engine that slices massive satellite images on-the-fly to show on web browsers." },
      { id: "WebGL", eli5: "Using your computer's graphics card (GPU) directly inside the browser for lightning-fast 3D mapping." },
      { id: "Leaflet", eli5: "The open-source code library that allows you to drag, zoom, and interact with the map." }
    ]
  },
  {
    id: "stack",
    title: "6. The Software Stack",
    color: "#0ea5e9", // Sky Blue
    terms: [
      { id: "Kubernetes", eli5: "The conductor of the orchestra. It automatically starts up new processing computers when there is too much data to handle." },
      { id: "Operator", eli5: "A custom bot that sits inside Kubernetes, watching for SAR jobs and dispatching them." },
      { id: "CRD", eli5: "Custom Resource Definition. Teaching Kubernetes a new word. Instead of 'Run a website', we tell it 'Run a SAR Pipeline'." },
      { id: "Gateway", eli5: "The front door. All commands to process satellite data pass through here safely." },
      { id: "Axum", eli5: "A hyper-fast framework inside Rust that we use to build the Gateway API." },
      { id: "SSE", eli5: "Server-Sent Events. Like a live news ticker. The server constantly pushes log updates to your screen without you having to refresh." },
      { id: "Vite", eli5: "The lightning-fast build tool that creates the React interface you are looking at right now." }
    ]
  }
];
