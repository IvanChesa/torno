/**
 * El aparato (PLAN §4.6 y fase 5.b): cada pieza de `instrument/layout.ts` con su detalle (biseles,
 * moleteado, rótulos, tornillos y pilotos) y los materiales de DISENO.md §7. Sin DOM: las texturas
 * de canvas (pantalla, cubierta impresa, rótulos y sombra) las pone quien lo monta, así que se puede
 * construir y medir en Node.
 *
 * En la escena, y = 0 es la mesa, x va a la derecha y z hacia quien toca; todo en metros.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  RingGeometry,
  Shape,
  TorusGeometry,
  type Material,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ARM,
  armDirection,
  BODY,
  DECK_HEIGHT,
  DISC,
  DISC_OUTER_RADIUS,
  FEET,
  KEY,
  LAYER_CONTROLS,
  LAYER_DIAL_SIZE,
  PILOTS,
  PLACEMENTS,
  polar,
  SCREEN,
  STANDBY_SIZE,
  TRAY,
  WHEEL,
  type ControlId,
  type PlacedControl,
} from '../../instrument';
import type { InstrumentMaterials } from '../materials/materials';
import { PRINT_INNER_RADIUS, PRINT_RADIUS } from '../materials/print';
import type { LabelIcon } from '../materials/textures';
import {
  lathe,
  latheSector,
  MM,
  profilePoints,
  rad,
  shade,
  tileLathe,
  type ProfilePoint,
} from './geometry';

/** Los segmentos de las piezas torneadas (según la calidad). */
export interface ModelOptions {
  /** Alrededor de las piezas grandes: el cuerpo, el disco y la cubierta. */
  readonly roundSegments: number;
  /** Alrededor de las pequeñas: diales, pilotos, tornillos. */
  readonly smallSegments: number;
}

export type KeyId = 'play' | 'record' | 'undo' | 'standby';

/** Lo que el montaje de la escena necesita tocar después de construir el aparato. */
export interface InstrumentModel {
  readonly root: Group;
  /**
   * La pieza de cada control: el grupo que gira (diales, rueda, brazo, disco) o que se hunde
   * (teclas). Su posición es la del control en la escena.
   */
  readonly controls: ReadonlyMap<ControlId, Object3D>;
  /** La rueda gira sobre un eje propio (en tangente), dentro de su grupo. */
  readonly wheel: Object3D;
  /** Los pilotos de las capas, en orden, y el de grabar. */
  readonly pilots: readonly Mesh[];
  readonly recordLed: Mesh;
  /** El anillo de luz que rodea el dial de la capa elegida. */
  readonly selection: Object3D;
  /** La pantalla, lo impreso en la cubierta y el plano de cada rótulo, para ponerles su textura. */
  readonly screen: Mesh;
  readonly print: Mesh;
  readonly labels: ReadonlyMap<LabelIcon, Mesh>;
}

/** El mosaico de la cerámica: una vez cada 80 mm. */
export const CERAMIC_TILE_MM = 80;
const TILE = CERAMIC_TILE_MM * MM;
/** Estrías del moleteado alrededor de un dial de capa (las demás piezas, en proporción). */
const KNURL_RIDGES_PER_MM = 1 / 1.6;

/** Inclinación de la cara de dentro de la bandeja: lo que avanza hacia fuera por mm de alto. */
const LEAN = Math.tan(rad(TRAY.lean));
/** Radio de la cara de dentro de la bandeja a una altura sobre la cubierta. */
const trayInner = (height: number) => TRAY.innerRadius + height * LEAN;

/** Coloca un objeto en un punto polar de la cubierta (mm), girado hacia fuera, a una altura (mm). */
function place(object: Object3D, radius: number, angle: number, height = DECK_HEIGHT): void {
  const point = polar(radius, angle);
  object.position.set(point.x * MM, height * MM, point.z * MM);
  object.rotation.y = rad(angle);
}

function mesh(geometry: BufferGeometry, material: Material, name: string): Mesh {
  const result = new Mesh(geometry, material);
  result.name = name;
  return result;
}

/** Un torneado sin color propio: blanco por vértice (los materiales con colores por vértice). */
const plain = (geometry: BufferGeometry) => shade(geometry, () => 1);

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export function buildInstrument(
  materials: InstrumentMaterials,
  options: ModelOptions,
): InstrumentModel {
  const root = new Group();
  root.name = 'torno';
  const controls = new Map<ControlId, Object3D>();

  root.add(body(materials, options), deck(materials, options), feet(materials, options));
  const disc = discGroup(materials, options);
  controls.set('disc', disc);
  const print = mesh(
    new RingGeometry(PRINT_INNER_RADIUS * MM, PRINT_RADIUS * MM, options.roundSegments, 1),
    materials.print,
    'cubierta impresa',
  );
  print.rotation.x = -Math.PI / 2;
  print.position.y = (DECK_HEIGHT + 0.05) * MM;
  root.add(disc, discWell(materials, options), print);

  const tray = trayGroup(materials, options);
  root.add(tray.group);

  const labels = new Map<LabelIcon, Mesh>();
  for (const id of ['play', 'record', 'undo'] as const) {
    const key = keyGroup(materials, id);
    controls.set(id, key.group);
    labels.set(id, key.label);
    root.add(key.group);
  }
  const standby = standbyGroup(materials, options);
  controls.set('standby', standby.group);
  labels.set('standby', standby.label);
  root.add(standby.group);

  for (const id of [...LAYER_CONTROLS, 'main'] as PlacedControl[]) {
    const dial = dialGroup(materials, options, id);
    controls.set(id, dial);
    root.add(dial);
  }
  const lights = pilots(materials, options);
  root.add(...lights.pilots, lights.recordLed);

  const selection = mesh(
    new TorusGeometry((LAYER_DIAL_SIZE / 2 + 2.6) * MM, 0.55 * MM, 8, options.smallSegments * 2),
    materials.selection,
    'capa elegida',
  );
  selection.rotation.x = -Math.PI / 2;
  selection.position.y = (DECK_HEIGHT + 0.4) * MM;
  root.add(selection);

  const wheel = wheelGroup(materials, options);
  controls.set('volume', wheel.group);
  root.add(wheel.group);

  const arm = armGroup(materials, options);
  controls.set('arm', arm);
  root.add(arm);

  return {
    root,
    controls,
    wheel: wheel.pivot,
    pilots: lights.pilots,
    recordLed: lights.recordLed,
    selection,
    screen: tray.screen,
    print,
    labels,
  };
}

/**
 * El cuerpo: un plato grueso torneado que se abre desde la base y sube recto hasta el canto
 * redondeado. La cubierta plana va aparte (`deck`), con coordenadas de textura planas.
 */
function body(materials: InstrumentMaterials, { roundSegments }: ModelOptions): Mesh {
  const bottom = FEET.height;
  const profile: ProfilePoint[] = [
    // Por debajo no se ve nunca (está sobre la mesa): sin tapa.
    [BODY.baseRadius - BODY.footRadius - 1, bottom],
    [BODY.baseRadius, bottom, BODY.footRadius],
    [BODY.radius, bottom + BODY.flare, 30],
    [BODY.radius, DECK_HEIGHT, BODY.edgeRadius],
    [BODY.radius - BODY.edgeRadius, DECK_HEIGHT],
  ];
  const points = profilePoints(profile, { segments: 10 });
  const geometry = lathe(points, roundSegments);
  tileLathe(geometry, points, roundSegments, {
    uRepeat: Math.round((2 * Math.PI * BODY.radius) / CERAMIC_TILE_MM),
    tile: TILE,
  });
  return mesh(geometry, materials.body, 'cuerpo');
}

/** La cubierta: el plano de arriba, hasta el bisel del canto, con el mosaico en planta. */
function deck(materials: InstrumentMaterials, { roundSegments }: ModelOptions): Mesh {
  const radius = BODY.radius - BODY.edgeRadius;
  const geometry = new CircleGeometry(radius * MM, roundSegments);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, position.getX(i) / TILE, position.getY(i) / TILE);
  }
  const result = mesh(geometry, materials.body, 'cubierta');
  result.rotation.x = -Math.PI / 2;
  result.position.y = DECK_HEIGHT * MM;
  return result;
}

/** Las tres patas de goma, en una sola geometría. */
function feet(materials: InstrumentMaterials, { smallSegments }: ModelOptions): Mesh {
  const parts = FEET.angles.map((angle) => {
    const geometry = new CylinderGeometry(
      FEET.radius * MM,
      FEET.radius * MM,
      FEET.height * MM,
      smallSegments,
      1,
      true,
    );
    const point = polar(FEET.distance, angle);
    geometry.translate(point.x * MM, (FEET.height / 2) * MM, point.z * MM);
    return geometry;
  });
  const merged = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  return mesh(merged, materials.rubber, 'patas');
}

/** El disco: el esmalte, su anillo de latón, el cubo del centro y la marca que da la vuelta. */
function discGroup(
  materials: InstrumentMaterials,
  { roundSegments, smallSegments }: ModelOptions,
): Group {
  const group = new Group();
  group.name = 'disco';
  const base = DECK_HEIGHT + DISC.gap;
  const top = base + DISC.thickness;
  const r = DISC.radius;
  // La cara de arriba en anillos, para que el esmalte se oscurezca poco a poco hacia el borde.
  const glaze: ProfilePoint[] = [
    [0, base],
    [r, base, 1.5],
    [r, top, 3],
    [r * 0.88, top],
    [r * 0.76, top],
    [r * 0.62, top],
    [0, top],
  ];
  const glazeGeometry = shade(lathe(profilePoints(glaze), roundSegments), (x, _y, z) => {
    const radius = Math.hypot(x, z) / MM;
    return 1 - 0.2 * smoothstep(0.6 * r, r, radius);
  });
  group.add(mesh(glazeGeometry, materials.glaze, 'esmalte'));

  const inner = DISC.radius + 0.4;
  const ring: ProfilePoint[] = [
    [DISC_OUTER_RADIUS, base - 1],
    [DISC_OUTER_RADIUS, top - 1.5, 1.5],
    [inner, top - 1.5, 0.8],
    [inner, base - 1],
  ];
  group.add(
    mesh(
      plain(lathe(profilePoints(ring, { closed: true }), roundSegments)),
      materials.brass,
      'anillo',
    ),
  );

  const hub: ProfilePoint[] = [
    [0, top],
    [DISC.hubRadius, top],
    [DISC.hubRadius, top + 2.5, 2.5],
    [0, top + 3.5],
  ];
  group.add(mesh(plain(lathe(profilePoints(hub), smallSegments)), materials.brass, 'cubo'));

  const mark = mesh(new CircleGeometry(3.5 * MM, smallSegments), materials.key, 'marca');
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(0, (top + 0.05) * MM, DISC.markRadius * MM);
  group.add(mark);
  return group;
}

/** El hueco oscuro alrededor del disco: el disco está levantado sobre la cubierta. */
function discWell(materials: InstrumentMaterials, { roundSegments }: ModelOptions): Mesh {
  const well = mesh(
    new RingGeometry(DISC.radius * MM, PRINT_INNER_RADIUS * MM, roundSegments),
    materials.recess,
    'hueco del disco',
  );
  well.rotation.x = -Math.PI / 2;
  well.position.y = (DECK_HEIGHT + 0.05) * MM;
  return well;
}

/** La bandeja de detrás, con la pantalla curva en su cara de dentro y cuatro tornillos. */
function trayGroup(
  materials: InstrumentMaterials,
  { roundSegments, smallSegments }: ModelOptions,
): { group: Group; screen: Mesh } {
  const group = new Group();
  group.name = 'bandeja';
  // Arranca por debajo de la cubierta, para salir del bisel sin dejar hueco.
  const sunk = -6;
  const outer = TRAY.innerRadius + TRAY.thickness;
  const profile: ProfilePoint[] = [
    [outer + sunk * LEAN, DECK_HEIGHT + sunk],
    [outer + TRAY.height * LEAN, DECK_HEIGHT + TRAY.height, 3],
    [trayInner(TRAY.height), DECK_HEIGHT + TRAY.height, 3],
    [trayInner(sunk), DECK_HEIGHT + sunk],
  ];
  const segments = Math.max(24, Math.round((roundSegments * 2 * TRAY.halfAngle) / 360) * 2);
  const arc = TRAY.innerRadius * rad(2 * TRAY.halfAngle);
  group.add(
    mesh(
      latheSector(
        profilePoints(profile, { closed: true }),
        segments,
        180 - TRAY.halfAngle,
        180 + TRAY.halfAngle,
        { uRepeat: arc / CERAMIC_TILE_MM, tile: TILE },
      ),
      materials.body,
      'bandeja',
    ),
  );

  // La pantalla, medio mm por delante de la cara: de arriba abajo, para que mire al disco.
  const offset = 0.5;
  const screenProfile: ProfilePoint[] = [
    [trayInner(SCREEN.top) - offset, DECK_HEIGHT + SCREEN.top],
    [trayInner(SCREEN.bottom) - offset, DECK_HEIGHT + SCREEN.bottom],
  ];
  const geometry = lathe(
    profilePoints(screenProfile),
    Math.max(24, segments),
    180 - SCREEN.halfAngle,
    180 + SCREEN.halfAngle,
  );
  // Vista desde delante, la pantalla va de derecha a izquierda y de arriba abajo al revés que sus
  // coordenadas de textura: se giran las dos para que el texto se lea.
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i));
  const screen = mesh(geometry, materials.screen, 'pantalla');
  group.add(screen);
  group.add(...screws(materials, smallSegments));
  return { group, screen };
}

/** Los tornillos de las esquinas de la pantalla, con su ranura (dos geometrías unidas). */
function screws(materials: InstrumentMaterials, segments: number): Mesh[] {
  const heads: BufferGeometry[] = [];
  const slots: BufferGeometry[] = [];
  const screwAngle = SCREEN.halfAngle + (TRAY.halfAngle - SCREEN.halfAngle) / 2;
  for (const angle of [180 - screwAngle, 180 + screwAngle]) {
    for (const height of [SCREEN.bottom + 2, SCREEN.top - 2]) {
      const head: ProfilePoint[] = [
        [0, 0],
        [2.4, 0],
        [2.4, 0.9, 0.6],
        [0, 1.2],
      ];
      const holder = new Group();
      const screw = new Group();
      // La cabeza mira hacia el disco, perpendicular a la cara inclinada de la bandeja (su eje, y,
      // pasa a apuntar hacia dentro y un poco hacia arriba).
      screw.rotation.x = rad(TRAY.lean) - Math.PI / 2;
      holder.add(screw);
      place(holder, trayInner(height) - 0.2, angle, DECK_HEIGHT + height);
      // La ranura, en diagonal, como si los hubieran apretado a mano.
      screw.rotation.y = rad(35 + angle);
      holder.updateMatrixWorld(true);
      const headGeometry = lathe(profilePoints(head), segments);
      headGeometry.applyMatrix4(screw.matrixWorld);
      heads.push(headGeometry);
      const slot = new BoxGeometry(3.8 * MM, 0.5 * MM, 0.6 * MM);
      slot.translate(0, 1.05 * MM, 0);
      slot.applyMatrix4(screw.matrixWorld);
      slots.push(slot);
    }
  }
  const merged = [
    mesh(plain(mergeGeometries(heads)!), materials.brass, 'tornillos'),
    mesh(mergeGeometries(slots)!, materials.recess, 'ranuras de los tornillos'),
  ];
  for (const geometry of [...heads, ...slots]) geometry.dispose();
  return merged;
}

/** Una tecla de cerámica crema, vuelta hacia el disco, con su rótulo encima. */
function keyGroup(
  materials: InstrumentMaterials,
  id: 'play' | 'record' | 'undo',
): { group: Group; label: Mesh } {
  const group = new Group();
  group.name = `tecla ${id}`;
  const key = mesh(
    new RoundedBoxGeometry(KEY.width * MM, KEY.height * MM, KEY.depth * MM, 4, 3.5 * MM),
    materials.key,
    'tecla',
  );
  key.position.y = (KEY.height / 2) * MM;
  group.add(key);
  const label = mesh(new PlaneGeometry(14 * MM, 14 * MM), materials.key, 'rótulo');
  label.rotation.x = -Math.PI / 2;
  label.position.y = (KEY.height + 0.05) * MM;
  group.add(label);
  const placement = PLACEMENTS[id];
  place(group, placement.radius, placement.angle);
  return { group, label };
}

/** El reposo: un botón redondo y bajo de cerámica, delante de la pantalla. */
function standbyGroup(
  materials: InstrumentMaterials,
  { smallSegments }: ModelOptions,
): { group: Group; label: Mesh } {
  const group = new Group();
  group.name = 'reposo';
  const radius = STANDBY_SIZE / 2;
  const height = PLACEMENTS.standby.height;
  const profile: ProfilePoint[] = [
    [0, 0],
    [radius, 0],
    [radius, height, 2],
    [0, height],
  ];
  group.add(mesh(lathe(profilePoints(profile), smallSegments), materials.key, 'botón'));
  const label = mesh(new PlaneGeometry(9 * MM, 9 * MM), materials.key, 'rótulo');
  label.rotation.x = -Math.PI / 2;
  label.position.y = (height + 0.05) * MM;
  group.add(label);
  place(group, PLACEMENTS.standby.radius, PLACEMENTS.standby.angle);
  // Va detrás: sin girarlo, su rótulo se lee derecho desde delante.
  group.rotation.y = 0;
  return { group, label };
}

/** Alto del faldón moleteado de los diales. */
const SKIRT = 3.5;

/**
 * Un dial de latón: el faldón moleteado, el hombro, el cuerpo y la tapa cepillada, con una raya que
 * señala su valor. El grupo gira sobre su eje; en reposo, la raya mira hacia quien toca. La pátina
 * oscurece el hombro, donde se acumula.
 */
function dialGroup(
  materials: InstrumentMaterials,
  { smallSegments }: ModelOptions,
  id: PlacedControl,
): Group {
  const placement = PLACEMENTS[id];
  const radius = placement.footprint;
  const height = placement.height;
  const group = new Group();
  group.name = `dial ${id}`;

  const skirtPoints = profilePoints([
    [radius - 0.6, 0],
    [radius, 0.3],
    [radius, SKIRT],
  ]);
  const skirt = lathe(skirtPoints, smallSegments * 2);
  const ridges = Math.round(2 * Math.PI * radius * KNURL_RIDGES_PER_MM);
  tileLathe(skirt, skirtPoints, smallSegments * 2, { uRepeat: ridges, tile: 1 });
  group.add(mesh(skirt, materials.knurl, 'faldón'));

  const shoulder = SKIRT + 1.2;
  const cap: ProfilePoint[] = [
    [radius, SKIRT],
    [radius * 0.88, shoulder],
    [radius * 0.84, height, 2.5],
    [0, height],
  ];
  const capGeometry = shade(lathe(profilePoints(cap), smallSegments), (_x, y) =>
    y / MM < shoulder + 0.2 ? 0.74 : 1,
  );
  group.add(mesh(capGeometry, materials.brass, 'tapa'));
  const line = mesh(
    new BoxGeometry(1.6 * MM, 0.4 * MM, radius * 0.6 * MM),
    materials.recess,
    'raya',
  );
  line.position.set(0, (height + 0.1) * MM, radius * 0.45 * MM);
  group.add(line);
  const point = polar(placement.radius, placement.angle);
  group.position.set(point.x * MM, DECK_HEIGHT * MM, point.z * MM);
  return group;
}

/** Los pilotos de las capas, entre cada dial y el disco, y el de grabar, detrás de su tecla. */
function pilots(
  materials: InstrumentMaterials,
  { smallSegments }: ModelOptions,
): { pilots: Mesh[]; recordLed: Mesh } {
  const dome = (radius: number, angle: number, material: Material, name: string) => {
    const geometry = lathe(
      profilePoints([
        [0, 0],
        [PILOTS.size / 2, 0],
        [PILOTS.size / 2, 1, 2.5],
        [0, 2.2],
      ]),
      Math.max(16, smallSegments / 2),
    );
    const pilot = mesh(geometry, material, name);
    place(pilot, radius, angle);
    return pilot;
  };
  return {
    pilots: LAYER_CONTROLS.map((id, layer) =>
      dome(
        PILOTS.radius,
        PLACEMENTS[id as PlacedControl].angle,
        materials.pilots[layer]!,
        `piloto ${layer + 1}`,
      ),
    ),
    recordLed: dome(
      PILOTS.recordRadius,
      PLACEMENTS.record.angle,
      materials.ledRecord,
      'piloto de grabar',
    ),
  };
}

/**
 * La rueda de volumen: su eje va en tangente y asoma por una ranura, así que su canto se mueve hacia
 * dentro y hacia fuera (arrastrar hacia el fondo, más volumen). El canto, moleteado; los lados,
 * lisos.
 */
function wheelGroup(
  materials: InstrumentMaterials,
  { smallSegments }: ModelOptions,
): { group: Group; pivot: Group } {
  const placement = PLACEMENTS.volume;
  const group = new Group();
  group.name = 'rueda';
  place(group, 0, placement.angle, 0);
  const radius = WHEEL.diameter / 2;
  const half = WHEEL.width / 2;
  const pivot = new Group();
  pivot.name = 'eje de la rueda';
  pivot.position.set(0, (DECK_HEIGHT + WHEEL.exposed - radius) * MM, placement.radius * MM);
  // El torneado de la rueda sale con su eje en y: se tumba para que quede en x (en tangente).
  const spin = new Group();
  spin.rotation.z = Math.PI / 2;
  pivot.add(spin);
  const edgePoints = profilePoints([
    [radius - 0.8, -half],
    [radius, -half + 0.8],
    [radius, half - 0.8],
    [radius - 0.8, half],
  ]);
  const edge = lathe(edgePoints, smallSegments * 2);
  tileLathe(edge, edgePoints, smallSegments * 2, {
    uRepeat: Math.round(2 * Math.PI * radius * KNURL_RIDGES_PER_MM),
    tile: 1,
  });
  spin.add(mesh(edge, materials.knurl, 'canto de la rueda'));
  for (const side of [-1, 1]) {
    const face = new CircleGeometry((radius - 0.8) * MM, smallSegments);
    const disc = mesh(plain(face), materials.brass, 'lado de la rueda');
    // Cada lado mira hacia fuera de la rueda (+y o −y antes de tumbarla).
    disc.rotation.x = -side * (Math.PI / 2);
    disc.position.y = side * half * MM;
    spin.add(disc);
  }
  const slot = mesh(
    new BoxGeometry((WHEEL.width + 4) * MM, 0.3 * MM, (WHEEL.diameter + 4) * MM),
    materials.recess,
    'ranura',
  );
  slot.position.set(0, (DECK_HEIGHT + 0.1) * MM, placement.radius * MM);
  group.add(pivot, slot);
  return { group, pivot };
}

/**
 * El brazo: el eje con su tornillo, la barra y la costilla (una hoja de latón con forma de riñón, de
 * canto hacia el disco, como la que usa el alfarero). El grupo gira sobre el eje; en reposo mira
 * hacia delante.
 */
function armGroup(materials: InstrumentMaterials, { smallSegments }: ModelOptions): Group {
  const group = new Group();
  group.name = 'brazo';
  const pivot = polar(ARM.pivotRadius, ARM.pivotAngle);
  group.position.set(pivot.x * MM, DECK_HEIGHT * MM, pivot.z * MM);
  const rest = armDirection(0);
  group.rotation.y = Math.atan2(rest.x, rest.z);

  const postTop = ARM.barHeight + 3;
  const post: ProfilePoint[] = [
    [0, 0],
    [ARM.pivotSize, 0],
    [ARM.pivotSize, postTop, 3],
    [0, postTop],
  ];
  group.add(mesh(lathe(profilePoints(post), smallSegments), materials.brassPlain, 'eje'));
  const slot = mesh(
    new BoxGeometry(7 * MM, 0.5 * MM, 0.9 * MM),
    materials.recess,
    'ranura del eje',
  );
  slot.position.y = (postTop + 0.05) * MM;
  slot.rotation.y = rad(30);
  group.add(slot);

  const barLength = ARM.length - ARM.pivotSize;
  const bar = mesh(
    new RoundedBoxGeometry(5 * MM, 4 * MM, barLength * MM, 2, 1.5 * MM),
    materials.brassPlain,
    'barra',
  );
  bar.position.set(0, ARM.barHeight * MM, (ARM.pivotSize + barLength / 2) * MM);
  group.add(bar);

  const outline = new Shape();
  outline.absellipse(0, 0, (ARM.ribWidth / 2) * MM, (ARM.ribHeight / 2) * MM, 0, 2 * Math.PI);
  const ribGeometry = new ExtrudeGeometry(outline, {
    depth: (ARM.ribThickness - 1) * MM,
    bevelEnabled: true,
    bevelThickness: 0.5 * MM,
    bevelSize: 0.5 * MM,
    bevelSegments: 2,
    curveSegments: smallSegments,
  });
  ribGeometry.translate(0, 0, (-(ARM.ribThickness - 1) / 2) * MM);
  const rib = mesh(ribGeometry, materials.brassPlain, 'costilla');
  // La hoja, vertical y en el plano de la barra.
  rib.rotation.y = -Math.PI / 2;
  rib.position.set(0, ARM.barHeight * MM, ARM.length * MM);
  group.add(rib);
  return group;
}
