const express = require('express');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());

// ========== ГЕНЕРАЦИЯ QR-КОДА ==========
app.post('/generate-qr', async (req, res) => {
    try {
        const { trmId } = req.body;
        
        if (!trmId) {
            return res.status(400).json({
                success: false,
                error: 'Нужно передать trmId'
            });
        }
        
        // Ссылка на страницу оплаты
        const paymentUrl = `https://anycatai.onrender.com/pay/${trmId}`;
        
        // Генерируем QR-код
        const qrCodeBase64 = await QRCode.toDataURL(paymentUrl);
        
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

// ========== СТРАНИЦА ОПЛАТЫ ДЛЯ ТЕРМИНАЛА ==========
app.get('/pay/:trmId', (req, res) => {
    const { trmId } = req.params;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Оплата терминала ${trmId}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: system-ui, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 30px;
                    padding: 40px;
                    max-width: 500px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                }
                h1 {
                    color: #667eea;
                    margin-bottom: 10px;
                }
                .terminal-id {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 15px;
                    margin: 20px 0;
                    font-size: 24px;
                    font-weight: bold;
                    color: #333;
                }
                .status {
                    background: #e7f3ff;
                    color: #004085;
                    padding: 15px;
                    border-radius: 15px;
                    margin: 20px 0;
                }
                .button {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    font-size: 18px;
                    border-radius: 50px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    margin-top: 10px;
                }
                .button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px rgba(102,126,234,0.4);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>💰 Оплата</h1>
                <div class="terminal-id">
                    Терминал: ${trmId}
                </div>
                <div class="status">
                    📱 Готов к оплате
                </div>
                <button class="button" onclick="window.location.href='https://sberpos-api.onrender.com/p/${trmId}'">
                    💳 Перейти к оплате
                </button>
            </div>
        </body>
        </html>
    `);
});

// ========== АЛЬТЕРНАТИВНЫЙ ПУТЬ (payment) ==========
app.get('/payment/:trmId', (req, res) => {
    const { trmId } = req.params;
    res.redirect(`/pay/${trmId}`);
});

// ========== ТЕСТОВАЯ СТРАНИЦА ==========
app.get('/test', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Тест</title>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: system-ui;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .container {
                    background: white;
                    border-radius: 30px;
                    padding: 40px;
                    text-align: center;
                }
                .success { color: green; font-size: 50px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success">✅</div>
                <h1>Сервер работает!</h1>
                <p>Эндпоинты:</p>
                <ul style="text-align: left;">
                    <li>POST /generate-qr - генерация QR</li>
                    <li><a href="/pay/TRM-0000">/pay/TRM-0000</a> - страница оплаты</li>
                    <li><a href="/test">/test</a> - эта страница</li>
                </ul>
            </div>
        </body>
        </html>
    `);
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
                    font-family: system-ui;
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
                h1 { color: #667eea; }
                pre {
                    background: #2d2d2d;
                    color: #f8f8f2;
                    padding: 15px;
                    border-radius: 10px;
                    overflow-x: auto;
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
                <h1>💰 QR Generator</h1>
                <p>Сервер для генерации QR-кодов</p>
                
                <div class="endpoint">
                    <strong>📱 POST /generate-qr</strong>
                    <p>Тело запроса:</p>
                    <pre>{ "trmId": "TRM-0000" }</pre>
                    <p>Ответ:</p>
                    <pre>{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "url": "https://anycatai.onrender.com/pay/TRM-0000"
}</pre>
                </div>
                
                <div class="endpoint">
                    <strong>💳 Страницы оплаты:</strong>
                    <ul>
                        <li><a href="/pay/TRM-0000">/pay/TRM-0000</a></li>
                        <li><a href="/payment/TRM-0000">/payment/TRM-0000</a></li>
                    </ul>
                </div>
                
                <div class="endpoint">
                    <strong>🧪 Тестовая страница:</strong>
                    <ul>
                        <li><a href="/test">/test</a></li>
                    </ul>
                </div>
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
    console.log(`💳 /pay/:trmId - страница оплаты`);
    console.log(`🏠 / - главная страница`);
});
