<?php
// server.php
// متطلبات: composer require vlucas/phpdotenv
require __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// ---------- إعدادات CORS ----------
$corsHeaders = [
    "Content-Type" => "application/json; charset=utf-8",
    "Access-Control-Allow-Origin" => "*",
    "Access-Control-Allow-Methods" => "POST, OPTIONS",
    "Access-Control-Allow-Headers" => "Content-Type, Authorization"
];

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    foreach ($corsHeaders as $k => $v) header("$k: $v");
    http_response_code(204);
    exit;
}

// ---------- تحميل متغيرات البيئة ----------
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

$apiKey = $_ENV['GEMINI_API_KEY'] ?? null;
$debug = ($_ENV['DEBUG'] ?? '0') === '1';

if (!$apiKey) {
    foreach ($corsHeaders as $k => $v) header("$k: $v");
    http_response_code(500);
    echo json_encode(["error" => "Missing GEMINI_API_KEY in environment"]);
    exit;
}

// ---------- قراءة جسم الطلب ----------
$raw = file_get_contents("php://input");
$input = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    foreach ($corsHeaders as $k => $v) header("$k: $v");
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON body", "details" => json_last_error_msg()]);
    exit;
}

// ---------- تجهيز payload بصيغ مرنة ----------
$payload = null;

if (isset($input['contents'])) {
    $payload = $input; // نفترض contents جاهز
} elseif (isset($input['text'])) {
    $payload = [
        "contents" => [
            ["parts" => [["text" => $input['text']]]]
        ]
    ];
} elseif (isset($input['texts']) && is_array($input['texts'])) {
    $payload = [
        "contents" => array_map(function($t){
            return ["parts" => [["text" => $t]]];
        }, $input['texts'])
    ];
} elseif (isset($input['chatHistory']) && is_array($input['chatHistory'])) {
    $payload = ["contents" => $input['chatHistory']];
} else {
    foreach ($corsHeaders as $k => $v) header("$k: $v");
    http_response_code(400);
    echo json_encode(["error" => "Request must include text, texts, contents, or chatHistory"]);
    exit;
}

// ---------- تنظيف الحقول غير المدعومة داخل inline_data ----------
// نحتفظ فقط بالحقول المسموح بها (مثال: mime_type و data).
// عدّل $allowedInlineFields لو الـ API يتطلب أسماء مختلفة (مثلاً mimeType).
$allowedInlineFields = ['mime_type', 'data'];

if (isset($payload['contents']) && is_array($payload['contents'])) {
    foreach ($payload['contents'] as $ci => $content) {
        if (!isset($content['parts']) || !is_array($content['parts'])) continue;
        foreach ($content['parts'] as $pi => $part) {
            if (!isset($part['inline_data']) || !is_array($part['inline_data'])) continue;
            $clean = [];
            foreach ($allowedInlineFields as $field) {
                if (array_key_exists($field, $part['inline_data'])) {
                    $clean[$field] = $part['inline_data'][$field];
                }
            }
            // إذا لم يبقَ شيء صالح، نحذف inline_data نهائياً
            if (!empty($clean)) {
                $payload['contents'][$ci]['parts'][$pi]['inline_data'] = $clean;
            } else {
                unset($payload['contents'][$ci]['parts'][$pi]['inline_data']);
            }
        }
    }
}

// ---------- (اختياري) تسجيل الـ payload للديباغ لو DEBUG=1 ----------
if ($debug) {
    file_put_contents(__DIR__ . '/server_payload_debug.json', json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// ---------- إرسال الطلب إلى Gemini (API key في الـ URL) ----------
$endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . urlencode($apiKey);

$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

// ---------- إعداد رؤوس الاستجابة ----------
foreach ($corsHeaders as $k => $v) header("$k: $v");

// ---------- معالجة الأخطاء والرد ----------
if ($response === false) {
    http_response_code(502);
    echo json_encode(["error" => "Upstream request failed", "details" => $curlErr]);
    exit;
}

// حاول فك JSON من الرد الوارد من Gemini
$decoded = json_decode($response, true);
if (json_last_error() === JSON_ERROR_NONE) {
    http_response_code($httpCode ?: 200);
    echo json_encode($decoded);
} else {
    // لو الرد نصي أو غير JSON، أرسله كنص خام داخل حقل rawText
    http_response_code($httpCode ?: 200);
    echo json_encode(["rawText" => $response]);
}
