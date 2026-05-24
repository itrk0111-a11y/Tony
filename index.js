import 'dotenv/config';
import wolfjs from 'wolf.js';
import Tesseract from 'tesseract.js';
import axios from 'axios';
import sharp from 'sharp';
import cv from 'opencv4nodejs';

const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL,
    secret: process.env.U_PASS,

    // القناة المطلوبة
    targetGroupId: 81889058
};

const service = new WOLF();

const delay = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * OCR للصورة مع كشف الإطار الأصفر
 */
async function solveCaptcha(imageUrl) {

    try {

        // تحميل الصورة
        const response = await axios.get(
            imageUrl,
            {
                responseType: 'arraybuffer'
            }
        );

        const imageBuffer = Buffer.from(response.data);

        // حفظ مؤقت
        const tempInput = 'temp_input.png';
        const tempCrop = 'temp_crop.png';

        await sharp(imageBuffer)
            .toFile(tempInput);

        /**
         * OpenCV
         */
        const image = cv.imread(tempInput);

        const hsv = image.cvtColor(
            cv.COLOR_BGR2HSV
        );

        /**
         * كشف اللون الأصفر
         */
        const lowerYellow =
            new cv.Vec(15, 80, 80);

        const upperYellow =
            new cv.Vec(40, 255, 255);

        const mask = hsv.inRange(
            lowerYellow,
            upperYellow
        );

        const contours = mask.findContours(
            cv.RETR_EXTERNAL,
            cv.CHAIN_APPROX_SIMPLE
        );

        let biggest = null;
        let maxArea = 0;

        for (const contour of contours) {

            const rect =
                contour.boundingRect();

            const area =
                rect.width * rect.height;

            if (
                area > maxArea &&
                rect.height > 150
            ) {
                maxArea = area;
                biggest = rect;
            }
        }

        if (!biggest) {
            console.log(
                "لم يتم العثور على الإطار"
            );
            return null;
        }

        /**
         * قص الداخل
         */
        const padding = 15;

        await sharp(tempInput)
            .extract({
                left: biggest.x + padding,
                top: biggest.y + padding,
                width:
                    biggest.width -
                    padding * 2,
                height:
                    biggest.height -
                    padding * 2
            })
            .greyscale()
            .normalize()
            .threshold(150)
            .toFile(tempCrop);

        /**
         * OCR
         */
        const {
            data: { text }
        } = await Tesseract.recognize(
            tempCrop,
            'ara+eng'
        );

        let result = text
            .replace(/\n/g, ' ')
            .replace(
                /[^\u0600-\u06FFa-zA-Z0-9 ]/g,
                ''
            )
            .trim();

        /**
         * تنظيف إضافي
         */
        result = result
            .split(' ')
            .filter(x => x.length > 1)[0];

        console.log(
            "الكلمة المكتشفة:",
            result
        );

        return result || null;

    } catch (e) {

        console.log(
            "خطأ OCR:",
            e
        );

        return null;
    }
}

/**
 * مراقبة الرسائل
 */
service.on(
    'groupMessage',
    async (message) => {

        try {

            /**
             * فقط القناة المطلوبة
             */
            if (
                message.targetGroupId !==
                settings.targetGroupId
            ) return;

            /**
             * فقط رسائل التحقق
             */
            const content =
                message.body || '';

            const isCaptcha =
                content.includes('تحقق');

            if (!isCaptcha) return;

            console.log(
                "تم اكتشاف رسالة تحقق"
            );

            /**
             * إذا كانت صورة
             */
            if (
                message.hasAttachments &&
                message.attachments?.length
            ) {

                await delay(2500);

                const imageUrl =
                    message.attachments[0].link;

                const answer =
                    await solveCaptcha(
                        imageUrl
                    );

                if (answer) {

                    console.log(
                        "إرسال:",
                        answer
                    );

                    await service.messaging
                        .sendGroupMessage(
                            settings.targetGroupId,
                            `#${answer}`
                        );
                }

                return;
            }

            /**
             * التحقق النصي
             */

            await delay(2500);

            /**
             * داخل القوسين
             */
            if (
                content.includes(
                    "داخل القوسين"
                )
            ) {

                const match =
                    content.match(
                        /\((.*?)\)/
                    );

                if (match) {

                    await service.messaging
                        .sendGroupMessage(
                            settings.targetGroupId,
                            `#${match[1].trim()}`
                        );
                }
            }

            /**
             * الأقواس المعقوفة
             */
            else if (
                content.includes(
                    "الأقواس المعقوفة"
                )
            ) {

                const match =
                    content.match(
                        /\{(.*?)\}/
                    );

                if (match) {

                    await service.messaging
                        .sendGroupMessage(
                            settings.targetGroupId,
                            `#${match[1].trim()}`
                        );
                }
            }

        } catch (err) {

            console.log(
                "خطأ:",
                err
            );
        }
    }
);

/**
 * Ready
 */
service.on('ready', async () => {

    console.log(
        `🚀 البوت يعمل في القناة ${settings.targetGroupId}`
    );

    await service.group.joinById(
        settings.targetGroupId
    );
});

/**
 * تسجيل الدخول
 */
service.login(
    settings.identity,
    settings.secret
);
