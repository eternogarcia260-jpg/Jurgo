# Refactorización Modular y Preservación Visual Absoluta de CarModel

Plan de modernización técnica y optimización de rendimiento para desacoplar el monolito **`CarModel.ts` (4.495 líneas)** en subsistemas especializados, garantizando **cero pérdida de elementos gráficos**, **cero reducción de calidad visual**, **cero breaking changes** en la API y un rendimiento ultra-fluido a 60–120 FPS.

---

## Garantía de Preservación Visual y Cero Pérdida de Elementos

> [!IMPORTANT]
> **Compromiso Técnico de Fidelidad 1:1**:
> Cada polígono, shader, textura procedural en canvas, gradiente, material PBR, calcomanía y animación del monoplaza se conservará con exactitud matemática idéntica. La refactorización no toca la estética ni reduce la resolución; optimiza la organización arquitectónica y elimina la recolección de basura (*Garbage Collection*) en CPU.

### Inventario Exhaustivo de Elementos Visuales Protegidos
1. **Chasis y Geometría Aerodinámica F1**:
   - Fuselaje esculpido con morro FIA deformante, cono frontal y chimenea de admisión (*airbox*) superior.
   - Pontones laterales (*sidepods*) con entrada de refrigeración *undercut* y curvatura aerodinámica hacia el difusor.
   - Alerón delantero multielemento (4 planos alares por lado), *endplates* curvados y flaps superiores desmontables por impacto.
   - Alerón trasero de doble perfil alar con soportes en cuello de cisne (*swan neck*), pilares estructurales y placas laterales.
   - Halo de seguridad de titanio con sección elíptica y carenado superior aerodinámico.
   - Fondo plano con túneles Venturi y difusor trasero con láminas verticales.
   - Sombra de contacto inferior suave horneada (*underbody contact shadow*) con oclusión ambiental difusa.
2. **Texturas y Libreas Procedurales en Canvas 2K/4K**:
   - Rotulación vectorial de patrocinadores reales (Pirelli, Brembo, Shell, Apex GT), dorsales y marcas de equipo para las 5 escuderías (`TeamLiveryConfig`).
   - Calcomanías específicas en el halo, placas terminales de alerón (*endplates*), aleta de tiburón (*shark fin*) y flap superior.
   - Acabados PBR calibrados: pintura perlada con barniz *clearcoat*, fibra de carbono expuesta con textura de tejido real y micro-partículas metálicas (*metallic flakes*).
3. **Conjunto Mecánico de Ruedas y Frenos**:
   - 4 neumáticos de 18 pulgadas con curvatura de perfil bajo y mapa normal de banda de rodadura.
   - Texturas de flanco de neumático con rotulación P-Zero y anillo de color de compuesto dinámico:
     - Rojo: Soft (Blando)
     - Amarillo: Medium (Medio)
     - Blanco: Hard (Duro)
     - Verde: Intermediate (Intermedio)
     - Azul: Wet (Lluvia extrema)
   - Transición continua a malla de desenfoque radial (*radial blur*) al superar los 40 km/h para sensación de velocidad cinemática.
   - Discos de freno cerámicos perforados con incandescencia térmica emisiva (resplandor al rojo vivo) proporcional a la intensidad de frenada.
   - Pinzas de freno de 6 pistones en color titanio y tuercas centrales (*centerlock*) con giro visible durante las paradas en boxes.
4. **Cabina, Piloto y Cockpit Digital**:
   - Volante de carreras estilo F1 con pantalla digital y barra superior de luces LED de revoluciones activadas secuencialmente según RPM del motor.
   - Casco 3D del piloto con calota nacarada aerodinámica y visera iridiscente de alta reflectividad.
5. **Efectos Dinámicos y Cinemática de Pista**:
   - Sistema DRS activo: actuador hidráulico articulado que abre la solapa superior del alerón trasero suavemente con luz LED indicadora en la cabina.
   - Plancha de titanio inferior (*underbody plank*): cálculo exacto del punto de contacto con el suelo para generar chispas de titanio al rozar los bordillos o a máxima velocidad.
   - Salidas de escape dobles: shader procedural GLSL de llamarada de escape cónica (*backfire*) con luz puntual parpadeante en reducciones de marcha.
   - Luz de seguridad FIA trasera en lluvia y niebla con parpadeo estroboscópico de emergencia.

---

## 1. Visión General de la Refactorización

Transformar el monolito `CarModel.ts` mediante el patrón **Composite Facade**:
- La clase pública `CarModel` retiene **el 100% de su API pública existente**:
  - `public group: THREE.Group`
  - `public liveryConfig: TeamLiveryConfig`
  - `public isAi: boolean`
  - `public isCustomModel: boolean`
  - `public currentModelName: string`
  - `public contactShadowMesh?: THREE.Mesh`
  - `update(physics, dt, alpha, isPlayer)`
  - `setDRS(isOpen, dt, speedKmh)`
  - `setTireCompoundVisuals(compound)`
  - `setBrakeDiscThermalGlow(glowFactor)`
  - `triggerBackfire(isHighRpm)`
  - `getUnderbodyPlankWorldPosition(outPos, rearDir)`
  - `getSingleWheelWorldPosition(wheelIdx, out)`
  - `getWheelHubWorldPos(wheelIdx, target)`
  - `setWheelOffset(wheelIdx, offset)`
  - `setWheelVisible(wheelIdx, visible)`
  - `setAllWheelsVisible(visible)`
  - `resetWheelOffsets()`
  - `setCenterlockNutSpin(wheelIdx, angle)`
  - `setLivery(livery)`
  - `applyDamage(damage)`
  - `repairWingVisuals()`
  - `loadCustomModel(file)`
  - `restoreDefaultModel()`
  - `dispose()`
  - Método estático `CarModel.clearTireTextureCache()`
- Los módulos internos se responsabilizan exclusivamente de su dominio, compartiendo recursos en VRAM sin duplicación.

---

## 2. Decisiones Técnicas y de Rendimiento (CPU / GPU / Memoria)

### Decisión 1: Preasignación de Buffers de Deformación (Zero GC en Colisiones)
- **Problema que resuelve**: Al chocar, deformar los vértices del morro y las alas mediante clonación de arrays provocaba picos del Garbage Collector (tirones de frametime).
- **Solución**: Preasignar un buffer `Float32Array` estático con las posiciones originales al inicio. La deformación por impacto calcula los desplazamientos directamente sobre el buffer existente sin reservar memoria nueva.
- **Impacto**: Cero micro-tirones durante impactos a más de 300 km/h.

### Decisión 2: Registro Cacheado de Compuestos de Neumáticos
- **Problema que resuelve**: Cambiar de compuesto en una parada en boxes no debe regenerar canvas 2D ni recompilar shaders.
- **Solución**: Generar y cachear en GPU las texturas de Soft, Medium, Hard, Wet e Inter al arrancar la aplicación en `CarLiveryFactory`. El cambio en boxes es instantáneo a nivel de puntero de textura.
- **Impacto**: Paradas en boxes a 60–120 FPS sin caída de fotogramas.

### Decisión 3: Cero Asignaciones de Vectores en el Loop Cinemático
- **Problema que resuelve**: `getUnderbodyPlankWorldPosition` y los cálculos de aleteo aeroelástico (*flutter*) y dirección de ruedas no deben invocar `new THREE.Vector3()`.
- **Solución**: Uso estricto de pools estáticos de vectores de trabajo (`scratchVector`, `scratchMatrix`).
- **Impacto**: Frametime plano de 16.6ms (60 FPS) o 8.3ms (120 FPS).

---

## 3. Arquitectura Modular del Vehículo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CarModel (Facade Público)                          │
│               (Mantiene idéntica firma e interfaz pública)              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      │                              │                              │
┌─────▼────────────────────┐  ┌──────▼────────────────┐  ┌──────────▼───────────────┐
│ CarLiveryFactory.ts      │  │ CarMaterials.ts       │  │ CarBodyBuilder.ts        │
│ Texturas 2D en Canvas:   │  │ Materiales PBR:       │  │ Chasis, morro, alas F1,  │
│ Patrocinadores, dorsales,│  │ Pintura clearcoat,    │  │ sidepods, halo, difusor, │
│ compuestos de neumáticos │  │ fibra de carbono      │  │ cockpit y volante LED    │
└─────────────────────────┘  └───────────────────────┘  └──────────────────────────┘
      │                              │                              │
┌─────▼────────────────────┐  ┌──────▼────────────────┐  ┌──────────▼───────────────┐
│ CarWheelAssembly.ts      │  │ CarDamageSystem.ts    │  │ CarEffectsSystem.ts      │
│ 4 Ruedas, llantas 18",   │  │ Deformación morro con │  │ DRS hidráulico animado,  │
│ frenos térmicos y blur,  │  │ buffers preasignados  │  │ chispas suelo y backfire │
│ tuercas centerlock       │  │ y aleteo aeroelástico │  │ con shader GLSL          │
└─────────────────────────┘  └───────────────────────┘  └──────────────────────────┘
```

### Detalle de Módulos a Crear en `src/game/models/car/`:
1. **`CarLiveryFactory.ts`**:
   - Generación y caché de texturas procedurales en canvas 2D idénticas a las originales: librea de equipo, alas trasera y delantera, shark fin, halo, endplates, flancos de neumáticos por compuesto y texturas de desenfoque radial.
   - Texturas compartidas en VRAM: fibra de carbono tejida, copos metálicos y normales de banda de rodadura.
2. **`CarMaterials.ts`**:
   - Inicialización y caché de materiales PBR (pintura con *clearcoat*, fibra de carbono mate y brillante, halo de titanio, aleación de suspensión, materiales de freno emisivos y shader de llamarada de escape).
3. **`CarBodyBuilder.ts`**:
   - Construcción geométrica del fuselaje, cono de morro FIA, alerón delantero multiborde, pontones laterales, fondo plano, halo de titanio, cabina de conducción y volante con luces LED.
4. **`CarWheelAssembly.ts`**:
   - Ensamblaje de ruedas delanteras con pivotes de dirección y traseras con suspensión, discos de freno con resplandor térmico incandescente, pinzas, tuerca central móvil y transiciones de desenfoque radial.
5. **`CarDamageSystem.ts`**:
   - Deformación de vértices por choque con buffers preasignados (Zero GC), flaps sueltos, desprendimiento de alerones y oscilaciones aeroelásticas (*flutter*).
6. **`CarEffectsSystem.ts`**:
   - Cinemática suave del alerón DRS con actuador hidráulico, cálculo de posición del tablón de titanio para chispas de suelo y shader de llamarada de escape (*backfire*).
7. **`CarModel.ts` (Facade Refactorizado)**:
   - Orquesta todos los subsistemas, conservando intactas todas las propiedades, interfaces y compatibilidad con el importador de modelos GLB (`CarModelImporter`).

---

## 4. Plan de Ejecución Paso a Paso

1. **Fase 1: Módulos de Soporte Gráfico (`CarLiveryFactory` y `CarMaterials`)**:
   - Extraer generación de texturas y materiales compartidos con caché estática de compuestos de neumáticos.
2. **Fase 2: Geometría de Chasis y Ruedas (`CarBodyBuilder` y `CarWheelAssembly`)**:
   - Extraer la aerodinámica del monoplaza y el ensamblaje de ruedas/frenos con soporte completo para dirección y boxes.
3. **Fase 3: Sistemas de Daño y Efectos Dinámicos (`CarDamageSystem` y `CarEffectsSystem`)**:
   - Implementar la deformación con buffers preasignados (Zero GC) y los efectos de DRS, chispas y backfire.
4. **Fase 4: Conexión del Facade `CarModel.ts`**:
   - Reemplazar la implementación monolítica conectándola con los submódulos especializados, manteniendo el 100% de la API pública.
5. **Fase 5: Verificación de Build y Pruebas Visuales**:
   - Compilación con `compile_applet` y `lint_applet` comprobando que no existan errores de tipos ni regresiones visuales.
