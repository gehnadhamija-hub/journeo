import * as THREE from 'three';

/**
 * Accurate geographic coastline polygons in [longitude, latitude] degrees.
 * Mapped onto equirectangular projection:
 *   x = ((lng + 180) / 360) * width
 *   y = ((90 - lat) / 180) * height
 */
type LngLat = [number, number];

interface LandMassPolygon {
  name: string;
  baseColor: string;
  coords: LngLat[];
}

const WORLD_LANDMASS_POLYGONS: LandMassPolygon[] = [
  // 1. Eurasia + Indian Subcontinent + Arabian Peninsula + Southeast Asia
  {
    name: 'Eurasia',
    baseColor: '#3a6642',
    coords: [
      [-9.5, 36.0], [-9.2, 38.7], [-8.8, 42.0], [-4.5, 43.4], [-1.5, 43.4],
      [-4.7, 48.4], [-1.6, 49.6], [1.8, 51.0], [4.5, 52.4], [8.5, 54.0],
      [8.2, 57.0], [10.6, 57.7], [12.0, 56.0], [9.8, 54.5], [14.0, 54.0],
      [18.6, 54.4], [21.0, 55.8], [24.0, 57.0], [24.8, 59.4], [28.2, 60.0],
      [21.5, 61.5], [22.0, 64.0], [25.4, 65.0], [24.0, 65.8], [18.0, 63.0],
      [17.5, 59.0], [16.0, 56.2], [13.0, 55.4], [11.5, 58.9], [10.5, 59.9],
      [5.3, 60.4], [6.0, 62.5], [10.4, 63.4], [14.4, 67.3], [18.9, 69.6],
      [25.8, 71.1], [31.0, 69.8], [33.5, 69.2], [40.5, 67.5], [38.0, 64.5],
      [40.5, 64.5], [44.0, 66.5], [43.5, 68.5], [50.0, 69.0], [60.0, 69.8],
      [68.5, 73.0], [72.5, 73.0], [73.5, 68.0], [77.0, 72.5], [85.0, 73.8],
      [104.3, 77.7], [114.0, 73.5], [128.0, 73.0], [140.0, 73.0], [150.0, 71.5],
      [162.0, 69.6], [178.0, 68.9], [180.0, 65.0], [171.0, 60.5], [163.0, 59.5],
      [163.0, 55.0], [156.7, 51.0], [156.5, 54.5], [160.0, 59.0], [151.0, 59.6],
      [142.0, 59.0], [136.0, 54.5], [141.4, 53.0], [140.0, 48.0], [135.0, 43.5],
      [131.0, 42.5], [129.4, 35.1], [126.5, 34.5], [126.6, 37.5], [124.3, 39.8],
      [121.2, 38.9], [119.5, 39.8], [117.7, 39.0], [119.0, 37.5], [122.6, 37.4],
      [120.3, 36.0], [121.9, 31.0], [122.0, 29.8], [120.0, 25.5], [117.0, 23.2],
      [114.2, 22.3], [110.3, 20.0], [108.6, 21.6], [106.7, 20.8], [105.8, 18.8],
      [108.2, 16.0], [109.3, 13.0], [106.7, 10.4], [104.5, 10.4], [100.6, 13.5],
      [99.3, 9.2], [101.7, 6.2], [103.8, 1.3], [101.3, 3.0], [100.3, 5.4],
      [98.3, 8.0], [98.5, 12.5], [97.6, 16.5], [96.2, 16.8], [94.3, 16.0],
      [92.3, 20.8], [91.8, 22.3], [89.0, 21.6], [86.9, 21.4], [85.8, 19.8],
      // East Coast of India (Coromandel & Andhra)
      [83.3, 17.7], [82.2, 16.6], [80.3, 15.8], [80.3, 13.1], [79.8, 10.8],
      [79.3, 10.3], [78.8, 9.3], [77.5, 8.08], // Kanyakumari
      // West Coast of India (Malabar, Konkan, Gujarat)
      [76.9, 8.5], [76.27, 9.93], [75.78, 11.25], [74.84, 12.91], [73.83, 15.49],
      [73.3, 17.0], [72.88, 19.08], [72.83, 21.17], [72.2, 21.7], [70.4, 20.9],
      [69.0, 22.2], [70.1, 22.9], [68.5, 23.6], [67.0, 24.9],
      // Makran & Persian Gulf
      [61.6, 25.2], [56.3, 27.1], [54.0, 26.8], [50.6, 28.9], [48.5, 29.9],
      [48.0, 29.3], [50.1, 26.3], [51.5, 25.3], [54.4, 24.5], [56.4, 25.3],
      [59.8, 22.5], [57.8, 20.4], [54.1, 17.0], [49.1, 14.5], [45.0, 12.8],
      [43.4, 12.6], // Red Sea
      [42.6, 16.9], [39.1, 21.5], [37.0, 25.0], [34.9, 29.5], [32.5, 29.9],
      // Mediterranean Levant, Turkey, Greece, Italy, France, Spain
      [34.5, 31.5], [35.1, 32.8], [35.8, 35.5], [36.2, 36.8], [34.6, 36.8],
      [30.7, 36.9], [27.4, 37.0], [26.2, 39.9], [29.0, 41.0], [26.8, 40.5],
      [24.0, 40.2], [23.7, 37.9], [22.4, 36.4], [21.1, 38.9], [19.4, 40.4],
      [18.8, 42.4], [16.4, 43.5], [13.8, 45.6], [12.3, 45.4], [12.6, 44.0],
      [16.8, 41.1], [18.4, 40.1], [16.6, 38.9], [15.6, 38.2], [15.9, 40.0],
      [14.2, 40.8], [12.5, 41.8], [10.3, 43.7], [8.9, 44.4], [7.3, 43.7],
      [5.4, 43.3], [3.1, 42.5], [2.2, 41.4], [-0.4, 39.5], [-0.7, 37.6],
      [-4.4, 36.7], [-5.6, 36.0], [-9.5, 36.0]
    ]
  },
  // 2. Africa
  {
    name: 'Africa',
    baseColor: '#5c7848',
    coords: [
      [-5.8, 35.8], [-0.6, 35.7], [3.0, 36.8], [8.8, 36.9], [10.8, 36.8],
      [11.0, 33.5], [13.2, 32.9], [15.5, 31.5], [20.0, 32.1], [25.2, 31.6],
      [29.9, 31.2], [32.3, 31.3], [32.6, 29.9], [35.5, 24.0], [37.2, 22.1],
      [38.8, 18.5], [39.5, 15.6], [43.3, 12.6], [45.0, 11.5], [51.4, 11.9],
      [50.0, 8.0], [45.3, 2.0], [41.5, -1.6], [39.7, -4.0], [39.3, -6.8],
      [40.6, -10.5], [40.7, -15.0], [36.9, -17.9], [34.8, -19.8], [35.5, -23.9],
      [32.6, -26.0], [31.0, -29.9], [27.9, -33.0], [25.6, -34.0], [20.0, -34.8],
      [18.4, -33.9], [17.9, -29.0], [14.5, -22.9], [11.8, -17.2], [13.2, -8.8],
      [12.2, -5.8], [9.4, 0.4], [9.7, 4.0], [6.4, 4.3], [3.4, 6.4],
      [-0.2, 5.5], [-4.0, 5.2], [-7.7, 4.4], [-10.8, 6.3], [-13.7, 9.5],
      [-16.7, 12.3], [-17.5, 14.7], [-16.5, 16.0], [-16.0, 18.0], [-17.1, 20.9],
      [-14.5, 26.2], [-13.2, 27.9], [-9.8, 30.4], [-7.6, 33.6], [-5.8, 35.8]
    ]
  },
  // 3. North & Central America
  {
    name: 'NorthAmerica',
    baseColor: '#3d6944',
    coords: [
      [-168.0, 65.6], [-162.0, 66.8], [-156.8, 71.3], [-141.0, 69.6], [-133.0, 69.5],
      [-124.0, 70.2], [-115.0, 68.0], [-105.0, 68.5], [-95.0, 69.5], [-85.0, 68.0],
      [-82.0, 64.0], [-90.0, 63.5], [-94.0, 61.0], [-92.5, 57.0], [-82.5, 55.0],
      [-79.5, 51.5], [-78.5, 55.0], [-77.5, 62.5], [-71.0, 61.0], [-65.0, 60.0],
      [-55.6, 52.0], [-59.0, 50.0], [-64.5, 49.0], [-68.0, 48.5], [-64.0, 47.0],
      [-61.0, 45.5], [-66.0, 43.5], [-67.0, 45.0], [-70.3, 43.6], [-71.0, 42.3],
      [-74.0, 40.7], [-75.5, 38.5], [-76.0, 36.8], [-75.5, 35.2], [-79.9, 32.8],
      [-81.4, 30.3], [-80.2, 25.8], [-81.1, 25.1], [-82.8, 27.9], [-84.3, 30.0],
      [-88.0, 30.2], [-89.4, 29.0], [-94.8, 29.3], [-97.4, 27.8], [-97.1, 25.9],
      [-97.8, 22.2], [-96.1, 19.2], [-90.5, 19.8], [-89.6, 21.3], [-86.8, 21.2],
      [-88.2, 18.5], [-88.6, 15.8], [-83.1, 15.0], [-83.7, 11.0], [-83.0, 10.0],
      [-79.5, 9.0], [-77.5, 8.5], [-78.0, 7.5], [-80.0, 7.5], [-83.0, 8.5],
      [-85.8, 10.5], [-87.8, 13.3], [-92.2, 14.5], [-95.2, 16.2], [-99.9, 16.8],
      [-105.3, 20.6], [-106.4, 23.2], [-109.4, 25.6], [-112.9, 29.9], [-114.8, 31.8],
      [-114.0, 29.0], [-109.9, 22.9], [-112.5, 25.0], [-115.0, 28.0], [-117.1, 32.5],
      [-120.5, 34.5], [-122.4, 37.8], [-124.2, 40.5], [-124.0, 46.2], [-124.7, 48.4],
      [-123.1, 49.3], [-128.0, 51.0], [-131.0, 54.5], [-136.0, 57.5], [-140.0, 59.8],
      [-147.0, 60.8], [-151.5, 59.6], [-158.0, 56.5], [-164.8, 54.5], [-161.0, 58.8],
      [-166.0, 61.5], [-162.0, 63.5], [-168.0, 65.6]
    ]
  },
  // 4. South America
  {
    name: 'SouthAmerica',
    baseColor: '#2d5c38',
    coords: [
      [-77.5, 8.5], [-75.5, 10.4], [-74.2, 11.2], [-71.6, 12.2], [-69.7, 11.5],
      [-67.0, 10.6], [-62.0, 10.7], [-59.8, 8.4], [-57.0, 6.0], [-52.3, 4.9],
      [-50.0, 1.5], [-48.5, -1.4], [-44.3, -2.5], [-38.5, -3.7], [-35.2, -5.8],
      [-34.9, -8.0], [-38.5, -13.0], [-39.0, -16.4], [-40.3, -20.3], [-42.0, -23.0],
      [-43.2, -23.0], [-46.3, -24.0], [-48.5, -27.6], [-50.0, -30.0], [-52.1, -32.0],
      [-54.9, -35.0], [-58.4, -34.6], [-57.5, -38.0], [-62.3, -38.7], [-65.0, -40.8],
      [-65.0, -43.3], [-67.5, -45.9], [-65.9, -47.7], [-69.2, -51.6], [-68.3, -54.8],
      [-71.0, -54.0], [-74.5, -52.5], [-75.5, -48.0], [-74.0, -43.0], [-73.2, -39.8],
      [-73.1, -36.8], [-71.6, -33.0], [-71.5, -29.9], [-70.4, -23.6], [-70.1, -20.2],
      [-71.3, -17.6], [-75.2, -15.4], [-77.0, -12.0], [-79.0, -8.1], [-81.3, -4.7],
      [-79.9, -2.2], [-80.7, -1.0], [-79.7, 1.0], [-78.8, 1.8], [-77.4, 3.9],
      [-77.5, 8.5]
    ]
  },
  // 5. Australia
  {
    name: 'Australia',
    baseColor: '#a87d52',
    coords: [
      [114.1, -21.8], [122.2, -18.0], [126.0, -14.0], [130.8, -12.4], [132.5, -11.5],
      [136.8, -12.2], [136.0, -14.8], [139.5, -17.5], [141.5, -15.5], [142.5, -10.7],
      [145.3, -15.5], [146.8, -19.2], [149.2, -21.1], [150.5, -23.3], [153.1, -26.6],
      [153.6, -28.6], [151.2, -33.9], [150.1, -37.0], [147.8, -37.9], [144.9, -37.8],
      [143.5, -38.8], [139.8, -37.2], [138.6, -34.9], [136.0, -34.8], [134.0, -32.8],
      [129.0, -31.7], [124.0, -33.0], [121.9, -33.9], [117.9, -35.0], [115.0, -34.3],
      [115.8, -32.0], [114.6, -28.8], [113.5, -25.5], [114.1, -21.8]
    ]
  },
  // 6. Greenland
  {
    name: 'Greenland',
    baseColor: '#dde7f0',
    coords: [
      [-43.9, 59.8], [-40.0, 65.0], [-25.0, 70.0], [-20.0, 75.0], [-18.0, 80.0],
      [-30.0, 83.5], [-50.0, 82.5], [-65.0, 80.0], [-72.0, 77.5], [-58.0, 75.0],
      [-55.0, 70.0], [-52.0, 65.0], [-48.0, 61.0], [-43.9, 59.8]
    ]
  },
  // 7. United Kingdom & Ireland
  {
    name: 'UnitedKingdom',
    baseColor: '#366840',
    coords: [
      [-5.7, 50.1], [-3.5, 50.4], [-1.1, 50.8], [1.4, 51.3], [1.7, 52.5],
      [0.1, 53.5], [-1.4, 55.0], [-3.2, 56.0], [-2.1, 57.1], [-3.1, 58.6],
      [-5.0, 58.6], [-5.8, 57.0], [-5.0, 54.7], [-3.0, 53.4], [-4.7, 52.8],
      [-5.2, 51.8], [-3.2, 51.5], [-5.7, 50.1]
    ]
  },
  {
    name: 'Ireland',
    baseColor: '#366840',
    coords: [
      [-9.8, 51.5], [-6.5, 52.2], [-6.1, 53.3], [-5.5, 54.6], [-7.5, 55.3],
      [-10.0, 54.0], [-10.3, 52.0], [-9.8, 51.5]
    ]
  },
  // 8. Madagascar
  {
    name: 'Madagascar',
    baseColor: '#486d42',
    coords: [
      [49.3, -12.0], [50.4, -15.3], [49.4, -18.1], [47.0, -25.0], [45.2, -25.6],
      [43.7, -23.3], [44.2, -20.0], [46.3, -15.7], [49.3, -12.0]
    ]
  },
  // 9. Sri Lanka
  {
    name: 'SriLanka',
    baseColor: '#35663b',
    coords: [
      [80.0, 9.8], [81.2, 8.6], [81.8, 7.4], [81.2, 6.1], [80.2, 6.0],
      [79.8, 6.9], [79.8, 8.2], [80.0, 9.8]
    ]
  },
  // 10. Japan (Honshu / Hokkaido / Kyushu)
  {
    name: 'JapanHonshu',
    baseColor: '#3b6842',
    coords: [
      [130.9, 34.0], [132.5, 34.4], [135.2, 34.6], [136.9, 35.1], [139.8, 35.6],
      [140.9, 35.8], [140.9, 38.3], [142.0, 39.6], [141.2, 41.4], [140.3, 41.1],
      [139.0, 37.9], [136.6, 36.6], [135.2, 35.6], [132.0, 35.0], [130.9, 34.0]
    ]
  },
  {
    name: 'JapanHokkaido',
    baseColor: '#3b6842',
    coords: [
      [140.5, 41.5], [143.2, 42.0], [145.6, 43.3], [141.9, 45.5], [140.3, 43.2], [140.5, 41.5]
    ]
  },
  // 11. Maritime Southeast Asia (Sumatra, Borneo, Java, Sulawesi, Philippines)
  {
    name: 'Sumatra',
    baseColor: '#2d5c38',
    coords: [
      [95.3, 5.6], [98.7, 3.6], [103.5, 1.0], [105.8, -5.9], [104.0, -5.5],
      [100.3, -1.0], [97.5, 2.0], [95.3, 5.6]
    ]
  },
  {
    name: 'Java',
    baseColor: '#2d5c38',
    coords: [
      [105.5, -6.1], [108.5, -6.5], [112.8, -7.2], [114.4, -8.2], [111.0, -8.2],
      [106.5, -7.4], [105.5, -6.1]
    ]
  },
  {
    name: 'Borneo',
    baseColor: '#2d5c38',
    coords: [
      [109.5, 2.0], [111.5, 3.2], [115.0, 5.0], [117.0, 7.0], [119.0, 5.0],
      [117.5, 1.0], [116.0, -3.5], [114.5, -4.0], [110.2, -3.0], [109.0, 0.0], [109.5, 2.0]
    ]
  },
  {
    name: 'NewGuinea',
    baseColor: '#2d5c38',
    coords: [
      [131.0, -1.0], [136.0, -2.0], [141.0, -2.6], [145.8, -5.2], [150.8, -10.5],
      [147.2, -9.5], [143.5, -8.0], [138.0, -8.2], [135.0, -4.5], [131.0, -1.0]
    ]
  },
  {
    name: 'Philippines',
    baseColor: '#366840',
    coords: [
      [120.5, 18.5], [122.2, 17.5], [121.0, 14.5], [124.0, 12.8], [126.2, 8.0],
      [125.4, 6.0], [122.0, 7.0], [122.5, 11.0], [120.0, 15.0], [120.5, 18.5]
    ]
  },
  // 12. New Zealand
  {
    name: 'NewZealandSouth',
    baseColor: '#3b6842',
    coords: [
      [172.7, -40.5], [174.2, -41.5], [172.7, -43.6], [170.5, -45.9], [167.4, -46.6],
      [166.5, -45.8], [169.0, -43.5], [171.5, -41.5], [172.7, -40.5]
    ]
  },
  {
    name: 'NewZealandNorth',
    baseColor: '#3b6842',
    coords: [
      [172.7, -34.4], [174.8, -36.8], [178.5, -37.7], [176.9, -39.5], [174.8, -41.3],
      [174.0, -39.3], [174.7, -37.5], [172.7, -34.4]
    ]
  },
  // 13. Antarctica
  {
    name: 'Antarctica',
    baseColor: '#e6eff6',
    coords: [
      [-180.0, -72.0], [-150.0, -75.0], [-120.0, -73.0], [-90.0, -72.0],
      [-65.0, -65.0], [-57.0, -63.5], [-60.0, -74.0], [-30.0, -76.0],
      [0.0, -70.0], [30.0, -69.0], [60.0, -67.5], [90.0, -66.5],
      [120.0, -66.5], [150.0, -68.0], [170.0, -72.0], [180.0, -78.0],
      [180.0, -90.0], [-180.0, -90.0], [-180.0, -72.0]
    ]
  }
];

function lngLatToCanvasXY(lng: number, lat: number, width: number, height: number): [number, number] {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}

export interface EarthTexturesBundle {
  dayMap: THREE.CanvasTexture;
  specularMap: THREE.CanvasTexture;
  cloudsMap: THREE.CanvasTexture;
}

let cachedTextures: EarthTexturesBundle | null = null;

/**
 * Generates high-resolution equirectangular Earth day texture, ocean specular map,
 * and cloud layer map. Cached in memory so re-mounts do not regenerate textures.
 */
export function getRealisticEarthTextures(): EarthTexturesBundle {
  if (cachedTextures) return cachedTextures;

  const width = 2048;
  const height = 1024;

  // 1. Day Map Canvas (Continents, Biomes, Mountain Reliefs, Bathymetry)
  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = width;
  dayCanvas.height = height;
  const ctx = dayCanvas.getContext('2d')!;

  // Base Deep Ocean Gradient (North Pole to Equator to South Pole)
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0.0, '#133154');
  oceanGrad.addColorStop(0.22, '#0d2b4e');
  oceanGrad.addColorStop(0.5, '#0f3966');
  oceanGrad.addColorStop(0.78, '#0d2b4e');
  oceanGrad.addColorStop(1.0, '#163558');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle Ocean Trench & Continental Shelf Bathymetry
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const poly of WORLD_LANDMASS_POLYGONS) {
    ctx.beginPath();
    poly.coords.forEach(([lng, lat], idx) => {
      const [x, y] = lngLatToCanvasXY(lng, lat, width, height);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    // Shallow continental shelf turquoise glow around coastlines
    ctx.strokeStyle = 'rgba(38, 114, 156, 0.45)';
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(54, 145, 182, 0.35)';
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  ctx.restore();

  // Draw Landmasses & Clip Biome Gradients Inside Continents
  for (const poly of WORLD_LANDMASS_POLYGONS) {
    ctx.save();
    ctx.beginPath();
    poly.coords.forEach(([lng, lat], idx) => {
      const [x, y] = lngLatToCanvasXY(lng, lat, width, height);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    // Base continent fill
    ctx.fillStyle = poly.baseColor;
    ctx.fill();

    // Clip inside landmass for realistic biome & terrain shading
    ctx.clip();

    if (poly.name !== 'Antarctica' && poly.name !== 'Greenland') {
      // Latitude-based vegetation bands (tropical green -> subtropical desert -> temperate forest -> tundra)
      const biomeGrad = ctx.createLinearGradient(0, 0, 0, height);
      biomeGrad.addColorStop(0.0, '#dce6ef'); // High Arctic snow
      biomeGrad.addColorStop(0.14, '#6a785c'); // Boreal tundra
      biomeGrad.addColorStop(0.24, '#365f3d'); // Northern temperate forest
      biomeGrad.addColorStop(0.35, '#8a7f56'); // Subtropical steppe
      biomeGrad.addColorStop(0.48, '#2d5c36'); // Equatorial rainforest
      biomeGrad.addColorStop(0.55, '#34633b'); // Southern tropics
      biomeGrad.addColorStop(0.68, '#7d734e'); // Southern dry belt
      biomeGrad.addColorStop(0.82, '#3d6342'); // Southern temperate
      biomeGrad.addColorStop(1.0, '#e6eff6');
      ctx.fillStyle = biomeGrad;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1.0;

      // Major World Deserts & Mountain Ranges (Radial Gradients in Geographic Space)
      const terrainRegions: Array<{
        lng: number;
        lat: number;
        rx: number;
        ry: number;
        colorInner: string;
        colorOuter: string;
      }> = [
        // Sahara Desert
        { lng: 12, lat: 23, rx: 190, ry: 75, colorInner: 'rgba(212, 179, 125, 0.88)', colorOuter: 'rgba(212, 179, 125, 0)' },
        // Arabian & Syrian Desert
        { lng: 45, lat: 24, rx: 95, ry: 65, colorInner: 'rgba(208, 173, 120, 0.85)', colorOuter: 'rgba(208, 173, 120, 0)' },
        // Thar Desert & NW India / Iranian Plateau
        { lng: 64, lat: 29, rx: 95, ry: 55, colorInner: 'rgba(194, 162, 112, 0.72)', colorOuter: 'rgba(194, 162, 112, 0)' },
        // Fertile Gangetic Plains & Western Ghats / Deccan Lush Green
        { lng: 79, lat: 21, rx: 85, ry: 75, colorInner: 'rgba(42, 98, 52, 0.82)', colorOuter: 'rgba(42, 98, 52, 0)' },
        // Himalayas & Tibetan Plateau (High Altitude Relief & Snow)
        { lng: 86, lat: 32, rx: 115, ry: 45, colorInner: 'rgba(225, 228, 232, 0.78)', colorOuter: 'rgba(135, 124, 108, 0)' },
        // Gobi & Taklamakan Desert
        { lng: 102, lat: 42, rx: 120, ry: 50, colorInner: 'rgba(189, 162, 118, 0.75)', colorOuter: 'rgba(189, 162, 118, 0)' },
        // Amazon Basin Lush Rainforest
        { lng: -62, lat: -5, rx: 110, ry: 85, colorInner: 'rgba(32, 86, 44, 0.85)', colorOuter: 'rgba(32, 86, 44, 0)' },
        // Congo Basin Rainforest
        { lng: 22, lat: 0, rx: 85, ry: 65, colorInner: 'rgba(36, 90, 46, 0.82)', colorOuter: 'rgba(36, 90, 46, 0)' },
        // Australian Outback
        { lng: 134, lat: -25, rx: 110, ry: 65, colorInner: 'rgba(196, 136, 86, 0.82)', colorOuter: 'rgba(196, 136, 86, 0)' },
        // North American Southwest / Rockies
        { lng: -112, lat: 36, rx: 85, ry: 65, colorInner: 'rgba(184, 152, 108, 0.72)', colorOuter: 'rgba(184, 152, 108, 0)' }
      ];

      for (const region of terrainRegions) {
        const [cx, cy] = lngLatToCanvasXY(region.lng, region.lat, width, height);
        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, region.rx);
        grad.addColorStop(0, region.colorInner);
        grad.addColorStop(1, region.colorOuter);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, region.rx, region.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle coastline definition
    ctx.strokeStyle = 'rgba(218, 206, 178, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  const dayMap = new THREE.CanvasTexture(dayCanvas);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.wrapS = THREE.RepeatWrapping;
  dayMap.wrapT = THREE.ClampToEdgeWrapping;
  dayMap.needsUpdate = true;

  // 2. Specular Map Canvas (Reflective Oceans = Light, Matte Continents = Dark)
  const specCanvas = document.createElement('canvas');
  specCanvas.width = 1024;
  specCanvas.height = 512;
  const specCtx = specCanvas.getContext('2d')!;
  specCtx.fillStyle = '#888888'; // Ocean specular shine
  specCtx.fillRect(0, 0, 1024, 512);
  specCtx.fillStyle = '#141414'; // Matte land
  for (const poly of WORLD_LANDMASS_POLYGONS) {
    specCtx.beginPath();
    poly.coords.forEach(([lng, lat], idx) => {
      const [x, y] = lngLatToCanvasXY(lng, lat, 1024, 512);
      if (idx === 0) specCtx.moveTo(x, y);
      else specCtx.lineTo(x, y);
    });
    specCtx.closePath();
    specCtx.fill();
  }
  const specularMap = new THREE.CanvasTexture(specCanvas);
  specularMap.wrapS = THREE.RepeatWrapping;
  specularMap.wrapT = THREE.ClampToEdgeWrapping;

  // 3. Atmospheric Cloud Layer Canvas
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 1024;
  cloudCanvas.height = 512;
  const cloudCtx = cloudCanvas.getContext('2d')!;
  cloudCtx.clearRect(0, 0, 1024, 512);

  // Deterministic pseudo-random atmospheric cloud wisps
  let seed = 42;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 240; i++) {
    const cx = nextRand() * 1024;
    // Concentrate clouds along equatorial ITCZ and mid-latitude storm tracks
    const bandChoice = nextRand();
    let latBand = (nextRand() - 0.5) * 150;
    if (bandChoice < 0.35) {
      latBand = (nextRand() - 0.5) * 28; // ITCZ
    } else if (bandChoice < 0.7) {
      latBand = (nextRand() > 0.5 ? 1 : -1) * (38 + nextRand() * 22);
    }
    const cy = ((90 - latBand) / 180) * 512;
    const rx = 22 + nextRand() * 68;
    const ry = 5 + nextRand() * 14;
    const alpha = 0.06 + nextRand() * 0.14;

    const cGrad = cloudCtx.createRadialGradient(cx, cy, 1, cx, cy, rx);
    cGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    cGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    cloudCtx.fillStyle = cGrad;
    cloudCtx.beginPath();
    cloudCtx.ellipse(cx, cy, rx, ry, (nextRand() - 0.5) * 0.4, 0, Math.PI * 2);
    cloudCtx.fill();
  }

  const cloudsMap = new THREE.CanvasTexture(cloudCanvas);
  cloudsMap.wrapS = THREE.RepeatWrapping;
  cloudsMap.wrapT = THREE.ClampToEdgeWrapping;

  cachedTextures = { dayMap, specularMap, cloudsMap };
  return cachedTextures;
}

