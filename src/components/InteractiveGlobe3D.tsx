import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  MapPin,
  RotateCcw,
  Pause,
  Play,
  ZoomIn,
  ZoomOut,
  Search,
  Calendar,
  ExternalLink,
  Compass,
  LogIn,
  Globe,
  CheckCircle2,
  X,
  ChevronRight
} from 'lucide-react';
import {
  latLngToVector3,
  getGlobeRotationForLatLng,
  shortestAngleDelta,
  clusterVisitedPlaces,
  VisitedPlaceMarkerInput,
  GlobeMarkerCluster
} from '../features/globe/globeCoordinates';
import { getRealisticEarthTextures } from '../features/globe/earthTextureGenerator';
import { useUserVisitedPlaces } from '../hooks/useUserVisitedPlaces';
import { INDIA_DESTINATIONS } from '../data/indiaDestinations';

export interface CityPin {
  name: string;
  lat: number;
  lng: number;
  color?: number;
}

export interface InteractiveGlobe3DProps {
  visitedPins?: VisitedPlaceMarkerInput[];
  onRequestLogin?: () => void;
}

export const InteractiveGlobe3D: React.FC<InteractiveGlobe3DProps> = ({
  visitedPins: propVisitedPins,
  onRequestLogin
}) => {
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement>(null);

  const {
    user,
    isAuthenticated,
    authLoading,
    summary
  } = useUserVisitedPlaces();

  // Authoritative visited places: only show personal markers when authenticated (or explicitly passed in tests)
  const activePlaces: VisitedPlaceMarkerInput[] = useMemo(() => {
    if (propVisitedPins !== undefined) {
      return propVisitedPins;
    }
    if (!isAuthenticated || !user) {
      return [];
    }
    return summary.uniquePlaces;
  }, [propVisitedPins, isAuthenticated, user, summary.uniquePlaces]);

  const [webGLSupported, setWebGLSupported] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [zoomDistance, setZoomDistance] = useState<number>(4.55);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<GlobeMarkerCluster | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('ALL');

  // Dynamic cluster radius shrinks as user zooms in so close places separate nicely
  const clusterRadiusKm = useMemo(() => {
    if (zoomDistance < 3.4) return 8;
    if (zoomDistance < 4.0) return 22;
    return 45;
  }, [zoomDistance]);

  const clusters = useMemo(
    () => clusterVisitedPlaces(activePlaces, clusterRadiusKm),
    [activePlaces, clusterRadiusKm]
  );

  const selectedPlace: VisitedPlaceMarkerInput | null = useMemo(() => {
    if (!selectedPlaceId) return null;
    return activePlaces.find(p => p.placeId === selectedPlaceId) || null;
  }, [activePlaces, selectedPlaceId]);

  // Clear selection when user logs out or switches account
  useEffect(() => {
    setSelectedPlaceId(null);
    setSelectedCluster(null);
    setSearchQuery('');
    setCityFilter('ALL');
  }, [user?.id, isAuthenticated]);

  // Mutable refs for Three.js animation loop & camera targets
  const sceneRef = useRef<THREE.Scene | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const pinGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const targetRotationRef = useRef<{ rotX: number; rotY: number } | null>(null);
  const targetZoomRef = useRef<number>(4.55);
  const isPausedRef = useRef<boolean>(false);
  const isSelectedRef = useRef<boolean>(false);
  const markerMeshesRef = useRef<THREE.Object3D[]>([]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isSelectedRef.current = Boolean(selectedPlaceId);
  }, [selectedPlaceId]);

  // Focus the 3D globe smoothly on a specific place
  const focusOnPlace = useCallback((place: VisitedPlaceMarkerInput, cluster?: GlobeMarkerCluster) => {
    setSelectedPlaceId(place.placeId);
    if (cluster) {
      setSelectedCluster(cluster);
    } else {
      const matchingCluster = clusters.find(c =>
        c.places.some(p => p.placeId === place.placeId)
      );
      setSelectedCluster(matchingCluster || null);
    }

    const { rotX, rotY } = getGlobeRotationForLatLng(place.latitude, place.longitude);
    targetRotationRef.current = { rotX, rotY };
    const nextZoom = Math.min(targetZoomRef.current, 3.65);
    targetZoomRef.current = nextZoom;
    setZoomDistance(nextZoom);
  }, [clusters]);

  // Reset globe camera and rotation to default view
  const handleResetView = useCallback(() => {
    setSelectedPlaceId(null);
    setSelectedCluster(null);
    // Default orientation centered on India / Indian Ocean (21°N, 78°E)
    const { rotX, rotY } = getGlobeRotationForLatLng(21.0, 78.0);
    targetRotationRef.current = { rotX, rotY };
    targetZoomRef.current = 4.55;
    setZoomDistance(4.55);
  }, []);

  const handleZoom = useCallback((delta: number) => {
    const next = Math.max(2.85, Math.min(6.0, targetZoomRef.current + delta));
    targetZoomRef.current = next;
    setZoomDistance(next);
  }, []);

  // 1. Initialize Three.js Scene ONCE (does not rebuild when markers update)
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGLSupported(false);
        return;
      }
    } catch {
      setWebGLSupported(false);
      return;
    }

    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = currentMount.clientWidth || 380;
    const height = currentMount.clientHeight || 380;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsPaused(true);
      isPausedRef.current = true;
    }

    // Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 0, targetZoomRef.current);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    currentMount.innerHTML = '';
    currentMount.appendChild(renderer.domElement);

    // Space Starfield Background
    const starCount = 450;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 18 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 0.08,
      transparent: true,
      opacity: 0.75
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Realistic Solar & Atmospheric Lighting
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.75);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    sunLight.position.set(6, 3.5, 5);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-5, -2.5, -4);
    scene.add(rimLight);

    // Master Globe Group
    const globeGroup = new THREE.Group();
    globeGroup.rotation.order = 'XYZ';
    const initialRot = getGlobeRotationForLatLng(21.0, 78.0);
    globeGroup.rotation.x = initialRot.rotX;
    globeGroup.rotation.y = initialRot.rotY;
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const globeRadius = 1.72;

    // Realistic Earth Textures
    const { dayMap, specularMap, cloudsMap } = getRealisticEarthTextures();

    // 1. Realistic Planet Earth Surface Mesh
    const earthGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayMap,
      specularMap: specularMap,
      specular: new THREE.Color(0x2a5a7a),
      shininess: 18
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // 2. Subtle Cloud Layer Mesh
    const cloudGeo = new THREE.SphereGeometry(globeRadius * 1.012, 48, 48);
    const cloudMat = new THREE.MeshLambertMaterial({
      map: cloudsMap,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    globeGroup.add(cloudMesh);

    // 3. Outer Atmospheric Glow Halo
    const atmosphereGeo = new THREE.SphereGeometry(globeRadius * 1.11, 48, 48);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    scene.add(atmosphereMesh);

    // 4. Inner Horizon Rim Glow
    const innerGlowGeo = new THREE.SphereGeometry(globeRadius * 1.028, 48, 48);
    const innerGlowMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending
    });
    const innerGlowMesh = new THREE.Mesh(innerGlowGeo, innerGlowMat);
    scene.add(innerGlowMesh);

    // 5. Visited-Place Markers Group (attached to globeGroup so markers rotate with Earth)
    const pinGroup = new THREE.Group();
    globeGroup.add(pinGroup);
    pinGroupRef.current = pinGroup;

    // Interactive Drag, Raycast Click & Wheel Zoom Handlers
    let isDragging = false;
    let dragDistance = 0;
    let prevX = 0;
    let prevY = 0;
    let initialPinchDist: number | null = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragDistance = 0;
      targetRotationRef.current = null; // Cancel active camera tween on manual drag
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !globeGroupRef.current) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      globeGroupRef.current.rotation.y += dx * 0.0055;
      globeGroupRef.current.rotation.x = Math.max(
        -Math.PI / 2.3,
        Math.min(Math.PI / 2.3, globeGroupRef.current.rotation.x + dy * 0.0055)
      );
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;

      // If it was a clean click (not a drag), perform raycast against markers
      if (dragDistance < 6 && markerMeshesRef.current.length > 0) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const intersects = raycaster.intersectObjects(markerMeshesRef.current, true);
        if (intersects.length > 0) {
          let obj: THREE.Object3D | null = intersects[0].object;
          while (obj && !obj.userData?.cluster) {
            obj = obj.parent;
          }
          if (obj?.userData?.cluster) {
            const clickedCluster = obj.userData.cluster as GlobeMarkerCluster;
            const firstPlace = clickedCluster.places[0];
            if (firstPlace) {
              setSelectedCluster(clickedCluster);
              setSelectedPlaceId(firstPlace.placeId);
              const { rotX, rotY } = getGlobeRotationForLatLng(
                clickedCluster.latitude,
                clickedCluster.longitude
              );
              targetRotationRef.current = { rotX, rotY };
              const nextZoom = Math.min(targetZoomRef.current, 3.6);
              targetZoomRef.current = nextZoom;
              setZoomDistance(nextZoom);
            }
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * 0.0022;
      const next = Math.max(2.85, Math.min(6.0, targetZoomRef.current + delta));
      targetZoomRef.current = next;
      setZoomDistance(next);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        dragDistance = 0;
        targetRotationRef.current = null;
        prevX = e.touches[0].clientX;
        prevY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging && globeGroupRef.current) {
        const dx = e.touches[0].clientX - prevX;
        const dy = e.touches[0].clientY - prevY;
        dragDistance += Math.abs(dx) + Math.abs(dy);
        globeGroupRef.current.rotation.y += dx * 0.0065;
        globeGroupRef.current.rotation.x = Math.max(
          -Math.PI / 2.3,
          Math.min(Math.PI / 2.3, globeGroupRef.current.rotation.x + dy * 0.0065)
        );
        prevX = e.touches[0].clientX;
        prevY = e.touches[0].clientY;
      } else if (e.touches.length === 2 && initialPinchDist !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const pinchDelta = (initialPinchDist - dist) * 0.01;
        const next = Math.max(2.85, Math.min(6.0, targetZoomRef.current + pinchDelta));
        targetZoomRef.current = next;
        setZoomDistance(next);
        initialPinchDist = dist;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isDragging && dragDistance < 8 && e.changedTouches.length === 1 && markerMeshesRef.current.length > 0) {
        const touch = e.changedTouches[0];
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(markerMeshesRef.current, true);
        if (intersects.length > 0) {
          let obj: THREE.Object3D | null = intersects[0].object;
          while (obj && !obj.userData?.cluster) {
            obj = obj.parent;
          }
          if (obj?.userData?.cluster) {
            const clickedCluster = obj.userData.cluster as GlobeMarkerCluster;
            const firstPlace = clickedCluster.places[0];
            if (firstPlace) {
              setSelectedCluster(clickedCluster);
              setSelectedPlaceId(firstPlace.placeId);
              const { rotX, rotY } = getGlobeRotationForLatLng(
                clickedCluster.latitude,
                clickedCluster.longitude
              );
              targetRotationRef.current = { rotX, rotY };
            }
          }
        }
      }
      isDragging = false;
      initialPinchDist = null;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Drift clouds slowly
      cloudMesh.rotation.y = elapsed * 0.004;

      // Smooth camera zoom interpolation
      camera.position.z += (targetZoomRef.current - camera.position.z) * 0.1;

      if (targetRotationRef.current) {
        // Smooth slerp-like Euler transition toward focused location
        const dy = shortestAngleDelta(globeGroup.rotation.y, targetRotationRef.current.rotY);
        const dx = targetRotationRef.current.rotX - globeGroup.rotation.x;
        globeGroup.rotation.y += dy * 0.09;
        globeGroup.rotation.x += dx * 0.09;

        if (Math.abs(dy) < 0.002 && Math.abs(dx) < 0.002) {
          globeGroup.rotation.y = targetRotationRef.current.rotY;
          globeGroup.rotation.x = targetRotationRef.current.rotX;
          targetRotationRef.current = null;
        }
      } else if (!isDragging && !isPausedRef.current && !isSelectedRef.current) {
        globeGroup.rotation.y += 0.0022;
      }

      // Pulse marker rings gently
      if (pinGroupRef.current) {
        const pulseScale = 1 + Math.sin(elapsed * 3.2) * 0.22;
        pinGroupRef.current.children.forEach(markerNode => {
          const pulseRing = markerNode.getObjectByName('pulseRing');
          if (pulseRing) {
            pulseRing.scale.setScalar(pulseScale);
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!currentMount) return;
      const newW = currentMount.clientWidth || 380;
      const newH = currentMount.clientHeight || 380;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', handleResize);
      starGeo.dispose();
      starMat.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      atmosphereGeo.dispose();
      atmosphereMat.dispose();
      innerGlowGeo.dispose();
      innerGlowMat.dispose();
      renderer.dispose();
      if (currentMount) currentMount.innerHTML = '';
    };
  }, []);

  // 2. Efficiently update ONLY the marker layer when clusters or selection change
  useEffect(() => {
    const pinGroup = pinGroupRef.current;
    if (!pinGroup) return;

    // Clear previous marker meshes cleanly
    while (pinGroup.children.length > 0) {
      const child = pinGroup.children[0];
      pinGroup.remove(child);
    }
    markerMeshesRef.current = [];

    if (clusters.length === 0) return;

    const globeRadius = 1.72;
    const stemGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.11, 10);
    const singleHeadGeo = new THREE.SphereGeometry(0.044, 16, 16);
    const clusterHeadGeo = new THREE.SphereGeometry(0.058, 18, 18);
    const hitSphereGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const ringGeo = new THREE.RingGeometry(0.052, 0.082, 24);

    clusters.forEach(cluster => {
      const isSelected = cluster.places.some(p => p.placeId === selectedPlaceId);
      const surfacePos = latLngToVector3(cluster.latitude, cluster.longitude, globeRadius);
      const normal = surfacePos.clone().normalize();

      const markerHolder = new THREE.Group();
      markerHolder.userData = { cluster };

      // Color distinction:
      // - Selected marker: Bright Emerald-White (#34d399)
      // - Active trip destination: Terracotta Coral (#fb7185 / #e07a5f)
      // - Visited historical place: Warm Imperial Gold (#fbbf24)
      const primaryColor = isSelected
        ? 0x34d399
        : cluster.hasActiveDestination
        ? 0xf97316
        : 0xfbbf24;

      // Stem rising from exact surface coordinate along outward normal
      const stemMat = new THREE.MeshStandardMaterial({
        color: primaryColor,
        emissive: primaryColor,
        emissiveIntensity: 0.45,
        roughness: 0.2
      });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.copy(surfacePos.clone().add(normal.clone().multiplyScalar(0.05)));
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      markerHolder.add(stem);

      // Glowing Pin Head
      const headMat = new THREE.MeshStandardMaterial({
        color: primaryColor,
        emissive: primaryColor,
        emissiveIntensity: isSelected ? 1.1 : 0.8,
        roughness: 0.15,
        metalness: 0.3
      });
      const head = new THREE.Mesh(
        cluster.isCluster ? clusterHeadGeo : singleHeadGeo,
        headMat
      );
      const headAltitude = isSelected ? 0.13 : 0.105;
      head.position.copy(surfacePos.clone().add(normal.clone().multiplyScalar(headAltitude)));
      if (isSelected) {
        head.scale.setScalar(1.32);
      }
      markerHolder.add(head);

      // Surface Pulse Halo Ring tangent to the sphere at (lat, lng)
      const ringMat = new THREE.MeshBasicMaterial({
        color: primaryColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.85 : 0.55
      });
      const pulseRing = new THREE.Mesh(ringGeo, ringMat);
      pulseRing.name = 'pulseRing';
      pulseRing.position.copy(surfacePos.clone().add(normal.clone().multiplyScalar(0.012)));
      pulseRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      markerHolder.add(pulseRing);

      // Invisible hit target for effortless mobile & desktop tapping
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitSphereGeo, hitMat);
      hitMesh.position.copy(head.position);
      markerHolder.add(hitMesh);

      pinGroup.add(markerHolder);
      markerMeshesRef.current.push(markerHolder);
    });
  }, [clusters, selectedPlaceId]);

  // Filtered travel history list for the companion panel
  const filteredHistory = useMemo(() => {
    return activePlaces.filter(place => {
      const matchesCity =
        cityFilter === 'ALL' ||
        place.destinationCity.toLowerCase() === cityFilter.toLowerCase();
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        place.placeName.toLowerCase().includes(q) ||
        place.destinationCity.toLowerCase().includes(q) ||
        (place.category && place.category.toLowerCase().includes(q));
      return matchesCity && matchesQuery;
    });
  }, [activePlaces, cityFilter, searchQuery]);

  const handleOpenPlaceOrTrip = (place: VisitedPlaceMarkerInput) => {
    // Check if place exists in INDIA_DESTINATIONS to open its detail page, or open My Trips
    const knownDest = INDIA_DESTINATIONS.find(
      d => d.id === place.placeId || d.name.toLowerCase() === place.placeName.toLowerCase()
    );
    if (knownDest) {
      navigate(`/destinations/${knownDest.id}`);
    } else {
      navigate('/my-trips');
    }
  };

  if (!webGLSupported) {
    return (
      <div className="w-full h-80 bg-gradient-to-br from-[#0f253e] via-[#173753] to-[#1e3f32] rounded-3xl border border-border flex flex-col items-center justify-center p-6 text-center space-y-3 text-white">
        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
          <Globe className="w-8 h-8 text-sage-light" />
        </div>
        <h4 className="font-serif font-bold text-lg">Interactive Planet Earth & Travel History</h4>
        <p className="text-xs text-white/80 max-w-xs">
          WebGL is disabled in your browser. Enable hardware acceleration to explore the 3D Earth globe, or view your visited places below.
        </p>
        {isAuthenticated && activePlaces.length > 0 && (
          <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
            {activePlaces.slice(0, 5).map(p => (
              <span
                key={p.placeId}
                className="px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-medium"
              >
                📍 {p.placeName} ({p.destinationCity})
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* 3D Earth Viewport */}
      <div className="relative w-full h-[350px] sm:h-[380px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#07111e] via-[#0c1e35] to-[#091526] border border-slate-800/80 shadow-inner flex items-center justify-center">
        <div
          ref={mountRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          title="Drag to rotate Earth • Scroll to zoom • Click any glowing pin to inspect"
        />

        {/* Top-Left Status Badge */}
        <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full text-[11px] text-white shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              isAuthenticated ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'
            }`}
          />
          <span className="font-medium">
            {isAuthenticated
              ? `${user?.name || 'Traveler'}'s Travel Globe`
              : 'Planet Earth • Live 3D View'}
          </span>
        </div>

        {/* Top-Right Interactive Controls (Pause/Resume, Zoom, Reset) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-white/15 p-1 rounded-xl text-white shadow-sm">
          <button
            type="button"
            onClick={() => setIsPaused(prev => !prev)}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            title={isPaused ? 'Resume Earth rotation' : 'Pause Earth rotation'}
            aria-label={isPaused ? 'Resume Earth rotation' : 'Pause Earth rotation'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-amber-300" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-0.45)}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(0.45)}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            title="Reset globe view"
            aria-label="Reset globe view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Selected Marker Inspector Popover */}
        {selectedPlace && (
          <div className="absolute bottom-3 inset-x-3 bg-white/95 backdrop-blur-xl border border-border rounded-2xl p-3.5 shadow-2xl text-text animate-fade-in z-20">
            {/* Cluster Place Switcher if multiple places are in this cluster */}
            {selectedCluster && selectedCluster.places.length > 1 && (
              <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-border overflow-x-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex-shrink-0">
                  {selectedCluster.city} Cluster ({selectedCluster.places.length}):
                </span>
                {selectedCluster.places.map(p => (
                  <button
                    key={p.placeId}
                    type="button"
                    onClick={() => setSelectedPlaceId(p.placeId)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all flex-shrink-0 ${
                      p.placeId === selectedPlace.placeId
                        ? 'bg-deep-green text-white'
                        : 'bg-ivory-dark text-text-muted hover:text-text'
                    }`}
                  >
                    {p.placeName}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-start gap-3">
              {selectedPlace.imageUrl ? (
                <img
                  src={selectedPlace.imageUrl}
                  alt={selectedPlace.placeName}
                  className="w-16 h-16 rounded-xl object-cover border border-border flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-ivory-dark border border-border flex flex-col items-center justify-center text-[10px] text-text-muted flex-shrink-0">
                  <MapPin className="w-4 h-4 text-sage mb-0.5" />
                  <span>Verified</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-terracotta">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>
                        Visited • {selectedPlace.destinationCity}, {selectedPlace.country}
                      </span>
                    </span>
                    <h4 className="font-serif font-bold text-sm text-text truncate">
                      {selectedPlace.placeName}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlaceId(null);
                      setSelectedCluster(null);
                    }}
                    className="text-text-subtle hover:text-text p-1 rounded-lg"
                    aria-label="Close place details"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/60 text-[11px]">
                  <span className="text-text-muted flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-sage" />
                    <span>
                      {new Date(selectedPlace.visitedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenPlaceOrTrip(selectedPlace)}
                    className="font-bold text-deep-green hover:underline flex items-center gap-1"
                  >
                    <span>Explore Place</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logged-out Invitation Overlay Pill */}
        {!isAuthenticated && !authLoading && propVisitedPins === undefined && (
          <div className="absolute bottom-3 inset-x-3 bg-slate-900/85 backdrop-blur-md border border-white/15 px-3.5 py-2.5 rounded-2xl text-xs text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-[11px] text-white/90">
                Sign in to unlock your personal visited-places travel globe.
              </span>
            </div>
            {onRequestLogin ? (
              <button
                type="button"
                onClick={onRequestLogin}
                className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] flex-shrink-0 transition-colors"
              >
                Sign In
              </button>
            ) : (
              <Link
                to="/profile"
                className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] flex-shrink-0 transition-colors flex items-center gap-1"
              >
                <LogIn className="w-3 h-3" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Personal Travel History Panel (Logged-In State) */}
      {(isAuthenticated || propVisitedPins !== undefined) && (
        <div className="bg-white rounded-2xl border border-border p-3.5 space-y-3 shadow-soft-sm">
          {/* Stats Bar Distinguishing Unique Places, Total Visits, Cities, and Countries */}
          <div className="grid grid-cols-4 gap-2 text-center bg-ivory/70 rounded-xl p-2 border border-border/60">
            <div>
              <span className="block font-serif font-bold text-base text-deep-green">
                {propVisitedPins !== undefined ? activePlaces.length : summary.uniquePlacesCount}
              </span>
              <span className="text-[10px] text-text-muted font-medium">Unique Places</span>
            </div>
            <div>
              <span className="block font-serif font-bold text-base text-terracotta">
                {propVisitedPins !== undefined ? activePlaces.length : summary.totalVisitRecords}
              </span>
              <span className="text-[10px] text-text-muted font-medium">Total Visits</span>
            </div>
            <div>
              <span className="block font-serif font-bold text-base text-text">
                {propVisitedPins !== undefined
                  ? new Set(activePlaces.map(p => p.destinationCity)).size
                  : summary.uniqueCitiesCount}
              </span>
              <span className="text-[10px] text-text-muted font-medium">Cities</span>
            </div>
            <div>
              <span className="block font-serif font-bold text-base text-text">
                {propVisitedPins !== undefined
                  ? new Set(activePlaces.map(p => p.country)).size
                  : summary.uniqueCountriesCount}
              </span>
              <span className="text-[10px] text-text-muted font-medium">Countries</span>
            </div>
          </div>

          {activePlaces.length === 0 ? (
            /* Empty History State */
            <div className="text-center py-4 px-3 space-y-2">
              <div className="w-9 h-9 rounded-full bg-sage/20 text-deep-green flex items-center justify-center mx-auto">
                <Compass className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-text">
                Your Personal Travel Globe Awaits
              </p>
              <p className="text-[11px] text-text-muted max-w-xs mx-auto">
                Plan a trip and mark places as visited in the Journey Tracker to watch your glowing pins light up across Planet Earth.
              </p>
            </div>
          ) : (
            /* Searchable & Filterable Visited Places List */
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search visited places or cities..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-ivory text-xs text-text border border-border focus:outline-none focus:border-deep-green"
                  />
                </div>
                {summary.uniqueCities.length > 1 && (
                  <select
                    value={cityFilter}
                    onChange={e => setCityFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-ivory text-xs text-text border border-border focus:outline-none focus:border-deep-green"
                    aria-label="Filter by city"
                  >
                    <option value="ALL">All Cities</option>
                    {summary.uniqueCities.map(city => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {filteredHistory.map(place => {
                  const isSelected = place.placeId === selectedPlaceId;
                  return (
                    <button
                      key={place.placeId}
                      type="button"
                      onClick={() => focusOnPlace(place)}
                      className={`w-full text-left p-2 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs ${
                        isSelected
                          ? 'bg-deep-green text-white border-deep-green shadow-soft-sm'
                          : 'bg-ivory/60 hover:bg-ivory border-border/70 text-text'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            isSelected ? 'bg-emerald-300' : 'bg-amber-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{place.placeName}</p>
                          <p
                            className={`text-[10px] truncate ${
                              isSelected ? 'text-white/80' : 'text-text-muted'
                            }`}
                          >
                            {place.destinationCity}, {place.country}
                            {place.visitCount && place.visitCount > 1
                              ? ` • ${place.visitCount} visits`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isSelected ? 'text-white' : 'text-text-subtle'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
