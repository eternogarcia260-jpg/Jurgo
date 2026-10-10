# Plan de Rediseño Avanzado: Morro y Alerón Delantero F1 (2024–2026)

## Diagnóstico Técnico
En la captura de pantalla (cámara de morro "MORRO" a $z = 1.35, y = 0.68$), se visualizan dos elementos cilíndricos negros flotando en el aire sin anclaje a ambos lados del morro.
1. **Causa:** En `CarBodyBuilder.ts`, las carcasas de cámara del chasis (`chassisCamGeos`) se colocaron en $x = \pm0.20, y = 0.42, z = 1.68$, y las cámaras del alerón (`camPodGeos`) en $x = \pm0.17, y = 0.38, z = 2.02$, sin soportes horizontales ni pilones aerodinámicos conectados a la superficie del monocasco. Como la sección transversal del morro es más estrecha que $\pm0.20$ a esa altura, los cilindros quedan suspendidos en el vacío.
2. **Estructura del alerón:** El morro actual termina en el aire por encima del alerón sin fundirse de manera continua en la estructura de choque y el plano principal, dejando huecos visibles y fijaciones desconectadas.

## Cambios Propuestos

### 1. Eliminación y Rediseño de los Soportes Flotantes
- **Soportes de cámaras FOM (FIA):** Reemplazar los cilindros huérfanos por pods aerodinámicos integrados con brazos de perfil alar (teardrop NACA foil stalks) en fibra de carbono mate/brillante que nacen directamente desde los laterales del monocasco hacia afuera, tal y como dictamina el reglamento técnico F1.
- **Fijación estructural morro-alerón:** Diseñar una nariz de impacto cónica y continua que desciende suavemente desde la estación $z = 1.95$ hasta $z = 2.45, y = 0.12$, apoyándose e integrándose directamente sobre el plano principal del alerón (estilo Red Bull RB20 / McLaren MCL38 / Ferrari SF-24).

### 2. Alerón Delantero Multielemento Esculpido (F1 2024-2026)
- **Plano principal (Mainplane):** Curvatura de efecto suelo continua, con garganta central y bordes de ataque redondeados de alta fidelidad, perfectamente anclados al morro.
- **Flaps secundarios, terciarios y superiores:** Cascada progresiva de 4 elementos con inclinaciones descendentes (downwash/outwash), espacio de ranura (*slot gap*) preciso y perfiles de cuerda decreciente.
- **Separadores de ranura (Slot-gap separators):** Brackets metálicos aerodinámicos de titanio y carbono distribuidos simétricamente en 3 estaciones por semiala, manteniendo la rigidez estructural y aportando un aspecto mecánico 100% auténtico de F1.
- **Endplates F1 2024-2026:** Placas terminales esculpidas con curvatura exterior (*outwash*), *dive planes* (planos de inmersión en S) y canalizaciones de footplate inferiores para guiar el flujo de aire alrededor de los neumáticos delanteros.

### 3. Optimización Gráfica y Rendimiento
- **Zero Allocations:** Integración limpia en un único grafo de objetos con matrices estáticas y reutilización de materiales compartidos (`materials.carbonMaterial`, `materials.bodyMaterial`, `materials.frontWingFlapMaterial`, `materials.mechanicalMetalMat`).
- **Compatibilidad con Daño:** Mantener los grupos de colisión y deformación del alerón (`frontWingLeftGroup`, `frontWingRightGroup`, `stubMesh`) para que el sistema de física de colisiones y daños siga funcionando a la perfección.

## Verificación
1. Compilar con `compile_applet`.
2. Verificar visualmente en cámara "MORRO" y en cámaras de persecución ("Cerca", "Media", "Lejos") que no queda ningún elemento suspendido y que la geometría luce idéntica a un monoplaza moderno de F1.
3. Comprobar que no hay regresiones de frametime (60 FPS estables).
