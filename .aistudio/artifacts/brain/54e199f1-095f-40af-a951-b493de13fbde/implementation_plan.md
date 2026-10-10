# Refactorización Modular y Preservación Visual Absoluta de RacingGameEngine

Plan de modernización técnica y optimización de arquitectura para transformar el monolito **`RacingGameEngine.ts` (2.525 líneas)** en subsistemas desacoplados, garantizando **cero pérdida de elementos gráficos**, **cero reducción de calidad visual**, **cero breaking changes** en la API y un rendimiento fluido y plano a 60–120 FPS.

---

## Garantía de Preservación Visual y Cero Pérdida de Elementos

> [!IMPORTANT]
> **Compromiso Técnico de Fidelidad Visual 1:1**:
> Ningún efecto óptico, shader, sombra, partícula o perspectiva de cámara será alterado, simplificado o reducido. La refactorización mantiene idénticos cada parámetro matemático, coeficiente cinemático y configuración de renderizado.

### Inventario Exhaustivo de Elementos Visuales Protegidos

1. **Iluminación PBR y Atmósfera de Circuito**:
   - **Luz Solar Direccional**: Coordenadas exactas del sol, color cálido calibrado (`0xfffaed`, intensidad 2.2), proyección ortográfica calibrada para la pista ($60 \times 60\,\text{m}$) y mapa de sombras de alta definición ($2048 \times 2048$) con `bias = -0.0004` y radio de penumbra suave de 1.8 para evitar artefactos (*peter-panning* o *shadow acne*).
   - **Luz Hemisférica Ambiental**: Tono de bóveda celeste fría y rebote difuso del asfalto/hierba para relleno natural en zonas de sombra.
   - **Cielo Procedural y Niebla de Horizonte**: Textura de domo celestial generada en Canvas 2D con gradiente azur, bruma difusa en el horizonte y degradado hacia el cenit.
   - **IBL y Reflexiones Especulares**: Mapa de entorno PBR (`scene.environment`) asignado con intensidad 1.0 para reflejos cristalinos sobre el barniz transparente del monoplaza y visera del piloto.
   - **Calibración Dinámica de DPR**: Selección inteligente del ratio de píxeles del dispositivo (`min(window.devicePixelRatio, 2.0)`) con escalado adaptativo si la resolución supera 2.5K, garantizando nitidez Retina a 60–120 FPS.

2. **Sistema Cinematográfico de 6 Cámaras y Dinámica de Vistas**:
   - **Cámara Chase (Persecución Dinámica)**: 3 distancias configurables (*Near*, *Medium*, *Far*):
     - Vector de anticipación de trayectoria (*lookAhead*) calculado a 18 m por delante del morro.
     - Suavizado lagrangiano de seguimiento elástico que absorbe virajes bruscos con peso realista.
   - **Cámara Cockpit (Primera Persona F1)**:
     - Ubicación milimétrica a la altura de los ojos del piloto dentro de la célula de supervivencia.
     - Alineación exacta con la pantalla LCD del volante y visera.
   - **Cámara TV Pod (Cámara Oficial de Retransmisión)**:
     - Posicionada sobre la toma de admisión superior (*airbox*) con vista panorámica del morro y las ruedas delanteras.
   - **Cámara Trackside (Cámaras Fijas de Pista)**:
     - Conmutación automática a torres de cámaras estáticas situadas en los vértices de cada curva a medida que el monoplaza se desplaza.
   - **Cámara Helicóptero (Vista Aérea Orbital)**:
     - Seguimiento cenital suave a 35 m de altitud con ángulo oblicuo cinemático.
   - **Modo Espectador / Órbita Libre**:
     - Inspección 360° con rotación libre alrededor del monoplaza.
   - **Efectos Dinámicos de Cámara**:
     - **FOV Breathing (Sensación de Velocidad)**: Expansión angular progresiva desde $65^\circ$ en parado hasta $88^\circ$ a máxima velocidad (330 km/h) con interpolación cúbica suave.
     - **G-Force Shake & Chassis Clatter**: Sacudidas angulares y traslacionales proporcionales a las fuerzas G laterales en curvas rápidas, frenadas bruscas y rozamiento con los bordillos.
     - **Transición Cinemática de Boxes**: Movimiento suave de cámara hacia los mecánicos durante las operaciones de pit stop.

3. **Partículas y Efectos de Pista en Tiempo Real**:
   - **Chispas de Fondo Plano**: Generación balística de chispas de titanio cuando la plancha inferior roza el asfalto o pianos a más de 200 km/h.
   - **Humo de Neumáticos**: Emisión volumétrica por bloqueo de frenada, derrape lateral o pérdida de tracción (*burnout*).
   - **Llamaradas de Escape (Backfire)**: Cono volumétrico con shader aditivo en reducciones de marcha y fogonazo de luz puntual naranja en la trasera.
   - **Marcas de Neumático (Skidmarks)**: Decals continuos de caucho quemado en frenadas intensas con caída suave de opacidad.
   - **Efecto de Velocidad (Speed Vignette)**: Descenso radial cinemático en los bordes de la pantalla a alta velocidad.
   - **Heat Haze (Distorsión de Calor)**: Turbulencia térmica ondulante sobre el capó del motor y escapes.
   - **Efectos Ópticos Cinematográficos**: Destello anamórfico (*lens flare*), viñeteado y micro-aberración cromática calibrada.

4. **Físicas de Colisión, Muros y Balística de Objetos**:
   - **Muros de Hormigón FIA**: Detección analítica contra las 4 ruedas y el chasis con cálculo de vector normal de contacto y desaceleración elástica.
   - **Barreras Tecpro de Absorción**: Deformación plástica virtual y fricción superficial.
   - **Balística de Props**: Impulso cinemático 3D, rotación en el aire y rebotes en el suelo para conos delimitadores y paneles de frenada (50m, 100m, 150m, 200m).
   - **Colisiones Coche-Coche**: Separación geométrica sin solapamiento, transferencia de momento elástico e impulso de giro en trompos.

---

## 1. Arquitectura Modular Propuesta

```
┌────────────────────────────────────────────────────────────────────────┐
│                   RacingGameEngine (Coordinador Facade)                │
│       (Bucle de simulación con fixed timestep e interfaz pública intacta) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
     ┌──────────────────────────────┼──────────────────────────────┐
     │                              │                              │
┌────▼──────────────────────┐ ┌─────▼──────────────────────┐ ┌─────▼─────────────────────────┐
│ CameraController.ts       │ │ CollisionSystem.ts         │ │ RaceSessionCoordinator.ts   │
│ Modos de cámara (Chase,   │ │ SpatialHashGrid, colisiones│ │ Sectores, vueltas, DRS FIA, │
│ Cockpit, TV, Trackside),  │ │ muros, Tecpro, props y     │ │ semáforo de salida, carrera │
│ FOV dinámico, sacudidas G │ │ coche contra coche (Zero GC)│ │ y telemetría reactiva 60 Hz  │
└───────────────────────────┘ └────────────────────────────┘ └─────────────────────────────┘
                                    │
                               ┌────▼──────────────────────┐
                               │ EnvironmentLighting.ts    │
                               │ Luz solar direccional,    │
                               │ sombras cascada, IBL,     │
                               │ cielo dinámico y DPR      │
                               └───────────────────────────┘
```

### Ubicación de los Módulos en `src/game/engine/`:
1. **`src/game/engine/CameraController.ts`**:
   - Alberga el 100% de la lógica de matrices de vista, posiciones preestablecidas, suavizado de seguimiento, cálculo de vectores de anticipación (*lookAhead*), FOV adaptativo por velocidad y sacudidas por fuerzas G (*G-force shake*), utilizando un pool de vectores preasignados (Zero GC).
2. **`src/game/engine/CollisionSystem.ts`**:
   - Alberga la partición espacial `SpatialHashGrid` con celdas de tamaño óptimo, colisiones estáticas con muros de hormigón y barreras Tecpro, balística de conos y paneles de frenada, y colisiones elásticas coche contra coche.
3. **`src/game/engine/EnvironmentLightingSystem.ts`**:
   - Alberga la configuración precisa del sol, mapa de sombras de 2K, sesgo de sombra (*bias*), luz hemisférica, síntesis de la textura de cielo en Canvas 2D y cálculo de DPR adaptativo.
4. **`src/game/engine/RaceSessionCoordinator.ts`**:
   - Alberga el cronometraje de sectores (S1, S2, S3), detección de vuelta rápida, lógica FIA de apertura y pitidos de DRS, secuencia de semáforo de salida (*lights out*), modos de carrera y práctica libre, sincronización multijugador y difusión de telemetría a 60 Hz.
5. **`src/game/RacingGameEngine.ts` (Facade Refactorizado)**:
   - Actúa como orquestador principal: gestiona el ciclo `requestAnimationFrame`, el bucle de físicas con paso fijo desacoplado (`fixedDt = 1/120s`), la sincronización del monoplaza con las partículas de humo/chispas y mantiene **el 100% de la API pública existente**.

---

## 2. Decisiones Técnicas y de Rendimiento (CPU / GPU / Memoria)

### Decisión 1: `SpatialHashGrid` Preasignado (Zero GC en Detección de Colisiones)
- **Problema**: En cada fotograma, filtrar obstáculos estáticos y comprobar distancias mediante la creación de arrays temporales genera picos de Garbage Collector.
- **Solución**: Estructurar un `SpatialHashGrid` con celdas de 30m x 30m e índices preasignados. Las consultas reutilizan buffers estáticos sin instanciar nuevos objetos.
- **Impacto**: Cero recolección de basura por segundo en físicas; frametime plano y constante.

### Decisión 2: Scratch Pool Vectorial para Cinemática de Cámara
- **Problema**: Calcular la posición deseada de la cámara, el punto de mira (`lookAt`), la anticipación de curvas y las sacudidas G invoca repetidamente `new THREE.Vector3()`.
- **Solución**: Agrupar un conjunto estático de vectores y matrices de trabajo (`_targetCamPos`, `_targetLookAt`, `_camVelocity`, `_shakeOffset`) internos en `CameraController`.
- **Impacto**: 0 bytes de memoria residual generada por segundo durante el movimiento de cámara.

### Decisión 3: Preservación Absoluta de la API Pública de `RacingGameEngine`
- **Problema**: Múltiples componentes en `src/App.tsx`, `TelemetryOverlay.tsx`, `CameraControls.tsx`, `PitStopOverlay.tsx`, etc., dependen directamente de métodos de `RacingGameEngine`.
- **Solución**: Mantener exactamente todas las firmas y métodos públicos existentes:
  - `subscribeTelemetry`, `getTelemetry`, `setPaused`, `setCameraMode`, `setCameraDistance`, `nextCameraDistance`, `nextCameraMode`, `repairCar`, `resetCarToTrack`, `toggleAudio`, `resumeAudio`, `restoreDefaultCar`, `initMultiplayer`, `updateRivalCar`, `setTireCompound`, `setCircuit`, `initCareerRace`, `initFreePractice`, `setControlsLocked`, `dispose`.
- **Impacto**: Cero regresiones o breaking changes en la aplicación de React.

---

## 3. Plan de Ejecución Paso a Paso [COMPLETADO]

1. **Fase 1: Módulos de Entorno y Cámara (`GraphicsPipeline` y `CameraController`)** [COMPLETADO]:
   - Extraer la configuración de luces, sombras y cielo en `src/game/engine/GraphicsPipeline.ts`.
   - Extraer todos los modos y dinámicas de cámara en `src/game/engine/CameraController.ts` con vectores de trabajo preasignados.
2. **Fase 2: Físicas y Colisiones (`CollisionSystem`)** [COMPLETADO]:
   - Implementar `src/game/engine/CollisionSystem.ts` con la rejilla `SpatialHashGrid` O(1), respuesta elástica de muros, balística de props y choques coche-coche con cero GC.
3. **Fase 3: Coordinación de Carrera y Telemetría (`RaceSessionCoordinator`)** [COMPLETADO]:
   - Implementar `src/game/engine/RaceSessionCoordinator.ts` para sectores, vueltas, DRS, semáforos, modos de juego y difusión de telemetría sin recolección de basura.
4. **Fase 4: Refactorización del Facade `RacingGameEngine.ts`** [COMPLETADO]:
   - Reducir el monolito a un coordinador limpio que delegue en los 4 subsistemas, manteniendo el 100% de la API pública existente.
5. **Fase 5: Verificación de Build y Pruebas** [COMPLETADO]:
   - Comprobar la compilación limpia con `compile_applet` y la ausencia de errores de tipado con `lint_applet`.

---

## 4. Plan de Verificación

### Pruebas Automatizadas
- `compile_applet`: Garantiza que el empaquetado de producción de Vite compila sin errores.
- `lint_applet` (`tsc --noEmit`): Valida que todos los tipos, interfaces, métodos y accesos a propiedades sean estrictamente válidos.

### Pruebas de Integración y Rendimiento en Ejecución
- Comprobar la alternancia de modos de cámara (Chase, Cockpit, TV Pod, Trackside, Heli).
- Comprobar que las fuerzas G de frenado y aceleración mueven el cockpit con la misma fluidez.
- Comprobar el paso por las zonas DRS (detección, apertura del alerón en monoplaza y ganancia de velocidad punta).
- Comprobar choques contra muros y barreras Tecpro para certificar rebotes y chispas sin desincronización.
- Comprobar que el cronometraje de sectores y tiempos por vuelta registra las marcas correctamente.
