/**
 * CarLiveryFactory.ts - Procedural 2K/4K Canvas Livery, Sponsor Decals & Tire Textures
 * Generates vector team liveries (Red Bull Midnight Blue, Ferrari Corsa, Mercedes Silver, etc.),
 * Pirelli P-Zero tire sidewalls with dynamic compound rings, speed radial blur discs,
 * and high-resolution metallic flake & carbon fiber normal maps.
 */

import * as THREE from 'three';
import { TeamLiveryConfig } from '../../career/CareerTypes';

export class CarLiveryFactory {
  // Shared GPU texture caches to eliminate VRAM duplication and allocation spikes
  public static sidewallTextureCache: Map<string, THREE.CanvasTexture> = new Map();
  public static radialBlurTextureCache: Map<string, THREE.CanvasTexture> = new Map();
  public static sharedTreadNormalTexture?: THREE.CanvasTexture;
  public static sharedMetallicFlakeTexture?: THREE.CanvasTexture;
  public static sharedCarbonWeaveTexture?: THREE.CanvasTexture;

  public static clearTireTextureCache(): void {
    CarLiveryFactory.sidewallTextureCache.forEach((tex) => tex.dispose());
    CarLiveryFactory.sidewallTextureCache.clear();
    CarLiveryFactory.radialBlurTextureCache.forEach((tex) => tex.dispose());
    CarLiveryFactory.radialBlurTextureCache.clear();
    if (CarLiveryFactory.sharedTreadNormalTexture) {
      CarLiveryFactory.sharedTreadNormalTexture.dispose();
      CarLiveryFactory.sharedTreadNormalTexture = undefined;
    }
    if (CarLiveryFactory.sharedMetallicFlakeTexture) {
      CarLiveryFactory.sharedMetallicFlakeTexture.dispose();
      CarLiveryFactory.sharedMetallicFlakeTexture = undefined;
    }
    if (CarLiveryFactory.sharedCarbonWeaveTexture) {
      CarLiveryFactory.sharedCarbonWeaveTexture.dispose();
      CarLiveryFactory.sharedCarbonWeaveTexture = undefined;
    }
  }

  public static drawOutlinedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fillColor: string,
    strokeColor: string = '#000000',
    strokeWidth: number = 0
  ): void {
    ctx.save();
    if (strokeWidth > 0 && strokeColor !== fillColor) {
      ctx.lineWidth = Math.min(0.75, strokeWidth * 0.05);
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = fillColor;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  public static drawChargingBull(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number = 1.0,
    withSun: boolean = true,
    facingLeft: boolean = false
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    if (facingLeft) ctx.scale(-1, 1);
    ctx.scale(scale, scale);

    if (withSun) {
      const sunGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 92);
      sunGrad.addColorStop(0, '#fffbeb');
      sunGrad.addColorStop(0.35, '#fef08a');
      sunGrad.addColorStop(0.70, '#facc15');
      sunGrad.addColorStop(1.0, '#eab308');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 86, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#cc0022';
    ctx.beginPath();
    ctx.moveTo(-115, -12);
    ctx.quadraticCurveTo(-90, -48, -52, -36);
    ctx.lineTo(-42, -26);
    ctx.bezierCurveTo(-22, -68, 22, -78, 48, -52);
    ctx.lineTo(68, -46);
    ctx.lineTo(88, -58);
    ctx.quadraticCurveTo(122, -92, 132, -74);
    ctx.quadraticCurveTo(98, -62, 82, -36);
    ctx.lineTo(98, -14);
    ctx.lineTo(76, 2);
    ctx.lineTo(62, -8);
    ctx.lineTo(56, 36);
    ctx.lineTo(42, 36);
    ctx.lineTo(44, 6);
    ctx.lineTo(26, 42);
    ctx.lineTo(14, 42);
    ctx.lineTo(22, -4);
    ctx.bezierCurveTo(2, 12, -24, 14, -46, 2);
    ctx.lineTo(-66, 48);
    ctx.lineTo(-80, 48);
    ctx.lineTo(-66, -4);
    ctx.lineTo(-92, 36);
    ctx.lineTo(-104, 36);
    ctx.lineTo(-86, -14);
    ctx.closePath();
    ctx.fill();

    const hornGrad = ctx.createLinearGradient(88, -58, 132, -74);
    hornGrad.addColorStop(0, '#fef08a');
    hornGrad.addColorStop(1, '#eab308');
    ctx.fillStyle = hornGrad;
    ctx.beginPath();
    ctx.moveTo(88, -58);
    ctx.quadraticCurveTo(122, -92, 132, -74);
    ctx.quadraticCurveTo(98, -62, 82, -36);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(76, -26, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  public static createLiveryTexture(cfg: TeamLiveryConfig): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;

    // 1. Base Layer
    ctx.fillStyle = cfg.primaryColor || '#040814';
    ctx.fillRect(0, 0, 2048, 2048);

    const flankGrad = ctx.createLinearGradient(0, 0, 2048, 0);
    flankGrad.addColorStop(0.0, 'rgba(0,0,0,0.65)');
    flankGrad.addColorStop(0.18, 'rgba(0,0,0,0.12)');
    flankGrad.addColorStop(0.25, 'rgba(12,24,48,0.30)');
    flankGrad.addColorStop(0.35, 'rgba(0,0,0,0.12)');
    flankGrad.addColorStop(0.50, 'rgba(0,0,0,0.50)');
    flankGrad.addColorStop(0.75, 'rgba(0,0,0,0.95)');
    flankGrad.addColorStop(1.0, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = flankGrad;
    ctx.fillRect(0, 0, 2048, 2048);

    // 2. Micro Carbon Fiber Weave Texture on Floor & Skirt
    ctx.fillStyle = 'rgba(5,7,10,0.98)';
    ctx.fillRect(0, 1650, 2048, 398);
    ctx.fillRect(0, 0, 2048, 120);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2048; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 1650);
      ctx.lineTo(i + 300, 2048);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - 150, 120);
      ctx.stroke();
    }

    // 3. Dynamic Flank Chevrons
    ctx.fillStyle = cfg.secondaryColor || '#cc0022';
    ctx.beginPath();
    ctx.moveTo(512, 190);
    ctx.lineTo(630, 620);
    ctx.lineTo(650, 1800);
    ctx.lineTo(374, 1800);
    ctx.lineTo(394, 620);
    ctx.closePath();
    ctx.fill();

    // Accent Pinstripes
    ctx.fillStyle = cfg.accentColor || '#fec008';
    ctx.fillRect(504, 160, 16, 1750);
    ctx.fillRect(424, 280, 8, 1500);
    ctx.fillRect(592, 280, 8, 1500);

    // Aerodynamic cooling gills
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    for (let l = 0; l < 9; l++) {
      const ly = 960 + l * 28;
      ctx.fillRect(350, ly, 75, 8);
      ctx.fillRect(623, ly, 75, 8);
    }

    // Halftone Speed Dots Matrix
    ctx.fillStyle = cfg.accentColor || '#fec008';
    for (let row = 0; row < 12; row++) {
      const dotY = 700 + row * 45;
      const radius = 9 - row * 0.65;
      if (radius > 0) {
        ctx.beginPath();
        ctx.arc(370 - row * 10, dotY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(654 + row * 10, dotY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Top Spine Graphics
    ctx.save();
    ctx.fillStyle = '#fec008';
    ctx.beginPath();
    ctx.moveTo(430, 120);
    ctx.lineTo(594, 120);
    ctx.lineTo(570, 240);
    ctx.lineTo(512, 260);
    ctx.lineTo(454, 240);
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 20px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    this.drawOutlinedText(ctx, '▲ TOW HOOK', 512, 170, '#cc0022', '#000000', 0);
    ctx.restore();

    this.drawChargingBull(ctx, 435, 310, 0.42, true, false);
    this.drawChargingBull(ctx, 589, 310, 0.42, true, true);

    ctx.save();
    ctx.translate(512, 425);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-120, -75, 240, 150, 22);
    ctx.fill();

    const dNum = cfg.driverNumber ? (cfg.driverNumber.length === 1 ? '0' + cfg.driverNumber : cfg.driverNumber) : '01';
    ctx.font = '900 110px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cc0022';
    ctx.fillText(dNum, 0, 5);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#040814';
    ctx.fillText((cfg.driverName || cfg.teamName || 'APEX').toUpperCase(), 0, -52);
    ctx.restore();

    // Technical sponsors on top of cockpit
    const topSponsors = [
      { text: 'PIRELLI', y: 550, size: 28, color: '#fec008' },
      { text: 'HONDA e:TECHNOLOGY', y: 620, size: 26, color: '#ffffff' },
      { text: 'TAG HEUER', y: 680, size: 24, color: '#10b981' },
      { text: 'ORACLE CLOUD', y: 740, size: 30, color: '#cc0022' },
      { text: 'MOBIL 1', y: 800, size: 28, color: '#38bdf8' },
    ];
    topSponsors.forEach((sp) => {
      ctx.font = `bold ${sp.size}px "Chakra Petch", sans-serif`;
      ctx.textAlign = 'center';
      this.drawOutlinedText(ctx, sp.text, 512, sp.y, sp.color, '#000000', 0);
    });

    // Airbox Red Bull Emblem
    ctx.save();
    ctx.translate(512, 940);
    this.drawChargingBull(ctx, 0, -10, 0.95, false, false);
    ctx.font = '900 48px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    this.drawOutlinedText(ctx, 'RED BULL', 0, 55, '#ffffff', '#cc0022', 0);
    ctx.font = 'bold 24px sans-serif';
    this.drawOutlinedText(ctx, 'RACING', 0, 85, '#fec008', '#000000', 0);
    ctx.restore();

    // Flank Sidepod Graphics (Left & Right)
    const drawFlankGraphics = (centerX: number, isRight: boolean) => {
      ctx.save();
      ctx.translate(centerX, 1200);
      if (isRight) ctx.scale(-1, 1);

      this.drawChargingBull(ctx, -80, -200, 1.35, true, false);

      ctx.font = '900 92px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      this.drawOutlinedText(ctx, 'Red Bull', 60, -80, '#cc0022', '#ffffff', 0);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-240, 0, 480, 120, 16);
      ctx.fill();

      ctx.font = '900 76px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#cc0022';
      ctx.fillText('ORACLE', 0, 80);

      const flankSponsors = [
        { text: 'HONDA', y: 190, size: 48, color: '#ffffff' },
        { text: 'MOBIL 1', y: 250, size: 40, color: '#38bdf8' },
        { text: 'BYBIT · CRYPTO', y: 300, size: 30, color: '#fec008' },
        { text: 'SIEMENS PLM', y: 345, size: 26, color: '#10b981' },
        { text: 'HEINEKEN 0.0', y: 385, size: 24, color: '#ffffff' },
        { text: 'RAUCH · PUMA', y: 420, size: 22, color: '#facc15' },
      ];
      flankSponsors.forEach((sp) => {
        ctx.font = `bold ${sp.size}px "Chakra Petch", sans-serif`;
        ctx.textAlign = 'center';
        this.drawOutlinedText(ctx, sp.text, 0, sp.y, sp.color, '#000000', 0);
      });

      ctx.restore();
    };

    drawFlankGraphics(1536, false);
    drawFlankGraphics(1024, true);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  public static createRearWingDecalTexture(cfg: TeamLiveryConfig): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, 2048, 256);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 2048; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 256);
      ctx.stroke();
    }

    ctx.fillStyle = cfg.secondaryColor || '#cc0022';
    ctx.fillRect(0, 0, 2048, 12);
    ctx.fillRect(0, 244, 2048, 12);

    ctx.fillStyle = cfg.accentColor || '#fec008';
    ctx.fillRect(0, 12, 2048, 6);
    ctx.fillRect(0, 238, 2048, 6);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(512, 38, 1024, 180, 20);
    ctx.fill();

    ctx.font = '900 130px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cc0022';
    ctx.fillText('HONDA', 1024, 134);

    ctx.font = 'bold 36px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('HRC · HYBRID', 256, 128);
    ctx.fillText('MOBIL 1', 1792, 128);

    this.drawChargingBull(ctx, 420, 128, 0.42, true, false);
    this.drawChargingBull(ctx, 1628, 128, 0.42, true, true);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  public static createSharkFinDecalTexture(cfg: TeamLiveryConfig): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = cfg.primaryColor || '#040814';
    ctx.fillRect(0, 0, 1024, 512);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 1024; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 512);
      ctx.stroke();
    }

    ctx.fillStyle = cfg.secondaryColor || '#cc0022';
    ctx.beginPath();
    ctx.moveTo(0, 500);
    ctx.lineTo(1024, 80);
    ctx.lineTo(1024, 160);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = cfg.accentColor || '#fec008';
    ctx.beginPath();
    ctx.moveTo(0, 480);
    ctx.lineTo(1024, 60);
    ctx.lineTo(1024, 80);
    ctx.lineTo(0, 500);
    ctx.closePath();
    ctx.fill();

    this.drawChargingBull(ctx, 420, 240, 1.25, true, false);

    ctx.font = '900 86px "Chakra Petch", sans-serif';
    ctx.textAlign = 'left';
    this.drawOutlinedText(ctx, 'Red Bull', 380, 270, '#ffffff', '#cc0022', 0);

    ctx.font = 'bold 36px "Chakra Petch", sans-serif';
    this.drawOutlinedText(ctx, 'RACING', 385, 320, '#fec008', '#000000', 0);

    const dNum = cfg.driverNumber ? (cfg.driverNumber.length === 1 ? '0' + cfg.driverNumber : cfg.driverNumber) : '01';
    ctx.font = '900 130px "Chakra Petch", monospace';
    ctx.textAlign = 'right';
    this.drawOutlinedText(ctx, dNum, 960, 240, '#fec008', '#cc0022', 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  public static createHaloDecalTexture(cfg: TeamLiveryConfig): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1c202a';
    ctx.fillRect(0, 0, 1024, 128);

    ctx.fillStyle = cfg.accentColor || '#fec008';
    ctx.fillRect(0, 0, 1024, 8);
    ctx.fillRect(0, 120, 1024, 8);

    ctx.font = '900 48px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.drawOutlinedText(ctx, 'TAG HEUER  ·  ORACLE  ·  MOBIL 1', 512, 64, '#ffffff', '#000000', 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  public static createEndplateDecalTexture(cfg: TeamLiveryConfig): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 512; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 512);
      ctx.stroke();
    }

    ctx.fillStyle = cfg.secondaryColor || '#cc0022';
    ctx.fillRect(0, 0, 16, 512);
    ctx.fillRect(496, 0, 16, 512);

    ctx.fillStyle = cfg.accentColor || '#fec008';
    ctx.fillRect(16, 0, 8, 512);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(48, 60, 416, 120, 14);
    ctx.fill();

    ctx.font = '900 68px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cc0022';
    ctx.fillText('MOBIL 1', 256, 120);

    ctx.font = 'bold 36px "Chakra Petch", sans-serif';
    this.drawOutlinedText(ctx, 'PIRELLI', 256, 240, '#fec008', '#000000', 0);

    ctx.font = 'bold 32px "Chakra Petch", sans-serif';
    this.drawOutlinedText(ctx, 'HONDA e:', 256, 310, '#ffffff', '#000000', 0);

    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    this.drawOutlinedText(ctx, 'BYBIT', 256, 380, '#38bdf8', '#000000', 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  public static createFrontWingFlapTexture(cfg: TeamLiveryConfig): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 1024; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 256);
      ctx.stroke();
    }

    ctx.fillStyle = cfg.secondaryColor || '#cc0022';
    ctx.fillRect(0, 0, 1024, 14);
    ctx.fillRect(0, 242, 1024, 14);

    ctx.fillStyle = cfg.accentColor || '#fec008';
    ctx.fillRect(0, 14, 1024, 6);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(180, 48, 664, 160, 16);
    ctx.fill();

    ctx.font = '900 92px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cc0022';
    ctx.fillText('ORACLE', 512, 130);

    this.drawChargingBull(ctx, 100, 130, 0.38, true, false);
    this.drawChargingBull(ctx, 920, 130, 0.38, true, false);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  public static createWheelRadialBlurTexture(compoundColor: string): THREE.CanvasTexture {
    if (this.radialBlurTextureCache.has(compoundColor)) {
      return this.radialBlurTextureCache.get(compoundColor)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 512);

    const rimR = 145;
    const tireInnerR = 140;
    const tireOuterR = 240;

    // Rim Hub Gradient
    const rimGrad = ctx.createRadialGradient(256, 256, 15, 256, 256, rimR);
    rimGrad.addColorStop(0.0, 'rgba(215, 222, 232, 0.95)');
    rimGrad.addColorStop(0.12, 'rgba(85, 95, 110, 0.90)');
    rimGrad.addColorStop(0.35, 'rgba(32, 38, 48, 0.85)');
    rimGrad.addColorStop(0.70, 'rgba(48, 55, 68, 0.88)');
    rimGrad.addColorStop(0.92, 'rgba(24, 28, 36, 0.92)');
    rimGrad.addColorStop(1.0, 'rgba(12, 14, 18, 0.95)');

    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(256, 256, rimR, 0, Math.PI * 2);
    ctx.fill();

    // Spoke Motion Blur Streaks
    const numStreaks = 48;
    for (let s = 0; s < numStreaks; s++) {
      const startAngle = (s / numStreaks) * Math.PI * 2;
      const arcLen = (Math.PI * 2 / numStreaks) * 1.8;
      const alpha = 0.08 + (Math.sin(s * 1.3) * 0.5 + 0.5) * 0.12;

      ctx.save();
      ctx.beginPath();
      ctx.arc(256, 256, 75 + (s % 5) * 14, startAngle, startAngle + arcLen);
      ctx.lineWidth = 14 + (s % 3) * 6;
      ctx.strokeStyle = `rgba(180, 195, 215, ${alpha})`;
      ctx.stroke();
      ctx.restore();
    }

    // Tire Sidewall
    const tireGrad = ctx.createRadialGradient(256, 256, tireInnerR, 256, 256, tireOuterR);
    tireGrad.addColorStop(0.0, 'rgba(22, 24, 28, 0.96)');
    tireGrad.addColorStop(0.4, 'rgba(28, 30, 35, 0.98)');
    tireGrad.addColorStop(0.85, 'rgba(20, 22, 26, 0.99)');
    tireGrad.addColorStop(1.0, 'rgba(15, 16, 18, 1.0)');

    ctx.beginPath();
    ctx.arc(256, 256, tireOuterR, 0, Math.PI * 2);
    ctx.arc(256, 256, tireInnerR, 0, Math.PI * 2, true);
    ctx.fillStyle = tireGrad;
    ctx.fill();

    // Compound Stripe Blurred Ring
    const stripeR = 195;
    ctx.save();
    ctx.beginPath();
    ctx.arc(256, 256, stripeR, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = compoundColor;
    ctx.shadowColor = compoundColor;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();

    // Soft Edge Antialiasing Feather
    const edgeGrad = ctx.createRadialGradient(256, 256, tireOuterR - 6, 256, 256, tireOuterR);
    edgeGrad.addColorStop(0.0, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(1.0, 'rgba(0,0,0,0.65)');
    ctx.beginPath();
    ctx.arc(256, 256, tireOuterR, 0, Math.PI * 2);
    ctx.arc(256, 256, tireOuterR - 6, 0, Math.PI * 2, true);
    ctx.fillStyle = edgeGrad;
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    this.radialBlurTextureCache.set(compoundColor, tex);
    return tex;
  }

  public static getTreadNormalTexture(): THREE.CanvasTexture {
    if (this.sharedTreadNormalTexture) return this.sharedTreadNormalTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 512, 512);

    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;

    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const microNoise = (Math.sin(x * 1.5) * Math.cos(y * 1.5) + Math.sin(x * 0.4 + y * 0.4)) * 0.5;
        const nx = 128 + microNoise * 14;
        const ny = 128 + microNoise * 14;
        const nz = 250;

        data[idx] = Math.max(0, Math.min(255, nx));
        data[idx + 1] = Math.max(0, Math.min(255, ny));
        data[idx + 2] = Math.max(0, Math.min(255, nz));
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 2);
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    this.sharedTreadNormalTexture = tex;
    return tex;
  }

  public static getMetallicFlakeTexture(): THREE.CanvasTexture {
    if (this.sharedMetallicFlakeTexture) return this.sharedMetallicFlakeTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 256, 256);

    const imgData = ctx.getImageData(0, 0, 256, 256);
    const data = imgData.data;

    for (let i = 0; i < 256 * 256; i++) {
      const idx = i * 4;
      const angle = Math.random() * Math.PI * 2;
      const tilt = Math.random() * 0.18;
      const nx = 128 + Math.cos(angle) * tilt * 127;
      const ny = 128 + Math.sin(angle) * tilt * 127;
      const nz = 255 - tilt * 30;

      data[idx] = nx;
      data[idx + 1] = ny;
      data[idx + 2] = nz;
      data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(32, 32);
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    this.sharedMetallicFlakeTexture = tex;
    return tex;
  }

  public static createTireSidewallTexture(compoundColor: string): THREE.CanvasTexture {
    if (this.sidewallTextureCache.has(compoundColor)) {
      return this.sidewallTextureCache.get(compoundColor)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1c1f24';
    ctx.fillRect(0, 0, 1024, 1024);

    const bgGrad = ctx.createRadialGradient(512, 512, 280, 512, 512, 500);
    bgGrad.addColorStop(0.0, '#1c1f24');
    bgGrad.addColorStop(0.5, '#252930');
    bgGrad.addColorStop(0.85, '#181b20');
    bgGrad.addColorStop(1.0, '#121418');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(512, 512, 512, 0, Math.PI * 2);
    ctx.fill();

    const drawCompoundStripe = (r: number, width: number) => {
      ctx.beginPath();
      ctx.arc(512, 512, r, 0, Math.PI * 2);
      ctx.strokeStyle = compoundColor;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    drawCompoundStripe(430, 24);
    drawCompoundStripe(370, 7);

    const drawCircularText = (text: string, radius: number, startAngle: number, letterSpacing = 0.045) => {
      ctx.save();
      ctx.translate(512, 512);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const totalAngle = text.length * letterSpacing;
      let curAngle = startAngle - totalAngle / 2;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        ctx.save();
        ctx.rotate(curAngle);
        ctx.translate(0, -radius);
        ctx.fillText(char, 0, 0);
        ctx.restore();
        curAngle += letterSpacing;
      }
      ctx.restore();
    };

    ctx.font = '900 48px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#ffffff';
    drawCircularText('P  I  R  E  L  L  I', 400, 0, 0.052);
    drawCircularText('P  I  R  E  L  L  I', 400, Math.PI, 0.052);

    ctx.font = 'bold 36px "Chakra Petch", sans-serif';
    ctx.fillStyle = compoundColor;
    drawCircularText('P  Z  E  R  O', 400, Math.PI * 0.5, 0.055);
    drawCircularText('F 1   2 0 2 6', 400, Math.PI * 1.5, 0.055);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#6b7280';
    drawCircularText('305/720 R18 · ROTATION ▶', 465, Math.PI * 0.25, 0.026);
    drawCircularText('FOR RACING USE ONLY · FIA APPROVED', 465, Math.PI * 1.25, 0.026);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    this.sidewallTextureCache.set(compoundColor, tex);
    return tex;
  }

  public static getCarbonFiberWeaveTexture(): THREE.CanvasTexture {
    if (this.sharedCarbonWeaveTexture) return this.sharedCarbonWeaveTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 128, 128);

    const imgData = ctx.getImageData(0, 0, 128, 128);
    const data = imgData.data;

    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const idx = (y * 128 + x) * 4;
        const twill = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0) ? 1 : -1;
        const grain = Math.sin((x + y) * 1.5) * 0.5;
        const bump = twill * 0.6 + grain * 0.4;

        data[idx] = Math.round(128 + bump * 48);
        data[idx + 1] = Math.round(128 - bump * 48);
        data[idx + 2] = 250;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    this.sharedCarbonWeaveTexture = tex;
    return tex;
  }
}
