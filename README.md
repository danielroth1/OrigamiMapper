This Webside allows you to create a print out for origami boxes with your own custom images.
<br>
Here some random YouTube video of the box assembly:
https://www.youtube.com/watch?v=E-NGbi4VIIs \
The base is an A4 paper so the custom image can be printed on with any office printer
You will need two images, one for the inside of the box and one for the outside. You can also use the same image for inside and outside.

To get started, create an image that shows you where your where what part of your image is drawn on the box.
Afterwards open examples/box_page1_template_interm.jpg and examples/box_page2_template_interm.jpg:
/usr/local/bin/python3 /Users/daniel/Projects/OrigamiMapper/origami_mapper.py -outside auxiliary/empty.jpg -inside auxiliary/empty.jpg -output_page1 examples/box_page1_template.jpg -output_page2 examples/box_page2_template.jpg -output_inside_mapping examples/box_outside_mapping.jpg -output_outside_mapping examples/box_inside_mapping.jpg -template templates/box.json

Example use where there are two images inside exmples/mana_box/ (page1.jpg, page2.jpg) folder:

mkdir -p examples/mana_box/output
/usr/local/bin/python3 /Users/daniel/Projects/OrigamiMapper/origami_mapper.py -outside examples/mana_box/page1.jpg -inside examples/mana_box/page2.jpg -output_page1 examples/mana_box/output/page1_output.jpg -output_page2 examples/mana_box/output/page2_output.jpg -output_outside_mapping examples/mana_box/output/output_outside_mapping.jpg -output_inside_mapping examples/mana_box/output/output_inside_mapping.jpg -template templates/box.json

examples/mana_box/output/output_inside_mapping.jpg and examples/mana_box/output/output_outside_mapping.jpg
show the mapping on the original image to get an idea how the box will look like.

examples/mana_box/output/page1_output.jpg and examples/mana_box/output/page2_output.jpg
are the A4 images for the printer.
