import React, { useRef, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Sphere } from '@react-three/drei'
import * as THREE from 'three'

// The rotating 3D Earth matching the huge scale and lighting of the SpaceX planet
// Restyled to represent a Synthetic Aperture Radar (SAR) digital visualization
function Earth() {
  const meshRef = useRef()
  
  // Use local textures
  const [colorMap, nightMap] = useLoader(THREE.TextureLoader, ['/earth.jpg', '/earth_night.png'])

  // Define our custom day/night shader uniforms
  const uniforms = React.useMemo(() => ({
    dayMap: { value: colorMap },
    nightMap: { value: nightMap },
    sunDirection: { value: new THREE.Vector3(-8, 2, 4).normalize() }
  }), [colorMap, nightMap])

  // Slow smooth rotation
  useFrame((state, delta) => {
    meshRef.current.rotation.y += delta * 0.03
  })

  return (
    <group position={[2.3, 0, 0]}>
      {/* Main globe: sized down and positioned further right */}
      <Sphere ref={meshRef} args={[2.0, 64, 64]}>
        <shaderMaterial 
          uniforms={uniforms}
          vertexShader={`
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
              vUv = uv;
              // ModelMatrix converts normal to world space so lighting doesn't rotate with the texture
              vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform sampler2D dayMap;
            uniform sampler2D nightMap;
            uniform vec3 sunDirection;
            
            varying vec2 vUv;
            varying vec3 vNormal;
            
            void main() {
              vec3 normal = normalize(vNormal);
              // Calculate light intensity
              float intensity = dot(normal, sunDirection);
              
              // Smoothly mix between day and night textures to create a dusk/dawn terminator line
              float dayMix = smoothstep(-0.2, 0.2, intensity);
              
              // Natural daylight colors
              vec4 dayColor = texture2D(dayMap, vUv);

              // Night lights map
              vec4 nightColor = texture2D(nightMap, vUv);
              // Boost city lights and give them a highly visible cinematic warm glow
              nightColor = nightColor * vec4(1.5, 1.2, 0.8, 1.0);
              
              // Apply standard Lambert lighting to the day side
              vec4 shadedDay = dayColor * max(0.0, intensity);
              // Add a tiny bit of ambient light to the day side
              shadedDay += dayColor * 0.05;
              
              // Blend day and night
              vec4 finalColor = mix(nightColor, shadedDay, dayMix);
              
              // Add a subtle atmospheric rim glow on the edge of the planet facing the camera
              float rim = 1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0);
              rim = smoothstep(0.6, 1.0, rim);
              finalColor += vec4(0.1, 0.3, 0.6, 1.0) * rim * 0.5 * dayMix;
              
              gl_FragColor = finalColor;
            }
          `}
        />
      </Sphere>
    </group>
  )
}

function Hero() {
    return (
        <section style={{
            minHeight: '100vh',
            width: '100%',
            position: 'relative',
            background: '#000000',
            overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute',
                top: 0, 
                left: 0, 
                width: '100%',
                height: '100%',
                zIndex: 0,
            }}>
                <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
                    <ambientLight intensity={0.005} />
                    
                    <directionalLight 
                        position={[-8, 2, 4]} 
                        intensity={4.0} 
                        color="#ffffff" 
                    />
                    
                    <Suspense fallback={null}>
                        <Earth />
                    </Suspense>
                </Canvas>
            </div>

            <div style={{
                position: 'absolute',
                zIndex: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                left: '10%',
                maxWidth: '600px',
                pointerEvents: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <h1 style={{
                    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                    margin: '0 0 24px 0',
                    pointerEvents: 'auto',
                }}>
                    Earth Observation<br/> at Hyperscale
                </h1>

                <p style={{
                    fontSize: '1rem',
                    color: '#d1d5db',
                    lineHeight: 1.6,
                    fontWeight: 400,
                    margin: '0 0 40px 0',
                    maxWidth: '450px',
                    pointerEvents: 'auto',
                }}>
                    Production-grade synthetic aperture radar focusing. Process NISAR and Sentinel-1 data with our blazing fast Rust engine without managing infrastructure.
                </p>

                <div style={{ pointerEvents: 'auto' }}>
                    <Link to="/app" 
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px 40px',
                            background: 'transparent',
                            border: '2px solid #ffffff',
                            color: '#ffffff',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#ffffff';
                        }}
                    >
                        Explore 
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </Link>
                </div>
            </div>
            
            <header style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                padding: '30px 50px',
                display: 'flex',
                alignItems: 'center',
                zIndex: 20,
            }}>
                <div style={{
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    letterSpacing: '0.2rem',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                    SARX
                </div>
            </header>
        </section>
    )
}

export default Hero
