/**
 * El aparato en bloques (PLAN fase 5.a): cada pieza de `instrument/layout.ts`, con formas sencillas
 * y los materiales provisionales. Sin DOM: las texturas (pantalla, rótulos y sombra) las pone quien
 * lo monta, así que se puede construir y medir en Node.
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
  type Material,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
import { lathe, latheSector, MM, profilePoints, rad, type ProfilePoint } from './geometry';

/** Segmentos alrededor de las piezas torneadas grandes (cuerpo y disco) y de las pequeñas. */
const ROUND_SEGMENTS = 128;
const SMALL_SEGMENTS = 48;

/** Lo que el montaje de la escena necesita tocar después de construir el aparato. */
export interface InstrumentModel {
  readonly root: Group;
  /** El grupo de cada control (lo que gira, se hunde o se mueve con su valor). */
  readonly controls: ReadonlyMap<ControlId, Object3D>;
  /** La pantalla y el plano de cada rótulo, para ponerles su textura. */
  readonly screen: Mesh;
  readonly labels: ReadonlyMap<'play' | 'record' | 'undo' | 'standby', Mesh>;
}

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

export function buildInstrument(materials: InstrumentMaterials): InstrumentModel {
  const root = new Group();
  root.name = 'torno';
  const controls = new Map<ControlId, Object3D>();

  root.add(body(materials), ...feet(materials));
  const disc = discGroup(materials);
  controls.set('disc', disc);
  root.add(disc, discWell(materials));

  const tray = trayGroup(materials);
  root.add(tray.group);

  const labels = new Map<'play' | 'record' | 'undo' | 'standby', Mesh>();
  for (const id of ['play', 'record', 'undo'] as const) {
    const key = keyGroup(materials, id);
    controls.set(id, key.group);
    labels.set(id, key.label);
    root.add(key.group);
  }
  const standby = standbyGroup(materials);
  controls.set('standby', standby.group);
  labels.set('standby', standby.label);
  root.add(standby.group);

  for (const id of [...LAYER_CONTROLS, 'main'] as PlacedControl[]) {
    const dial = dialGroup(materials, id);
    controls.set(id, dial);
    root.add(dial);
  }
  root.add(...pilots(materials));

  const wheel = wheelGroup(materials);
  controls.set('volume', wheel);
  root.add(wheel);

  const arm = armGroup(materials);
  controls.set('arm', arm);
  root.add(arm);

  return { root, controls, screen: tray.screen, labels };
}

/** El cuerpo: un plato grueso torneado que se abre desde la base, con el canto redondeado. */
function body(materials: InstrumentMaterials): Mesh {
  const bottom = FEET.height;
  const profile: ProfilePoint[] = [
    [0, bottom],
    [BODY.baseRadius, bottom, BODY.footRadius],
    [BODY.radius, bottom + BODY.flare, 30],
    [BODY.radius, DECK_HEIGHT, BODY.edgeRadius],
    [0, DECK_HEIGHT],
  ];
  return mesh(
    lathe(profilePoints(profile, { segments: 10 }), ROUND_SEGMENTS),
    materials.body,
    'cuerpo',
  );
}

function feet(materials: InstrumentMaterials): Mesh[] {
  return FEET.angles.map((angle) => {
    const foot = mesh(
      new CylinderGeometry(FEET.radius * MM, FEET.radius * MM, FEET.height * MM, 32),
      materials.rubber,
      'pata',
    );
    place(foot, FEET.distance, angle, FEET.height / 2);
    return foot;
  });
}

/** El disco: el esmalte, su anillo de latón, el cubo del centro y la marca que da la vuelta. */
function discGroup(materials: InstrumentMaterials): Group {
  const group = new Group();
  group.name = 'disco';
  const base = DECK_HEIGHT + DISC.gap;
  const top = base + DISC.thickness;
  const glaze: ProfilePoint[] = [
    [0, base],
    [DISC.radius, base, 1.5],
    [DISC.radius, top, 3],
    [0, top],
  ];
  group.add(mesh(lathe(profilePoints(glaze), ROUND_SEGMENTS), materials.glaze, 'esmalte'));

  const inner = DISC.radius + 0.4;
  const ring: ProfilePoint[] = [
    [DISC_OUTER_RADIUS, base - 1],
    [DISC_OUTER_RADIUS, top - 1.5, 1.5],
    [inner, top - 1.5, 0.8],
    [inner, base - 1],
  ];
  group.add(
    mesh(lathe(profilePoints(ring, { closed: true }), ROUND_SEGMENTS), materials.brass, 'anillo'),
  );

  const hub: ProfilePoint[] = [
    [0, top],
    [DISC.hubRadius, top],
    [DISC.hubRadius, top + 2.5, 2.5],
    [0, top + 3.5],
  ];
  group.add(mesh(lathe(profilePoints(hub), SMALL_SEGMENTS), materials.brass, 'cubo'));

  const mark = mesh(new CircleGeometry(3.5 * MM, 24), materials.key, 'marca');
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(0, (top + 0.05) * MM, DISC.markRadius * MM);
  group.add(mark);
  return group;
}

/** El hueco oscuro alrededor del disco: el disco está levantado sobre la cubierta. */
function discWell(materials: InstrumentMaterials): Mesh {
  const well = mesh(
    new RingGeometry(DISC.radius * MM, (DISC_OUTER_RADIUS + 4) * MM, ROUND_SEGMENTS),
    materials.recess,
    'hueco del disco',
  );
  well.rotation.x = -Math.PI / 2;
  well.position.y = (DECK_HEIGHT + 0.05) * MM;
  return well;
}

/** La bandeja de detrás, con la pantalla curva en su cara de dentro y cuatro tornillos. */
function trayGroup(materials: InstrumentMaterials): { group: Group; screen: Mesh } {
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
  group.add(
    mesh(
      latheSector(
        profilePoints(profile, { closed: true }),
        64,
        180 - TRAY.halfAngle,
        180 + TRAY.halfAngle,
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
    48,
    180 - SCREEN.halfAngle,
    180 + SCREEN.halfAngle,
  );
  // Vista desde delante, la pantalla va de derecha a izquierda y de arriba abajo al revés que sus
  // coordenadas de textura: se giran las dos para que el texto se lea.
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i));
  const screen = mesh(geometry, materials.screen, 'pantalla');
  group.add(screen);

  // Tornillos en las esquinas de la pantalla.
  const screwAngle = SCREEN.halfAngle + (TRAY.halfAngle - SCREEN.halfAngle) / 2;
  for (const angle of [180 - screwAngle, 180 + screwAngle]) {
    for (const height of [SCREEN.bottom + 2, SCREEN.top - 2]) {
      const screw = mesh(
        new CylinderGeometry(2.4 * MM, 2.4 * MM, 1.2 * MM, 20),
        materials.brassPlain,
        'tornillo',
      );
      screw.rotation.x = Math.PI / 2 - rad(TRAY.lean);
      const holder = new Group();
      holder.add(screw);
      place(holder, trayInner(height) - 0.4, angle, DECK_HEIGHT + height);
      group.add(holder);
    }
  }
  return { group, screen };
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
function standbyGroup(materials: InstrumentMaterials): { group: Group; label: Mesh } {
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
  group.add(mesh(lathe(profilePoints(profile), SMALL_SEGMENTS), materials.key, 'botón'));
  const label = mesh(new PlaneGeometry(9 * MM, 9 * MM), materials.key, 'rótulo');
  label.rotation.x = -Math.PI / 2;
  label.position.y = (height + 0.05) * MM;
  group.add(label);
  place(group, PLACEMENTS.standby.radius, PLACEMENTS.standby.angle);
  // Va detrás: sin girarlo, su rótulo se lee derecho desde delante.
  group.rotation.y = 0;
  return { group, label };
}

/**
 * Un dial de latón: faldón, cuerpo y tapa redondeada, con una raya que señala su valor. El grupo
 * gira sobre su eje; en reposo, la raya mira hacia quien toca.
 */
function dialGroup(materials: InstrumentMaterials, id: PlacedControl): Group {
  const placement = PLACEMENTS[id];
  const radius = placement.footprint;
  const height = placement.height;
  const profile: ProfilePoint[] = [
    [0, 0],
    [radius, 0, 0.6],
    [radius, 3.5, 0.8],
    [radius * 0.88, 5],
    [radius * 0.84, height, 2.5],
    [0, height],
  ];
  const group = new Group();
  group.name = `dial ${id}`;
  group.add(mesh(lathe(profilePoints(profile), SMALL_SEGMENTS), materials.brass, 'dial'));
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

/** Los pilotos de las capas (el de la capa 1, encendido en la maqueta) y el de grabar. */
function pilots(materials: InstrumentMaterials): Mesh[] {
  const dome = (radius: number, angle: number, material: Material, name: string) => {
    const geometry = lathe(
      profilePoints([
        [0, 0],
        [PILOTS.size / 2, 0],
        [PILOTS.size / 2, 1, 2.5],
        [0, 2.2],
      ]),
      24,
    );
    const pilot = mesh(geometry, material, name);
    place(pilot, radius, angle);
    return pilot;
  };
  return [
    ...LAYER_CONTROLS.map((id, layer) =>
      dome(
        PILOTS.radius,
        PLACEMENTS[id as PlacedControl].angle,
        layer === 0 ? materials.pilotOn : materials.pilotOff,
        `piloto ${layer + 1}`,
      ),
    ),
    dome(PILOTS.recordRadius, PLACEMENTS.record.angle, materials.ledRecord, 'piloto de grabar'),
  ];
}

/**
 * La rueda de volumen: su eje va en tangente y asoma por una ranura, así que su canto se mueve hacia
 * dentro y hacia fuera (arrastrar hacia el fondo, más volumen).
 */
function wheelGroup(materials: InstrumentMaterials): Group {
  const placement = PLACEMENTS.volume;
  const outer = new Group();
  outer.name = 'rueda';
  place(outer, 0, placement.angle, 0);
  const radius = WHEEL.diameter / 2;
  const wheel = mesh(
    new CylinderGeometry(radius * MM, radius * MM, WHEEL.width * MM, SMALL_SEGMENTS),
    materials.brassPlain,
    'rueda',
  );
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0, (DECK_HEIGHT + WHEEL.exposed - radius) * MM, placement.radius * MM);
  const slot = mesh(
    new BoxGeometry((WHEEL.width + 4) * MM, 0.3 * MM, (WHEEL.diameter + 4) * MM),
    materials.recess,
    'ranura',
  );
  slot.position.set(0, (DECK_HEIGHT + 0.1) * MM, placement.radius * MM);
  outer.add(wheel, slot);
  return outer;
}

/**
 * El brazo: el eje, la barra y la costilla (una hoja de latón con forma de riñón, de canto hacia el
 * disco, como la que usa el alfarero). El grupo gira sobre el eje; en reposo mira hacia delante.
 */
function armGroup(materials: InstrumentMaterials): Group {
  const group = new Group();
  group.name = 'brazo';
  const pivot = polar(ARM.pivotRadius, ARM.pivotAngle);
  group.position.set(pivot.x * MM, DECK_HEIGHT * MM, pivot.z * MM);
  const rest = armDirection(0);
  group.rotation.y = Math.atan2(rest.x, rest.z);

  const post: ProfilePoint[] = [
    [0, 0],
    [ARM.pivotSize, 0],
    [ARM.pivotSize, ARM.barHeight + 3, 3],
    [0, ARM.barHeight + 3],
  ];
  group.add(mesh(lathe(profilePoints(post), SMALL_SEGMENTS), materials.brassPlain, 'eje'));

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
    curveSegments: 32,
  });
  ribGeometry.translate(0, 0, (-(ARM.ribThickness - 1) / 2) * MM);
  const rib = mesh(ribGeometry, materials.brassPlain, 'costilla');
  // La hoja, vertical y en el plano de la barra.
  rib.rotation.y = -Math.PI / 2;
  rib.position.set(0, ARM.barHeight * MM, ARM.length * MM);
  group.add(rib);
  return group;
}
