const express = require('express');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());

// ========== ГЕНЕРАЦИЯ QR-КОДА ==========
app.post('/generate-qr', async (req, res) => {
    try {
        const { trmId } = req.body;
        
        // Проверяем, что trmId передан
        if (!trmId) {
            return res.status(400).json({
                success: false,
                error: 'Нужно передать trmId'
            });
        }
        
        // Ссылка на страницу оплаты sberpos-api
        // Формат: /p/<terminal_id>
        const paymentUrl = `https://sberpos-api.onrender.com/p/${trmId}`;
        
        // Генерируем QR-код
        const qrCodeBase64 = await QRCode.toDataURL(paymentUrl);
        
        // Возвращаем результат
        res.json({
            success: true,
            qrCode: qrCodeBase64,
            url: paymentUrl
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========== ПРОВЕРКА СТАТУСА ТЕРМИНАЛА (опционально) ==========
app.get('/status/:trmId', async (req, res) => {
    try {
        const { trmId } = req.params;
        
        // Здесь можно запросить статус у sberpos-api
        // Но для простоты пока возвращаем ссылку на страницу статуса
        res.json({
            success: true,
            statusUrl: `https://sberpos-api.onrender.com/admin/status`,
            terminalId: trmId,
            note: 'Полный статус смотри в админке sberpos-api'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========== ГЛАВНАЯ СТРАНИЦА ==========
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Generator</title>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: system-ui, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background: #f5f5f5;
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 { color: #667eea; margin-bottom: 10px; }
                pre {
                    background: #2d2d2d;
                    color: #f8f8f2;
                    padding: 15px;
                    border-radius: 10px;
                    overflow-x: auto;
                }
                code {
                    background: #eee;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                .endpoint {
                    background: #e7f3ff;
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>💰 QR Generator for SberPos</h1>
                <p>Простой сервер для генерации QR-кодов</p>
                
                <div class="endpoint">
                    <strong>POST /generate-qr</strong>
                    <p>Тело запроса:</p>
                    <pre>
{
  "trmId": "TRM-0000"
}</pre>
                    <p>Ответ:</p>
                    <pre>
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "url": "https://sberpos-api.onrender.com/p/TRM-0000"
}</pre>
                </div>
                
                <p>После скана QR пользователь попадает на страницу оплаты SberPos, где уже отображается сумма и статус.</p>
            </div>
        </body>
        </html>
    `);
});

// ========== ПРОВЕРКА ЗДОРОВЬЯ ==========
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ========== ЗАПУСК ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`📱 POST /generate-qr - генерация QR`);
    console.log(`🏠 GET / - главная страница`);
});
