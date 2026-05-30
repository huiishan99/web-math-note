from PIL import Image

from apps.calculator.service import analyze_image as analyze_image_with_service


def analyze_image(img: Image.Image, dict_of_vars: dict, mode: str = "quick"):
    return analyze_image_with_service(img, dict_of_vars, mode)
