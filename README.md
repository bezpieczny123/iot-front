# Serwerownia IoT

Panel webowy do monitorowania warunków w serwerowni, sterowania urządzeniami Zigbee i zarządzania dostępem przez karty RFID. Frontend znajduje się w `iot_front/vue` i korzysta z Vue 3, TypeScriptu i Vite.

## Uruchomienie lokalne

Wymagania to Node.js 22 i npm. Z katalogu głównego repozytorium uruchom:

```sh
cd iot_front/vue
npm ci
npm run dev
```

Otwórz [panel w trybie demo](http://localhost:5173/?mock) lub dopisz `?mock` do adresu podanego przez Vite. W tym trybie panel działa bez Node-RED, czytnika i pozostałych urządzeń.

- Kliknij **Administrator** na dolnym pasku, aby zobaczyć wszystkie widoki. **Obserwator** i **Operator** pozwalają sprawdzić pozostałe poziomy dostępu.
- W widoku **Użytkownicy** kliknij **Skanuj nową kartę**, aby uzyskać UID do przypisania do konta.
- Zmiany kont i kart w demo są przechowywane w pamięci do odświeżenia strony.

## Kompilacja i wdrożenie

W katalogu `iot_front/vue` uruchom `npm run build`. Polecenie sprawdza typy i tworzy statyczny pakiet w `dist/`. Polecenie `npm run preview` uruchamia lokalny podgląd tego pakietu. Parametr `?mock` działa również w podglądzie.

Bez `?mock` panel łączy się z `/api` i `/ws` pod tym samym adresem co strona. Serwuj `dist/` pod wspólnym adresem z endpointami Node-RED lub skieruj te ścieżki do Node-RED przez reverse proxy obsługujące WebSocket. Przy HTTPS panel używa WSS. Repozytorium zawiera frontend i symulator. Backend odpowiada za decyzję o przyznaniu dostępu oraz sprawdzanie uprawnień do żądań REST i poleceń WebSocket.

## Kontrakt REST

Wszystkie poniższe ścieżki mają prefiks `/api`. Odczyty zwracają tablice JSON, a zapisy przyjmują JSON. Dla zapisów klient sprawdza status HTTP.

| Metoda i ścieżka | Parametry lub pola |
| --- | --- |
| `GET /history` | `device`, `key`, `from`, `to`, `agg` (`raw` lub `hour`). Zwraca punkty `{ time, value }`. |
| `GET /heat` | `from`. Zwraca dzienne odczyty `{ day, energy_used_kwh }`. |
| `GET /events` | `limit`. Zwraca wpisy z polami `time`, `source`, `type`, `subject` i opcjonalnym `details`. |
| `GET /access` | `user`, `from`, `to`. Zwraca `time`, `username`, `granted` oraz opcjonalne `reason` i `reader`. |
| `GET /devices` | Zwraca listę urządzeń Zigbee według `friendly_name`. |
| `GET /users` | Zwraca konta z `id`, `username`, `access_level`, `is_active` oraz tablicą `cards`. |
| `POST /users` | `username`, `access_level`, `uid`, `valid_from`, `valid_to`. Konto można utworzyć bez karty, przekazując `null` jako UID i daty. |
| `POST /users/:id/level` | `access_level` w zakresie 1–3. |
| `POST /users/:id/cards` | `uid`, `label`, `valid_from`, `valid_to`. |
| `POST /users/:id/deactivate` | Pusty obiekt JSON. |
| `POST /cards/:id/validity` | `valid_from`, `valid_to`. Granica okresu ważności może mieć wartość `null`. |
| `POST /cards/:id/deactivate` | Pusty obiekt JSON. |

## Kontrakt WebSocket

Panel odbiera przez `/ws` cztery rodzaje komunikatów JSON:

- Odczyt lub stan urządzenia w postaci `{ "topic": "zigbee2mqtt/listwa", "payload": { "state_l1": "ON" } }`.
- Dostępność urządzenia pod `zigbee2mqtt/<friendly_name>/availability` z `payload.state` równym `online` lub `offline`.
- Logowanie po pozytywnej weryfikacji karty przez backend, np. `{ "type": "auth", "username": "admin", "level": 3 }`. Poziomy 1, 2 i 3 odpowiadają kolejno Obserwatorowi, Operatorowi i Administratorowi.
- Powiadomienie `{ "type": "event" }`, po którym widoczna tabela zdarzeń odświeża się przez REST.

Panel wysyła polecenia w postaci `{ "type": "cmd", "device": "listwa", "payload": { "state_l1": "TOGGLE" } }`. Node-RED przekazuje payload na temat `zigbee2mqtt/<device>/set`. Panel aktualizuje stan przełącznika po odebraniu komunikatu o nowym stanie urządzenia.

Odczyt UID przychodzi w payloadzie czytnika jako zwykły komunikat Zigbee2MQTT. Panel używa go w formularzach przypisywania kart. Logowanie następuje po odebraniu osobnego komunikatu `auth`.

Klient komunikacji i symulator są w [`src/services`](iot_front/vue/src/services), typy danych w [`src/types.ts`](iot_front/vue/src/types.ts), a nazwy urządzeń w [`src/devices.ts`](iot_front/vue/src/devices.ts).
