const fs = require('fs');
const https = require('https');

const payload = JSON.stringify({
    name: "RVM_SENSOR",
    mac: "24:0A:C4:XX:XX:XX",
    type: "STATIC_INIT"
});

// URL Encoding untuk payload
const encodedPayload = encodeURIComponent(payload);
const url = `https://quickchart.io/qr?text=${encodedPayload}&size=300`;

const file = fs.createWriteStream("RVM_Static_QR.png");

https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
        file.close();
        console.log("QR Code berhasil diunduh ke RVM_Static_QR.png");
    });
}).on('error', function(err) {
    console.error("Gagal mengunduh QR Code:", err.message);
});