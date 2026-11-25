# Serwerownia IoT

Panel Vue 3 do monitorowania warunków w serwerowni i sterowania urządzeniami Zigbee. Frontend znajduje się w `iot_front/vue`.

## Uruchomienie lokalne

Wymagania to Node.js 22 i npm. Z katalogu głównego repozytorium uruchom:

```sh
cd iot_front/vue
npm ci
npm run dev
```

Otwórz [panel w trybie demo](http://localhost:5173/?mock) albo dopisz `?mock` do adresu podanego przez Vite. Demo działa bez Node-RED, czytnika i pozostałych urządzeń.

- Wybierz **Administrator** na dolnym pasku, aby zobaczyć wszystkie widoki demo.
- W widoku **Użytkownicy** użyj **Skanuj nową kartę**, aby zasymulować odczyt UID.
- Konta, karty i role są symulowane. Zmiany kont i kart trwają do odświeżenia strony.

## Połączenie z Node-RED

Domyślny endpoint to `/ws/serverroom` pod tym samym adresem co panel. Przy HTTPS przeglądarka używa WSS. Aby przekierować połączenie z lokalnego Vite do Node-RED, wpisz adres backendu w `iot_front/vue/.env.local` i uruchom Vite ponownie:

```dotenv
NODE_RED_URL=http://127.0.0.1:1880
```

Jeśli Node-RED używa prefiksu `httpNodeRoot`, dodaj też np. `VITE_WS_PATH=/iot/ws/serverroom`. Otwórz panel bez parametru `?mock`.

Polecenie `npm run build` sprawdza typy i tworzy statyczny pakiet w `dist/`. W środowisku docelowym udostępnij pakiet razem z endpointem lub skieruj ścieżkę WebSocket do Node-RED przez reverse proxy obsługujące upgrade połączenia. `npm run preview` pozwala podejrzeć pakiet lokalnie, także z proxy i w trybie demo.

## WebSocket v2

Pełny kontrakt opisuje [WS_API.md](WS_API.md).

- Po otwarciu połączenia panel odczytuje stan przez `GET_AUTH_STATE`. Poprawny skan karty odblokowuje cały system. Po odblokowaniu panel pobiera `GET_SNAPSHOT` i odbiera aktualizacje przez `SUBSCRIBE`.
- Przycisk **Zablokuj system** wysyła `LOCK` i blokuje dostęp globalnie. Zamknięcie karty przeglądarki kończy podgląd.
- Wykresy, raporty i zdarzenia używają odczytów WebSocket. Identyfikatory urządzeń i encji pochodzą ze snapshotu.
- Polecenia sterujące używają akcji v2. Wyłączenie L2 wymaga potwierdzenia operatora. Kontrolki stanu urządzeń odzwierciedlają odczyty ze snapshotu.
- Widok rejestracji kont i kart jest dostępny w demo. Kontrakt v2 obejmuje odczyt dziennika dostępu i globalną blokadę.

Po podłączeniu Node-RED otwórz panel w dwóch kartach przeglądarki. Sprawdź, czy skan odblokowuje obie, czy **Zablokuj system** czyści dane w obu i czy odświeżenie jednej karty przy aktywnym dostępie przywraca telemetrię bez ponownego skanu.
