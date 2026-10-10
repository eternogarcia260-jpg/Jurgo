/**
 * TrackTextureFactory.ts - Procedural 2D Canvas & Texture Generation Engine
 * Generates photorealistic seamless PBR surface textures, normal maps, and botanical patterns
 * with organic fractal noise, zero artificial tiling lines, and calibrated anisotropic filtering.
 */

import * as THREE from 'three';

export class TrackTextureFactory {
  /**
   * Pre-generates photorealistic PBR turf textures (Albedo, Tangent-Space Normal Map, Roughness Map)
   * with organic multi-frequency Perlin fractal noise, rich chlorophyll depth, and humus soil undertones.
   */
  public static createRealisticGrassTextures(): {
    albedo: THREE.CanvasTexture;
    normal: THREE.CanvasTexture;
    roughness: THREE.CanvasTexture;
  } {
    const size = 1024;
    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext('2d')!;

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = size;
    normalCanvas.height = size;
    const nCtx = normalCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    // Seamless value noise permutation table
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      perm[i] = perm[i + 256] = Math.floor(Math.random() * 256);
    }
    const gradX = [-1, 1, 0, 0, 1, -1, 1, -1];
    const gradY = [0, 0, -1, 1, 1, 1, -1, -1];

    // Seamless periodic 2D noise
    const periodicNoise = (x: number, y: number, period: number): number => {
      const px = Math.floor(x) % period;
      const py = Math.floor(y) % period;
      const px1 = (px + 1) % period;
      const py1 = (py + 1) % period;

      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const u = xf * xf * (3.0 - 2.0 * xf);
      const v = yf * yf * (3.0 - 2.0 * yf);

      const g00 = perm[px + perm[py]] % 8;
      const g10 = perm[px1 + perm[py]] % 8;
      const g01 = perm[px + perm[py1]] % 8;
      const g11 = perm[px1 + perm[py1]] % 8;

      const d00 = gradX[g00] * xf + gradY[g00] * yf;
      const d10 = gradX[g10] * (xf - 1) + gradY[g10] * yf;
      const d01 = gradX[g01] * xf + gradY[g01] * (yf - 1);
      const d11 = gradX[g11] * (xf - 1) + gradY[g11] * (yf - 1);

      const x1 = d00 * (1 - u) + d10 * u;
      const x2 = d01 * (1 - u) + d11 * u;
      return x1 * (1 - v) + x2 * v;
    };

    const heightField = new Float32Array(size * size);
    const albedoImg = aCtx.createImageData(size, size);
    const roughImg = rCtx.createImageData(size, size);
    const ad = albedoImg.data;
    const rd = roughImg.data;

    for (let y = 0; y < size; y++) {
      const ny = y / size;
      for (let x = 0; x < size; x++) {
        const nx = x / size;

        // Octave 1: Macro meadow biome patches (Period = 4)
        const macro = periodicNoise(nx * 4, ny * 4, 4);
        // Octave 2: Turf sod clumping and soil moisture (Period = 16)
        const meso = periodicNoise(nx * 16, ny * 16, 16);
        // Octave 3: High-frequency blade and micro-clover density (Period = 64)
        const micro = periodicNoise(nx * 64, ny * 64, 64);

        const h = macro * 0.38 + meso * 0.38 + micro * 0.24;
        heightField[y * size + x] = h;

        const normH = Math.min(1.0, Math.max(0.0, (h + 0.85) / 1.7));
        const macroFactor = Math.min(1.0, Math.max(0.0, (macro + 0.85) / 1.7));

        // Authentic European Grade-1 competition turf palette (Spa-Francorchamps / Red Bull Ring)
        let r = 12 + normH * 16 + macroFactor * 10;
        let g = 22 + normH * 34 + macroFactor * 14;
        let b = 10 + normH * 14 + macroFactor * 4;

        // Fine blade jitter and earthy soil flecks
        const jitter = (Math.random() - 0.5) * 8;
        const isGoldenTip = Math.random() > 0.94 ? 8 : 0;

        r = Math.min(255, Math.max(0, Math.floor(r + jitter + isGoldenTip * 0.5)));
        g = Math.min(255, Math.max(0, Math.floor(g + jitter + isGoldenTip * 0.9)));
        b = Math.min(255, Math.max(0, Math.floor(b + jitter * 0.4)));

        const idx = (y * size + x) * 4;
        ad[idx] = r;
        ad[idx + 1] = g;
        ad[idx + 2] = b;
        ad[idx + 3] = 255;

        // Roughness: 0.80 (velvety cut turf) to 0.92 (porous soil)
        const roughVal = Math.floor((0.80 + (1.0 - normH) * 0.12 + (Math.random() - 0.5) * 0.03) * 255);
        rd[idx] = roughVal;
        rd[idx + 1] = roughVal;
        rd[idx + 2] = roughVal;
        rd[idx + 3] = 255;
      }
    }

    aCtx.putImageData(albedoImg, 0, 0);
    rCtx.putImageData(roughImg, 0, 0);

    // Tangent-Space Normal Map via Sobel operator on heightField
    const normalImg = nCtx.createImageData(size, size);
    const nd = normalImg.data;
    const normalStrength = 3.6;

    for (let y = 0; y < size; y++) {
      const yPrev = (y - 1 + size) % size;
      const yNext = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xPrev = (x - 1 + size) % size;
        const xNext = (x + 1) % size;

        const hL = heightField[y * size + xPrev];
        const hR = heightField[y * size + xNext];
        const hU = heightField[yPrev * size + x];
        const hD = heightField[yNext * size + x];

        const dx = (hR - hL) * normalStrength;
        const dy = (hD - hU) * normalStrength;
        const len = Math.sqrt(dx * dx + dy * dy + 1.0);

        const nx = -dx / len;
        const ny = -dy / len;
        const nz = 1.0 / len;

        const idx = (y * size + x) * 4;
        nd[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        nd[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        nd[idx + 2] = Math.floor(nz * 255);
        nd[idx + 3] = 255;
      }
    }
    nCtx.putImageData(normalImg, 0, 0);

    const albedoTex = new THREE.CanvasTexture(albedoCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.repeat.set(48, 48);
    albedoTex.anisotropy = 16;
    albedoTex.generateMipmaps = true;
    albedoTex.minFilter = THREE.LinearMipmapLinearFilter;
    albedoTex.magFilter = THREE.LinearFilter;

    const normalTex = new THREE.CanvasTexture(normalCanvas);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(48, 48);
    normalTex.anisotropy = 16;
    normalTex.generateMipmaps = true;

    const roughTex = new THREE.CanvasTexture(roughCanvas);
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.RepeatWrapping;
    roughTex.repeat.set(48, 48);
    roughTex.anisotropy = 16;
    roughTex.generateMipmaps = true;

    return { albedo: albedoTex, normal: normalTex, roughness: roughTex };
  }

  /**
   * Generates procedural tactile organic tree bark texture with vertical striations,
   * natural fissures, and multi-tone weathered grain.
   */
  public static createProceduralBarkTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base deep umber heartwood
    ctx.fillStyle = '#22140c';
    ctx.fillRect(0, 0, 512, 512);

    // Primary vertical wood grain striations with organic wobble
    for (let x = 0; x < 512; x += 3) {
      const wobble = Math.sin(x * 0.12) * 12 + Math.cos(x * 0.04) * 8;
      const shade = 26 + Math.floor(wobble + Math.random() * 22);
      ctx.fillStyle = `rgb(${shade + 26}, ${shade + 12}, ${shade + 2})`;
      ctx.fillRect(x, 0, 2 + (x % 3), 512);
    }

    // Secondary vertical fissure clefts (dark fissures)
    for (let i = 0; i < 480; i++) {
      const fx = Math.random() * 512;
      const fy = Math.random() * 512;
      const flen = 30 + Math.random() * 85;
      const fwidth = 2 + Math.random() * 3.5;
      ctx.fillStyle = Math.random() > 0.4 ? '#120905' : '#3f281b';
      ctx.fillRect(fx, fy, fwidth, flen);
    }

    // Lichen and weathered bark accents
    ctx.fillStyle = 'rgba(78, 88, 58, 0.35)';
    for (let i = 0; i < 45; i++) {
      const lx = Math.random() * 512;
      const ly = Math.random() * 512;
      ctx.beginPath();
      ctx.arc(lx, ly, 4 + Math.random() * 9, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural normal map for bark giving real 3D fissure depth under sunlight
   */
  public static createProceduralBarkNormalTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;

    const heights = new Float32Array(256 * 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const furrow = Math.sin(x * 0.18 + Math.cos(y * 0.06) * 1.5) * 0.5 + 0.5;
        const grain = Math.sin(x * 0.75) * 0.2;
        heights[y * 256 + x] = furrow * 0.8 + grain;
      }
    }

    const strength = 2.2;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const x0 = (x - 1 + 256) % 256;
        const x1 = (x + 1) % 256;
        const y0 = (y - 1 + 256) % 256;
        const y1 = (y + 1) % 256;
        const dx = (heights[y * 256 + x1] - heights[y * 256 + x0]) * strength;
        const dy = (heights[y1 * 256 + x] - heights[y0 * 256 + x]) * strength;
        const len = Math.hypot(dx, dy, 1.0);
        const nx = (-dx / len) * 0.5 + 0.5;
        const ny = (-dy / len) * 0.5 + 0.5;
        const nz = (1.0 / len) * 0.5 + 0.5;
        const idx = (y * 256 + x) * 4;
        data[idx] = Math.round(nx * 255);
        data[idx + 1] = Math.round(ny * 255);
        data[idx + 2] = Math.round(nz * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural botanical pine needle cluster texture with radiating needle sprays
   */
  public static createProceduralPineNeedleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base dense chlorophyll green
    ctx.fillStyle = '#0c2211';
    ctx.fillRect(0, 0, 512, 512);

    // Overlapping needle fascicle sprays
    for (let i = 0; i < 2400; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const baseAng = Math.random() * Math.PI * 2;
      const needleCount = 4 + Math.floor(Math.random() * 5);
      const sprayLength = 10 + Math.random() * 14;

      for (let n = 0; n < needleCount; n++) {
        const ang = baseAng + (n - needleCount / 2) * 0.14;
        const ex = cx + Math.cos(ang) * sprayLength;
        const ey = cy + Math.sin(ang) * sprayLength;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);

        const r = Math.random();
        ctx.strokeStyle = r > 0.65 ? '#2d5e2e' : (r > 0.3 ? '#19421c' : '#0a1d0e');
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Micro needle tip highlights
    for (let i = 0; i < 1800; i++) {
      const tx = Math.random() * 512;
      const ty = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? '#3a7238' : '#1e4820';
      ctx.fillRect(tx, ty, 1.5, 1.5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural deciduous leaf cluster texture with organic leaf margins and veins
   */
  public static createProceduralDeciduousFoliageTexture(baseColorHex: string, tipColorHex: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = baseColorHex;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 3200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const rad = 4 + Math.random() * 8.0;
      const aspect = 0.65 + Math.random() * 0.5;
      const rot = Math.random() * Math.PI * 2;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1.0, aspect);

      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      const r = Math.random();
      ctx.fillStyle = r > 0.55 ? tipColorHex : (r > 0.25 ? baseColorHex : '#091c0c');
      ctx.fill();

      // Subtle center vein
      ctx.strokeStyle = 'rgba(18, 48, 20, 0.45)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-rad * 0.8, 0);
      ctx.lineTo(rad * 0.8, 0);
      ctx.stroke();

      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural cypress foliage texture with dense scaly vertical sprigs
   */
  public static createProceduralCypressFoliageTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#081a0b';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const len = 6 + Math.random() * 12;
      const r = Math.random();
      ctx.fillStyle = r > 0.6 ? '#1b401d' : (r > 0.25 ? '#102a12' : '#051107');
      ctx.fillRect(x, y, 2, len);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural normal map for foliage to scatter sunlight micro-speculars
   */
  public static createProceduralFoliageNormalTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;

    const heights = new Float32Array(256 * 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const noise = Math.sin(x * 0.32) * Math.cos(y * 0.32) + Math.sin(x * 0.64 + y * 0.48) * 0.5;
        heights[y * 256 + x] = noise;
      }
    }

    const strength = 1.4;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const x0 = (x - 1 + 256) % 256;
        const x1 = (x + 1) % 256;
        const y0 = (y - 1 + 256) % 256;
        const y1 = (y + 1) % 256;
        const dx = (heights[y * 256 + x1] - heights[y * 256 + x0]) * strength;
        const dy = (heights[y1 * 256 + x] - heights[y0 * 256 + x]) * strength;
        const len = Math.hypot(dx, dy, 1.0);
        const nx = (-dx / len) * 0.5 + 0.5;
        const ny = (-dy / len) * 0.5 + 0.5;
        const nz = (1.0 / len) * 0.5 + 0.5;
        const idx = (y * 256 + x) * 4;
        data[idx] = Math.round(nx * 255);
        data[idx + 1] = Math.round(ny * 255);
        data[idx + 2] = Math.round(nz * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates rich, dense volumetric 3D grass clump cutout texture
   */
  public static createGrassTuftTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 512);

    const blades = 36;
    for (let b = 0; b < blades; b++) {
      const t = b / (blades - 1);
      const startX = 256 + (t - 0.5) * 110;
      const startY = 512;
      const bladeW = 12 + Math.random() * 14;

      const spreadX = (t - 0.5) * 400 + (Math.random() - 0.5) * 60;
      const tipX = 256 + spreadX;
      const tipY = 40 + Math.random() * 150;
      const ctrlX = (startX + tipX) * 0.5 + (t - 0.5) * 90 + (Math.random() - 0.5) * 35;
      const ctrlY = 220 + Math.random() * 80;

      ctx.beginPath();
      ctx.moveTo(startX - bladeW * 0.5, startY);
      ctx.quadraticCurveTo(ctrlX - bladeW * 0.3, ctrlY, tipX, tipY);
      ctx.quadraticCurveTo(ctrlX + bladeW * 0.3, ctrlY, startX + bladeW * 0.5, startY);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 512, 0, tipY);
      grad.addColorStop(0, '#0a1a0c');
      grad.addColorStop(0.35, '#163618');
      grad.addColorStop(0.75, '#285826');
      grad.addColorStop(1.0, '#3e7638');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.strokeStyle = '#488440';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Helper to create ultra-lightweight soft diffused contact shadow for curved arches.
   */
  public static createCurvedArchSoftShadow(
    width: number,
    length: number,
    opacity = 0.45
  ): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(128, 256, 20, 128, 256, 240);
    grad.addColorStop(0.0, `rgba(0, 0, 0, ${opacity * 0.85})`);
    grad.addColorStop(0.35, `rgba(0, 0, 0, ${opacity * 0.5})`);
    grad.addColorStop(0.75, `rgba(0, 0, 0, ${opacity * 0.15})`);
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(width, length);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.016;
    mesh.renderOrder = 1;
    return mesh;
  }
}
