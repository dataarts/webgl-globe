import os

srcDir = './'
destDir = './'

script= 'python convert_obj_three.py -i '+srcDir+'OBJ -o '+destDir+'JS'

models_dict = []

dirList=os.listdir(srcDir)
for file in dirList:
  if file.find(".obj") != -1:
    models_dict.append({"file":file})

###Compress
for i in range(0,len(models_dict)):
  sh_script = script.replace("OBJ", models_dict[i]["file"])
  sh_script = sh_script.replace("JS", models_dict[i]["file"].replace(".obj", ".js"))
  os.system(sh_script)
