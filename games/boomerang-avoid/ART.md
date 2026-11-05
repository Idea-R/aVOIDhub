# Cosmic garden art

All runtime geometry is authored procedurally in `src/render.ts`: six small creatures, layered floating garden islands, stone caps, leaf clumps, flowers, ceramic kilns, garden pillars, hazard markings, star seed and boomerangs. The renderer maps the simulation x/y plane onto Three.js x/z. Decoration sits outside collision geometry or matches canonical obstacle/hazard data.

Pip is a round seedling; Kiln a handled ceramic vessel; Volt a little angular mechanism; Nori has a seaweed crown; Cairn is a stack of stone; Comet has a lilac trailing crest. Foot rings carry seat colors independently of the silhouette. Hand-authored DOM/CSS icons mirror each silhouette for score and lobby readability.

The orthographic camera, warm directional light, cool fill, soft shadows and restrained particles produce a toy garden look. Reduced motion disables decorative bobbing, orbiting, and most particles. Graphics quality caps DPR and can disable shadow rendering. These assets are an original procedural production checkpoint; they are not a claim of a completed external Blender asset pipeline.
