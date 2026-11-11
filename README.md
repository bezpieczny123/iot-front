# Serwerownia IoT: front

Interfejs webowy do podglądu warunków, sterowania urządzeniami i kontroli dostępu (logowanie kartą RFID).
Zwykły HTML + JS, bez budowania i bez zależności.

## Pliki

index.html   strony i logika interfejsu
api.js       komunikacja z serwerem (REST + WebSocket), nazwy urządzeń, tryb mock
style.css    wygląd
fonts/       IBM Plex


## Szybki start (tryb mock, bez serwera i sprzętu)

Wystarczy dowolny serwer statyczny:

    python3 -m http.server 8000

(lub VS Code + rozszerzenie Live Server)
i wchodzimy na `http://localhost:8000/index.html?mock`
