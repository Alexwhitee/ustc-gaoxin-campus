"""Export the original campus prop sets with Blender 5's Python module."""
from pathlib import Path
import math
import bpy

OUT = Path(__file__).resolve().parents[1] / 'public' / 'gaoxin-sandbox'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=.76, metal=0, glow=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = glow
    return mat


def block(name, pos, size, mat, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Edge highlights', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj


def export(name):
    bpy.ops.export_scene.gltf(filepath=str(OUT / name), export_format='GLB', export_animations=False)


def tapered_cabin(mat):
    vertices = [(-.73,-.97,.84),(.73,-.97,.84),(.73,.87,.84),(-.73,.87,.84),
                (-.60,-.79,1.34),(.60,-.79,1.34),(.60,.44,1.34),(-.60,.44,1.34)]
    mesh = bpy.data.meshes.new('Window profiles')
    mesh.from_pydata(vertices, [], [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    obj = bpy.data.objects.new('Sculpted glass cabin', mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new('Window corner radius','BEVEL')
    mod.width = .075
    mod.segments = 3


warm = material('Parking enamel', (.77,.45,.15))
steel = material('Patinated steel', (.077,.125,.148), .49, .43)
concrete = material('Cast concrete', (.36,.35,.30))
light = material('Warm practicals', (.95,.63,.28), .35, glow=.75)
glass = material('Smoky glass', (.095,.23,.26), .25, .49)
clay = material('Terracotta', (.39,.125,.08), .87)
chalk = material('Plaza stone', (.58,.52,.42))
green = material('Lakeside planting', (.105,.19,.086))
rubber = material('Tire rubber', (.025,.03,.03), .96)
ivory = material('Vehicle paint', (.57,.68,.58), .37, .32)
red = material('Rear lamps', (.72,.11,.08), .31, glow=.48)
alloy = material('Alloy trim', (.30,.34,.38), .42, .60)

# Garage with open sides, marked stalls and a low canopy.
block('Garage slab', (43,-332,.035), (31,20,.07), concrete, 0)
for x in [25,37,47,59,65]:
    block('Parking stripe', (x,-319,.075), (.12,6,.014), warm, 0)
for x in [29,57]:
    for y in [-337,-327]:
        block('Canopy pillar', (x,y,1.72), (.38,.4,3.44), steel)
        block('Pillar foot', (x,y,.28), (.68,.68,.56), concrete)
block('Canopy roof', (43,-332,3.54), (29.5,11,.22), steel, .06)
for x in [31,37,43,49,55]:
    block('Canopy strip light', (x,-332,3.40), (.10,9.8,.04), light)
for y in [-326.4,-337.6]:
    block('Garage fascia', (43,y,3.53), (29.7,.16,.60), steel, .02)
    block('Garage fascia trim', (43,y,3.22), (29.7,.18,.10), warm, .01)
for x in [35,51]:
    block('Charge pedestal', (x,-336.8,.57), (.48,.45,1.14), steel)
    block('Charge status', (x,-336.55,.81), (.24,.035,.24), light)
for i in range(3):
    block('Approach crossing', (43,-324+i*.48,.088), (4.5,.23,.02), warm, 0)

# Plaza's masonry plinths and a distinct canopy around the library portal.
for x in [47,51,55,59,63,67]:
    block('Portal fin', (x,-232.4,2.02), (.18,1.7,4.04), clay)
    block('Portal reveal', (x+.12,-233.25,2.03), (.065,.055,3.77), chalk)
block('Portal beam', (57,-232.6,3.94), (21.6,2.0,.24), steel)
block('Portal glazing', (57,-231.8,2.3), (21,.18,3.05), glass)
block('Entry lighting', (57,-233.56,3.75), (21,.06,.055), light)
for x in [10,22,94]:
    block('Planter bowl', (x,-247,.40), (3.1,1.3,.8), chalk)
    block('Planter greenery', (x,-247,.88), (2.83,1.08,.29), green, .11)
for x in [17,39,89,103]:
    block('Plaza lamp', (x,-262,1.65), (.12,.12,3.3), steel)
    block('Plaza lamp head', (x+.22,-262,3.32), (.56,.27,.10), light)

# Lake paths, small rest pockets and edge lighting.
for y in [-255,-261,-268,-274,-281]:
    block('Lake paving section', (-78.8,y,.046), (3.15,5.85,.08), chalk, .012)
    block('Lake edge guide', (-80.15,y,.105), (.09,5.8,.10), steel, .01)
for y in [-253,-272,-282]:
    block('Lake bollard', (-80,y,.55), (.15,.15,1.1), steel)
    block('Lake bollard top', (-80,y,1.04), (.17,.17,.09), light)
for y in [-260,-278]:
    block('Timber lake bench seat', (-76.1,y,.48), (.46,2.6,.12), clay)
    for offset in [-.92,.92]:
        block('Bench leg', (-76.1,y+offset,.22), (.31,.23,.44), steel)

export('landmarks.glb')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# North-facing original electric utility car. Wheels are exported separately for animation.
block('Trim', (0,0,.43), (1.78,3.57,.30), steel, .13)
block('Paint', (0,0,.65), (1.72,3.38,.43), ivory, .14)
tapered_cabin(glass)
block('Paint roof', (0,-.175,1.38), (1.29,1.37,.13), ivory, .14)
block('Tailgate', (0,-1.62,.75), (1.52,.12,.25), ivory)
for side in [-1,1]:
    block('Roof rack rail', (side*.49,-.17,1.48), (.072,1.10,.095), steel)
    block('Wing mirror', (side*.87,.49,1.03), (.20,.18,.105), alloy)
    block('Door handle', (side*.865,-.59,.84), (.025,.20,.035), alloy)
    block('Side rocker', (side*.88,-.02,.52), (.06,1.20,.115), steel)
    block('Rear light cutout', (side*.65,-1.704,.67), (.34,.045,.18), steel)
block('Front intake', (0,1.75,.60), (.88,.054,.15), steel)
block('Rear charge panel', (0,-1.735,.662), (.35,.046,.15), alloy)
for x in [-.61,.61]:
    block('Headlamp', (x,1.663,.66), (.37,.045,.11), light)
    block('Rear lamp', (x,-1.68,.68), (.31,.045,.11), red)
for i,(x,y) in enumerate([(-.83,1.08),(.83,1.08),(-.83,-1.07),(.83,-1.07)]):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=.315, depth=.23, location=(x,y,.33),
                                       rotation=(0,math.pi/2,0))
    wheel=bpy.context.object
    wheel.name=f'Wheel_{i}'
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    wheel.data.materials.append(rubber)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=.176, depth=.032,
        location=(x+math.copysign(.125,x),y,.33), rotation=(0,math.pi/2,0))
    rim = bpy.context.object
    rim.data.materials.append(alloy)
    rim.parent=wheel
    rim.location.x -= x
    rim.location.y -= y
    rim.location.z -= .33
export('utility.ev.glb')
