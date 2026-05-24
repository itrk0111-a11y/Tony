const { WOLF } = require('wolf.js');
const { exec } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const service = new WOLF();

// قم بتعديل هذا الرقم لرقم الروم الخاص بك
const TARGET_GROUP_ID =81889058 ; 

service.on('groupMessage', async (message) => {
    // التحقق من الروم
    if (message.targetGroupId !== TARGET_GROUP_ID) return;

    // التحقق من وجود صورة
    if (message.attachments && message.attachments.length > 0) {
        const imageUrl = message.attachments[0].link;
        const localPath = path.join(__dirname, 'temp_captcha.jpg');

        // تحميل الصورة
        const response = await axios({ url: imageUrl, responseType: 'stream' });
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        writer.on('finish', () => {
            // تشغيل سكربت البايثون
            exec(`python3 solver.py "${localPath}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error("خطأ في التحليل:", error);
                    return;
                }
                
                const result = stdout.trim();
                if (result && result !== "No_Box_Found") {
                    // إرسال النتيجة للروم
                    service.messaging.sendGroupMessage(message.targetGroupId, `# ${result}`);
                }
            });
        });
    }
});

service.login(process.env.U_MAIL, process.env.U_PASS);
