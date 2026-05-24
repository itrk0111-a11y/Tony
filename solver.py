import cv2
import pytesseract
import sys
import numpy as np

# تأكد من تثبيت مكتبات: pip install opencv-python pytesseract numpy
# ملاحظة: يجب تثبيت محرك Tesseract OCR على النظام (sudo apt install tesseract-ocr)

def solve_captcha(image_path):
    try:
        # 1. تحميل الصورة
        img = cv2.imread(image_path)
        if img is None:
            return "Error: Image not found"

        # 2. تحويل الصورة إلى HSV لاكتشاف اللون الأصفر (الإطار)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # ضبط قيم اللون الأصفر (قد تحتاج لتعديلها قليلاً حسب درجة اللون في الصورة)
        lower_yellow = np.array([20, 100, 100])
        upper_yellow = np.array([40, 255, 255])
        mask = cv2.inRange(hsv, lower_yellow, upper_yellow)

        # 3. إيجاد الكنتور (الإطار المتقطع)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # اختيار أكبر مربع (الذي يحتوي الكلمة)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        if contours:
            x, y, w, h = cv2.boundingRect(contours[0])
            
            # قص المربع
            roi = img[y:y+h, x:x+w]
            
            # تحويل الصورة إلى الرمادي وتجهيزها للـ OCR
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)

            # قراءة النص بالعربية والإنجليزية
            text = pytesseract.image_to_string(thresh, lang='ara+eng', config='--psm 7')
            return text.strip()
            
        return "No_Box_Found"
    except Exception as e:
        return str(e)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(solve_captcha(sys.argv[1]))
