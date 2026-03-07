from PIL import Image
import sys

def make_transparent(input_path, output_path, white_thresh=240, convert_to_ico=False):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    for item in datas:
        # Check if the pixel is close to white
        if item[0] > white_thresh and item[1] > white_thresh and item[2] > white_thresh:
            newData.append((255, 255, 255, 0)) # Make transparent
        else:
            newData.append(item)
            
    img.putdata(newData)
    if convert_to_ico:
        # resize for ico maybe? 
        icon_sizes = [(16,16), (32, 32), (48, 48), (64,64)]
        img.save(output_path, format='ICO', sizes=icon_sizes)
    else:
        img.save(output_path, "PNG")
        

make_transparent("C:/Users/Administrator/.gemini/antigravity/fundii-app/public/assets/fundii-logo.png", "C:/Users/Administrator/.gemini/antigravity/fundii-app/public/assets/fundii-logo.png")
make_transparent("C:/Users/Administrator/.gemini/antigravity/brain/1ccc192e-066d-46c1-90dc-19c292e95f92/grantbase_icon_favicon_1772854748843.png", "C:/Users/Administrator/.gemini/antigravity/fundii-app/app/favicon.ico", convert_to_ico=True)
