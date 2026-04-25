<?php
require 'vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

header('Content-Type: application/json');

$apiKey = $_ENV['API_KEY'];
if(!$apiKey){
    echo json_encode(["error" => "API key missing"]);
    exit;
}

// استقبال البيانات من الـ Frontend
$input = json_decode(file_get_contents("php://input"), true);

// لو عايز تبعت دفعة كاملة (Batch)
$batchRequests = [];
for ($i = 1; $i <= 450; $i++) {
    $batchRequests[] = [
        "custom_id" => "msg$i",
        "body" => [
            "contents" => [[ "parts" => [[ "text" => "رسالة رقم $i" ]]]]
        ]
    ];
}

$ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:batchGenerateContent?key=$apiKey");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["requests" => $batchRequests]));

$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($status);
echo $response ?: json_encode(["error" => "Empty response from API"]);
