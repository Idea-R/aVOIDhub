import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
INPUT=Path(__file__).resolve().parent/'runtime-geometry'
SOURCE=ROOT/'assets-src/boomerangavoid'
OUTPUT=ROOT/'games/boomerang-avoid/public/models'
SOURCE.mkdir(parents=True,exist_ok=True);OUTPUT.mkdir(parents=True,exist_ok=True)
print(json.dumps({'blender':bpy.app.version_string,'file':bpy.data.filepath,'dirty':bpy.data.is_dirty,'objects':len(bpy.context.scene.objects)}))
# This process is factory-startup and task-owned. Retain its default scene separately; never alter a live user scene.
for obj in bpy.context.scene.objects:obj.hide_render=True;obj.hide_set(True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
ids=['pip','kiln','volt','nori','cairn','comet']
durations={'idle':48,'run':24,'stop_turn':16,'dash':12,'slash':20,'throw':20,'recall_strain':32,'catch':16,'hit':16,'elimination':48,'victory':60,'spawn':30}
inventory=[]
for index,asset_id in enumerate(ids):
 before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=str(INPUT/(asset_id+'.glb')))
 imported=[o for o in bpy.data.objects if o not in before]
 collection=bpy.data.collections.new('ASSET_'+asset_id);scene.collection.children.link(collection)
 for obj in imported:
  for c in list(obj.users_collection):c.objects.unlink(obj)
  collection.objects.link(obj);obj.hide_render=False;obj.hide_set(False)
 arm=bpy.data.armatures.new(asset_id+'_rig');rig=bpy.data.objects.new(asset_id+'_rig',arm);collection.objects.link(rig)
 bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 root=arm.edit_bones.new('root');root.head=(0,0,0);root.tail=(0,0,.18)
 body=arm.edit_bones.new('body');body.head=(0,0,.18);body.tail=(0,0,.9);body.parent=root
 bpy.ops.object.mode_set(mode='OBJECT')
 meshes=[o for o in imported if o.type=='MESH']
 for obj in meshes:
  world_matrix=obj.matrix_world.copy();obj.parent=rig;obj.matrix_world=world_matrix
  vg=obj.vertex_groups.new(name='body');vg.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
  mod=obj.modifiers.new('rigid_toy_rig','ARMATURE');mod.object=rig
 # Rigid toy forms deliberately use body/root animation; no fabricated organic deformation claim.
 rig.animation_data_create()
 for clip,length in durations.items():
  action=bpy.data.actions.new(asset_id+'_'+clip);rig.animation_data.action=action
  bone=rig.pose.bones['body'];bone.rotation_mode='XYZ'
  for frame in range(1,length+1):
   t=(frame-1)/max(1,length-1);wave=math.sin(t*math.tau)
   loc=[0,0,0];rot=[0,0,0];scale=[1,1,1]
   if clip=='idle':loc[2]=math.sin(t*math.tau)*.025;scale=[1+wave*.015,1+wave*.015,1-wave*.018]
   elif clip=='run':loc[2]=abs(math.sin(t*math.tau))*.12;rot[1]=wave*.12;rot[0]=.1
   elif clip=='stop_turn':rot[2]=math.sin(t*math.pi)*.45;scale=[1+math.sin(t*math.pi)*.08,1,1-math.sin(t*math.pi)*.07]
   elif clip=='dash':rot[0]=math.sin(t*math.pi)*.5;scale=[1.1,1.25,1-.24*math.sin(t*math.pi)]
   elif clip=='slash':rot[2]=math.sin(t*math.pi)*1.1-.3;rot[1]=math.sin(t*math.pi)*.1
   elif clip=='throw':rot[2]=math.sin(t*math.pi)*-.6;rot[0]=math.sin(t*math.pi)*.2
   elif clip=='recall_strain':rot[0]=-.12+wave*.04;loc[1]=wave*.03
   elif clip=='catch':scale=[1+.12*math.sin(t*math.pi),1+.12*math.sin(t*math.pi),1-.16*math.sin(t*math.pi)]
   elif clip=='hit':rot[1]=math.sin(t*math.pi*4)*.22*(1-t);loc[0]=wave*.12*(1-t)
   elif clip=='elimination':loc[2]=math.sin(t*math.pi)*.65;rot[0]=t*math.tau;scale=[max(.02,1-t)]*3
   elif clip=='victory':loc[2]=abs(math.sin(t*math.pi*3))*.3;rot[2]=wave*.2
   elif clip=='spawn':scale=[max(.02,min(1.1,t*1.3))]*3;loc[2]=max(0,1-t*2)*.8
   # Blender bones use local +Y along the authored vertical bone, not object +Z.
   bone.location=(loc[0],loc[2],-loc[1]);bone.rotation_euler=(rot[0],rot[2],-rot[1]);bone.scale=(scale[0],scale[2],scale[1])
   bone.keyframe_insert(data_path='location',frame=frame);bone.keyframe_insert(data_path='rotation_euler',frame=frame);bone.keyframe_insert(data_path='scale',frame=frame)
  track=rig.animation_data.nla_tracks.new();track.name=clip;strip=track.strips.new(clip,1,action)
  if action.slots:strip.action_slot=action.slots[0]
  track.mute=True
 rig.animation_data.action=None
 bone=rig.pose.bones['body'];bone.location=(0,0,0);bone.rotation_euler=(0,0,0);bone.scale=(1,1,1)
 bpy.ops.object.select_all(action='DESELECT')
 for obj in imported+[rig]:obj.select_set(True)
 bpy.context.view_layer.objects.active=rig
 # glTF NLA tracks provide portable named clips; enable only during export.
 for track in rig.animation_data.nla_tracks:track.mute=False
 bpy.ops.export_scene.gltf(filepath=str(OUTPUT/(asset_id+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True)
 for track in rig.animation_data.nla_tracks:track.mute=True
 tris=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in meshes)
 inventory.append({'id':asset_id,'meshes':len(meshes),'triangles':tris,'materials':len({slot.material for obj in meshes for slot in obj.material_slots}),'bones':2,'clips':list(durations),'bytes':(OUTPUT/(asset_id+'.glb')).stat().st_size})
 for obj in imported+[rig]:obj.hide_render=True;obj.hide_set(True)

# Save editable source with all six assets, rigs, NLA and materials.
scene.frame_start=1;scene.frame_end=60;scene.frame_set(1)
for collection in bpy.data.collections:
 if not collection.name.startswith('ASSET_'):continue
 for rig in collection.objects:
  if rig.type!='ARMATURE':continue
  rig.animation_data.action=None
  for track in rig.animation_data.nla_tracks:track.mute=True
  for bone in rig.pose.bones:bone.location=(0,0,0);bone.rotation_euler=(0,0,0);bone.scale=(1,1,1)
bpy.context.view_layer.update()
for obj in bpy.data.collections['ASSET_pip'].objects:obj.hide_render=False;obj.hide_set(False)
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Garden_Studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.09,.15,.16,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
camera_data=bpy.data.cameras.new('review_camera');camera=bpy.data.objects.new('review_camera',camera_data);scene.collection.objects.link(camera);camera.location=(2.8,-4,2.7);camera.rotation_euler=(Vector((0,0,.55))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=2.5;scene.camera=camera
light_data=bpy.data.lights.new('soft_key','AREA');light_data.energy=400;light_data.shape='DISK';light_data.size=4;light=bpy.data.objects.new('soft_key',light_data);scene.collection.objects.link(light);light.location=(1,-3,5);light.rotation_euler=(Vector((0,0,.5))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'garden-creatures.blend'))
scene.render.filepath=str(SOURCE/'pip-review.png');bpy.ops.render.render(write_still=True)
(SOURCE/'asset-inventory.json').write_text(json.dumps({'blender':bpy.app.version_string,'source':'Original runtime geometry exported through Three.js GLTFExporter; rigged and animated in task-owned Blender CLI','coordinateContract':'meters, Blender Z-up export glTF Y-up, origin at feet, forward +Z in runtime','inventory':inventory},indent=2))
print(json.dumps({'complete':True,'assets':len(inventory),'inventory':inventory}))
