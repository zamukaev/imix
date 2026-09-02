/**
 * Generates the placeholder `.glb` models the 3D viewer falls back to.
 *
 * These are deliberately generic slabs — a rounded body and a dark screen — and
 * they are generated here rather than downloaded so the shipped asset is
 * provably self-authored. iMIX resells genuine Apple hardware but does not ship
 * Apple-owned 3D assets (see CLAUDE.md, "Hard constraints"); a real model
 * replaces a placeholder by pointing `model3dUrl` at it in the admin, with no
 * code change.
 *
 * Run: `pnpm --filter web models:placeholder`
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BoxGeometry, Matrix4 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');

/** glTF component types, the only two this writer emits. */
const FLOAT = 5126;
const UNSIGNED_INT = 5125;

/** GLB container constants — magic "glTF", container version, chunk tags. */
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const MATERIALS = {
  body: {
    name: 'body',
    pbrMetallicRoughness: {
      baseColorFactor: [0.78, 0.79, 0.81, 1],
      metallicFactor: 0.9,
      roughnessFactor: 0.35,
    },
  },
  screen: {
    name: 'screen',
    pbrMetallicRoughness: {
      baseColorFactor: [0.04, 0.04, 0.05, 1],
      metallicFactor: 0.1,
      roughnessFactor: 0.12,
    },
  },
};

/** Pads a buffer to the 4-byte alignment every glTF bufferView requires. */
function padTo4(bytes, fill = 0) {
  const remainder = bytes.length % 4;
  if (remainder === 0) return bytes;
  return Buffer.concat([bytes, Buffer.alloc(4 - remainder, fill)]);
}

/**
 * Serialises a list of `{ geometry, material }` parts into one GLB.
 *
 * Transforms are baked into the vertices rather than expressed as node TRS, so
 * every node is an identity and the writer never has to touch quaternions.
 */
function toGlb(parts) {
  const json = {
    asset: { version: '2.0', generator: 'imix placeholder generator' },
    scene: 0,
    scenes: [{ nodes: parts.map((_, index) => index) }],
    nodes: parts.map((part, index) => ({ name: part.name, mesh: index })),
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };

  const materialIndex = new Map();
  const chunks = [];
  let offset = 0;

  /** Appends one accessor + its bufferView, returning the accessor index. */
  const pushAccessor = (data, componentType, type, count, extra = {}) => {
    const bytes = padTo4(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    chunks.push(bytes);

    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.byteLength });
    offset += bytes.length;

    json.accessors.push({
      bufferView: json.bufferViews.length - 1,
      componentType,
      count,
      type,
      ...extra,
    });
    return json.accessors.length - 1;
  };

  for (const part of parts) {
    const { geometry } = part;
    // Both source geometries ship their own normals, and `RoundedBoxGeometry`'s
    // are smooth across the fillets. Recomputing them on a non-indexed geometry
    // would replace exactly that with flat per-face normals.
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();

    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const index = geometry.getIndex();

    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;

    // POSITION is the one accessor glTF requires min/max on — viewers use it to
    // frame the model without decoding the vertex buffer first.
    const positionAccessor = pushAccessor(
      Float32Array.from(position.array),
      FLOAT,
      'VEC3',
      position.count,
      { min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] },
    );
    const normalAccessor = pushAccessor(
      Float32Array.from(normal.array),
      FLOAT,
      'VEC3',
      normal.count,
    );
    // `RoundedBoxGeometry` is non-indexed. glTF allows that too, so rather than
    // synthesising a throwaway 0..n index the primitive simply omits one.
    const indexAccessor =
      index === null
        ? null
        : pushAccessor(Uint32Array.from(index.array), UNSIGNED_INT, 'SCALAR', index.count);

    if (!materialIndex.has(part.material.name)) {
      json.materials.push(part.material);
      materialIndex.set(part.material.name, json.materials.length - 1);
    }

    json.meshes.push({
      name: part.name,
      primitives: [
        {
          attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
          ...(indexAccessor === null ? {} : { indices: indexAccessor }),
          material: materialIndex.get(part.material.name),
        },
      ],
    });
  }

  const bin = Buffer.concat(chunks);
  json.buffers.push({ byteLength: bin.length });

  // The JSON chunk pads with spaces and the binary chunk with zeroes — the spec
  // is explicit about both, and some loaders reject the wrong filler.
  const jsonChunk = padTo4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binChunk = padTo4(bin);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(GLB_VERSION, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(CHUNK_BIN, 4);

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

/**
 * Bakes a transform into a geometry, in the order local offset → rotation about
 * X → world translation. The local offset has to come first: on the tilted lid
 * it is what lifts the screen off the panel *along the panel's own normal*, and
 * a world-space offset would push it through the back instead.
 */
function placed(geometry, { localZ = 0, x = 0, y = 0, z = 0, rotateX = 0 } = {}) {
  if (localZ !== 0) geometry.applyMatrix4(new Matrix4().makeTranslation(0, 0, localZ));
  if (rotateX !== 0) geometry.applyMatrix4(new Matrix4().makeRotationX(rotateX));
  return geometry.applyMatrix4(new Matrix4().makeTranslation(x, y, z));
}

/** A generic handset: rounded slab, inset dark screen. Units are metres. */
function phone() {
  const width = 0.072;
  const height = 0.147;
  const depth = 0.008;

  return [
    {
      name: 'phone-body',
      material: MATERIALS.body,
      geometry: new RoundedBoxGeometry(width, height, depth, 4, 0.0035),
    },
    {
      name: 'phone-screen',
      material: MATERIALS.screen,
      geometry: placed(new BoxGeometry(width - 0.006, height - 0.007, 0.0004), {
        z: depth / 2,
      }),
    },
  ];
}

/** A generic laptop: base, lid hinged back, dark panel on the lid. */
function laptop() {
  const width = 0.31;
  const baseDepth = 0.22;
  const baseHeight = 0.011;
  const lidHeight = 0.21;
  const lidThickness = 0.006;
  const lidTilt = -0.35; // radians back from vertical

  // The lid is already upright as built (height on Y, thickness on Z), so it
  // only tilts back. These two put its *bottom edge* on the base's rear top
  // edge after that rotation, which is where a hinge actually is.
  const lidY = baseHeight / 2 + (lidHeight / 2) * Math.cos(lidTilt);
  const lidZ = -baseDepth / 2 + (lidHeight / 2) * Math.sin(lidTilt);

  return [
    {
      name: 'laptop-base',
      material: MATERIALS.body,
      geometry: new RoundedBoxGeometry(width, baseHeight, baseDepth, 3, 0.004),
    },
    {
      name: 'laptop-lid',
      material: MATERIALS.body,
      geometry: placed(new RoundedBoxGeometry(width, lidHeight, lidThickness, 3, 0.0025), {
        y: lidY,
        z: lidZ,
        rotateX: lidTilt,
      }),
    },
    {
      name: 'laptop-screen',
      material: MATERIALS.screen,
      geometry: placed(new BoxGeometry(width - 0.014, lidHeight - 0.014, 0.0004), {
        localZ: lidThickness / 2,
        y: lidY,
        z: lidZ,
        rotateX: lidTilt,
      }),
    },
  ];
}

await mkdir(OUT_DIR, { recursive: true });

for (const [name, build] of Object.entries({ phone, laptop })) {
  const file = join(OUT_DIR, `placeholder-${name}.glb`);
  const glb = toGlb(build());
  await writeFile(file, glb);
  process.stdout.write(`${file}  ${(glb.length / 1024).toFixed(1)} kB\n`);
}
