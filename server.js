const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SBER_API = 'https://sberpos-api.onrender.com';

// Хранилище сессий
const sessions = new Map();

// ========== ЛОГИН В ТЕРМИНАЛЕ ==========
async function loginToTerminal(terminalId, password) {
    try {
        const response = await axios.post(`${SBER_API}/login`, 
            `username=${terminalId}&password=${password}`,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );
        
        // Получаем cookies и CSRF токен
        const cookies = response.headers['set-cookie']?.join('; ') || '';
        const csrfMatch = cookies.match(/csrf=([^;]+)/);
        const csrfToken = csrfMatch ? csrfMatch[1] : null;
        
        return { success: true, cookies, csrfToken };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== ОТПРАВКА ОПЛАТЫ ==========
async function sendPayment(terminalId, password, amount, cookies, csrfToken) {
    try {
        const response = await axios.post(`${SBER_API}/admin/set_payload`, {
            state: 'pay',
            amount: String(amount),
            content: '',
            buttons: ':card\n:cash\n:cancel'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken || '',
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        return { success: response.status === 200 };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== ЭНДПОИНТ 1: ДЛЯ ПРИЛОЖЕНИЯ ==========
app.post('/generate-qr', async (req, res) => {
    try {
        const { trmId, amount, password } = req.body;
        
        if (!trmId || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Не хватает параметров: trmId и amount обязательны' 
            });
        }
        
        // Формируем ссылку для QR-кода (пароль не передаём в URL!)
        const qrData = `https://${req.get('host')}/pay?trmId=${trmId}&amount=${amount}`;
        
        // Генерируем QR-код
        const qrCodeBase64 = await QRCode.toDataURL(qrData);
        
        // Сохраняем пароль в сессии (если передан)
        if (password) {
            sessions.set(`${trmId}_${amount}`, { password });
        }
        
        res.json({
            success: true,
            qrCode: qrCodeBase64,
            paymentUrl: qrData
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== ЭНДПОИНТ 2: СТРАНИЦА ОПЛАТЫ ==========
app.get('/pay', (req, res) => {
    const { trmId, amount } = req.query;
    
    if (!trmId || !amount) {
        return res.status(400).send('Ошибка: не хватает параметров');
    }
    
    // Генерируем уникальный ID сессии
    const sessionId = Date.now().toString();
    sessions.set(sessionId, { trmId, amount, status: 'pending' });
    
    res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Оплата</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                .container {
                    max-width: 500px;
                    width: 100%;
                    background: white;
                    border-radius: 30px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    overflow: hidden;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 40px 20px;
                    text-align: center;
                }
                .header h1 { font-size: 28px; margin-bottom: 10px; }
                .content { padding: 30px; }
                .info-card {
                    background: #f8f9fa;
                    border-radius: 20px;
                    padding: 25px;
                    margin-bottom: 30px;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid #e0e0e0;
                }
                .info-row:last-child { border-bottom: none; }
                .label { font-weight: 600; color: #666; font-size: 14px; }
                .value { font-size: 18px; font-weight: 700; color: #333; }
                .amount-value { font-size: 32px; color: #667eea; }
                .pay-button {
                    width: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 18px;
                    font-size: 18px;
                    font-weight: 600;
                    border-radius: 50px;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .pay-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(102,126,234,0.4); }
                .pay-button:active { transform: translateY(0); }
                .pay-button:disabled { opacity: 0.6; cursor: not-allowed; }
                .status { margin-top: 20px; padding: 15px; border-radius: 15px; text-align: center; display: none; }
                .status.success { background: #d4edda; color: #155724; display: block; }
                .status.error { background: #f8d7da; color: #721c24; display: block; }
                .status.loading { background: #e7f3ff; color: #004085; display: block; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>💰 Оплата</h1>
                    <p>Завершите платеж</p>
                </div>
                <div class="content">
                    <div class="info-card">
                        <div class="info-row">
                            <span class="label">🔖 ID терминала:</span>
                            <span class="value">${trmId}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">💵 Сумма к оплате:</span>
                            <span class="value amount-value">${amount} ₽</span>
                        </div>
                    </div>
                    
                    <input type="password" id="password" placeholder="Введите пароль терминала" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #ddd; border-radius:10px; font-size:16px;">
                    
                    <button class="pay-button" onclick="processPayment()">
                        💳 Оплатить ${amount} ₽
                    </button>
                    
                    <div id="status" class="status"></div>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
            <script>
                const trmId = '${trmId}';
                const amount = '${amount}';
                const sessionId = '${sessionId}';
                
                async function processPayment() {
                    const button = document.querySelector('.pay-button');
                    const statusDiv = document.getElementById('status');
                    const password = document.getElementById('password').value;
                    
                    if (!password) {
                        statusDiv.className = 'status error';
                        statusDiv.innerHTML = '❌ Введите пароль терминала';
                        return;
                    }
                    
                    button.disabled = true;
                    statusDiv.className = 'status loading';
                    statusDiv.innerHTML = '🔄 Отправка запроса в терминал...';
                    
                    try {
                        const response = await axios.post('/api/pay', {
                            trmId: trmId,
                            amount: amount,
                            password: password,
                            sessionId: sessionId
                        });
                        
                        if (response.data.success) {
                            statusDiv.className = 'status success';
                            statusDiv.innerHTML = '✅ Оплата успешно отправлена! Ждите подтверждения на терминале.';
                        } else {
                            statusDiv.className = 'status error';
                            statusDiv.innerHTML = '❌ ' + (response.data.error || 'Ошибка при оплате');
                            button.disabled = false;
                        }
                    } catch (error) {
                        statusDiv.className = 'status error';
                        statusDiv.innerHTML = '❌ Ошибка: ' + (error.response?.data?.error || error.message);
                        button.disabled = false;
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// ========== ЭНДПОИНТ 3: ОБРАБОТКА ОПЛАТЫ ==========
app.post('/api/pay', async (req, res) => {
    const { trmId, amount, password, sessionId } = req.body;
    
    try {
        // Логинимся в терминале
        const loginResult = await loginToTerminal(trmId, password);
        
        if (!loginResult.success) {
            return res.status(401).json({
                success: false,
                error: 'Не удалось авторизоваться в терминале. Проверьте ID и пароль.'
            });
        }
        
        // Отправляем оплату
        const paymentResult = await sendPayment(
            trmId, password, amount, 
            loginResult.cookies, 
            loginResult.csrfToken
        );
        
        if (paymentResult.success) {
            if (sessions.has(sessionId)) {
                sessions.set(sessionId, { ...sessions.get(sessionId), status: 'paid' });
            }
            
            res.json({
                success: true,
                message: \`Оплата \${amount}₽ отправлена на терминал \${trmId}\`
            });
        } else {
            throw new Error(paymentResult.error || 'Ошибка при отправке оплаты');
        }
        
    } catch (error) {
        console.error('Payment error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========== ЗДОРОВЬЕ ==========
app.get('/health', (req, res) => {
    res.json({ status: 'ok', sessions: sessions.size });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 QR генератор: POST /generate-qr`);
    console.log(`💳 Страница оплаты: GET /pay`);
});
