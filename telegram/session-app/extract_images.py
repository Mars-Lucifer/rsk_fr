import fitz
import os

pdf_path = "C:\\Users\\Андрей\\OneDrive\\Рабочий стол\\ТЗ_площадки_Актуганов_А_Н_декабрь_2025_г.pdf"
output_dir = "D:\\session-app\\frontend\\public\\images"

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

doc = fitz.open(pdf_path)
for page_index in range(len(doc)):
    page = doc.load_page(page_index)
    image_list = page.get_images()
    
    for image_index, img in enumerate(image_list, start=1):
        xref = img[0]
        base_image = doc.extract_image(xref)
        image_bytes = base_image["image"]
        image_ext = base_image["ext"]
        image_filename = os.path.join(output_dir, f"tz_page{page_index+1}_img{image_index}.{image_ext}")
        
        with open(image_filename, "wb") as f:
            f.write(image_bytes)
            
print("Extraction complete")
