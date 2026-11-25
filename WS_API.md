# WebSocket v2 — wspólne uprawnienia całej automatyki

**Endpoint:** `wss://HOST/ws/serverroom` lub lokalnie `ws://HOST:1880/ws/serverroom`. Przy niestandardowym `httpNodeRoot` dodaj jego prefiks. Wiadomości: tekstowy JSON, pojedynczy obiekt, do 4096 B po stronie walidacji aplikacji.

**Najważniejsza zmiana:** karta RFID otwiera dostęp całemu systemowi. WS nie loguje konkretnej przeglądarki. Nie ma `pairing_key`, oczekiwania `AUTH_PENDING` ani konieczności wysyłania `AUTH_BEGIN`. Czytnik działa także bez żadnego połączenia WS. W czasie odblokowania dowolny klient mający dostęp sieciowy do endpointu może odczytywać i sterować systemem. Zamknięcie przeglądarki nie odbiera praw fizycznym kontrolerom.

## Koperta i autoryzacja

Żądanie wymaga `action` i unikalnego `request_id`: 1–64 znaków z zestawu ASCII liter/cyfr, `_`, `-`, `.`. Nie wysyłaj UID, SQL, `user_id`, `access_level` ani `_session` jako danych autoryzacji.

```json
{"action":"GET_AUTH_STATE","request_id":"auth-state-1"}
```

Odpowiedź przy blokadzie:

```json
{"v":2,"timestamp":"2026-11-12T12:00:00.000Z","type":"AUTH_STATE","request_id":"auth-state-1","unlocked":false,"expires_at":null,"scope":"system","reader":"czytnik_rfid"}
```

Po fizycznym przyłożeniu ważnej karty serwer odblokowuje automatykę, uruchamia scenę wejścia i zawiadamia zarejestrowane połączenia:

```json
{"v":2,"timestamp":"2026-11-12T12:00:05.000Z","type":"AUTH_STATE","request_id":null,"scope":"system","unlocked":true,"expires_at":"2026-11-12T12:15:05.000Z","reason":null}
```

Klient rejestruje się przy pierwszym poprawnym żądaniu, np. `GET_AUTH_STATE`. Samo otwarcie gniazda bez wysłania żadnej wiadomości nie zapisuje go na listę powiadomień. Po `unlocked:true` wyślij `GET_SNAPSHOT` i opcjonalnie `SUBSCRIBE`. Możesz też od razu żądać danych, jeżeli system jest już odblokowany przez fizyczną kartę.

Domyślnie uprawnienia trwają 900 s (`RFID_AUTH_SECONDS`, 30–86400). Kolejna ważna karta odnawia czas i staje się użytkownikiem audytu kolejnych ręcznych operacji. Każda aktywna karta aktywnego użytkownika daje pełne sterowanie, niezależnie od wartości ewidencyjnej `access_level`.

Odmowa skanu: `RFID_RESULT` z `granted:false`, `code:"ACCESS_DENIED"`, `request_id:null`. Szczegółowa przyczyna trafia do bazy. Błędna karta nie unieważnia wcześniej udzielonych ważnych uprawnień. Próba fizycznego sterowania przy blokadzie może dać `CONTROL_DENIED` z `code:"AUTH_REQUIRED"` i krótką czerwoną sygnalizację.

`AUTH_BEGIN` jest tylko zgodnościowym aliasem `GET_AUTH_STATE`; nie tworzy okna parowania i nie otwiera uprawnień. Stare `AUTH_PENDING`/`AUTH_RESULT` oraz logika klucza kiosku nie należą do v2.

## Odczyty

Wszystkie poniższe operacje poza `PING` i `GET_AUTH_STATE` wymagają globalnego odblokowania i aktualnej pozytywnej kontroli karty. Nie ma dodatkowego podziału na role funkcjonalne.

| `action` | Parametry poza `request_id` | Odpowiedź |
|---|---|---|
| `PING` | brak | `PONG` |
| `GET_AUTH_STATE` | brak | `AUTH_STATE`, również przy blokadzie |
| `GET_SNAPSHOT` | brak | `SNAPSHOT`: urządzenia, encje, dostęp, tryby i alarmy automatyki |
| `GET_HISTORY` | `entity_id`; opcjonalnie zakres, limit | `HISTORY`, `[{time,value}]`, rosnąco |
| `GET_HOURLY` | `entity_id`; opcjonalnie zakres, limit | `HOURLY`, `[{hour,avg_value,min_value,max_value,samples}]`, rosnąco |
| `GET_HEAT` | `device_id`; opcjonalnie zakres, limit | `HEAT`, `[{time,energy_kwh,energy_kwh_daily,counters_inconsistent}]`, rosnąco |
| `GET_DAILY_HEAT` | `device_id`; opcjonalnie zakres, limit | `DAILY_HEAT`, `[{day,energy_used_kwh}]`, rosnąco |
| `GET_EVENTS` | opcjonalnie zakres, limit | `EVENTS`, zdarzenia sprzętu i audyt operacji, najnowsze pierwsze |
| `GET_ACCESS_LOG` | opcjonalnie `username`, zakres, limit | `ACCESS_LOG`, próby RFID, najnowsze pierwsze |
| `SUBSCRIBE` | brak | `SUBSCRIBED`, potem pełne snapshoty co około 2 s |
| `UNSUBSCRIBE` | brak | `UNSUBSCRIBED`; nie blokuje systemu |

Zakres: `from`, `to` jako ISO 8601 z `Z` lub offsetem, przedział **[from,to)**, maksymalnie 90 × 24 h. Domyślnie ostatnie 24 h. `limit`: 1–1000, domyślnie 500. `truncated:true` oznacza ucięcie — zawęź okno lub użyj agregacji. Nie ma kursora paginacji. `BIGSERIAL`, np. `events.id`, może być tekstem. Identyfikatory urządzeń/encji odczytaj ze snapshotu; nie są stałymi.

```json
{"action":"GET_HISTORY","request_id":"temp-1","entity_id":23,"from":"2026-11-11T00:00:00Z","to":"2026-11-12T00:00:00Z","limit":500}
```

```json
{"v":2,"timestamp":"2026-11-12T12:00:10.000Z","type":"HISTORY","request_id":"temp-1","data":[{"time":"2026-11-11T10:00:00Z","value":25.2}],"truncated":false,"range":{"from":"2026-11-11T00:00:00.000Z","to":"2026-11-12T00:00:00.000Z"}}
```

Godziny są liczone w UTC wyłącznie z próbek w zakresie. Dni `GET_DAILY_HEAT` odpowiadają `TimeZone` sesji bazy; skrypt uprawnień ustawia `Europe/Warsaw`. Podawaj granice pełnych dni, np. od `2026-11-12T00:00:00+01:00` do `2026-11-13T00:00:00+01:00`. Dzienny raport jest maksimum licznika dziennego z oryginalnego widoku, nie gwarantowanym bilansem przy brakach raportów/resetach.

`GET_EVENTS.data` ma pola `id,time,entity_id,device_id,user_id,event_type,data`. Operacja ręczna ma w `data` źródło `hid`/`ws`, akcję, status i liczbę komend; osobne wpisy zawierają payloady komend. `GET_ACCESS_LOG.data`: `id,time,user_id,username,granted,reason,reader`. Hashe kart/haseł i UID nie są udostępniane.

## Snapshot i aktualizacje

```json
{"action":"GET_SNAPSHOT","request_id":"init-1"}
```

`data.devices` i `data.entities` zachowują kontrakt wcześniejszej wersji:

- Urządzenie: `id,friendly_name,ieee_address,type,model,last_seen,battery_pct,link_quality,availability`.
- Encja: `id,device_id,source_key,name,kind,unit,state,state_updated_at,retained,alarm_active,latest_value,latest_time`.
- `availability`: `unknown`, `online`, `offline`. Brak komunikatów `/availability` oznacza `unknown`.
- `state` jest wartością JSON, początkowo może być `{}`. `latest_value/time` dotyczą tylko historii liczbowej. Nieznana wartość nie oznacza zera.
- RFID jest wykluczone z listy encji i historii liczbowej dla frontendu.

Nowe pola:

```json
{
  "transport": {"mqtt":"connected"},
  "access": {
    "unlocked":true,
    "scope":"system",
    "username":"operator",
    "expires_at":"2026-11-12T12:15:05.000Z"
  },
  "automation": {
    "lighting_mode":"AUTO",
    "fan_mode":"AUTO",
    "fan_forced":false,
    "occupancy":true,
    "alarms": {
      "temperature":false,"humidity":false,"air":false,
      "flood":false,"vibration":false,"intrusion":false
    },
    "desired": {
      "light":"ON",
      "fan":"OFF",
      "bulb":{"state":"ON","brightness":200,"color":{"hex":"#FFF4DD"}}
    },
    "last_hid": {
      "source":"hid","device":"pilot","action":"1_hold",
      "at":"2026-11-12T12:00:20.000Z"
    }
  }
}
```

`desired` to cel kontrolera, nie potwierdzenie fizyczne. Rzeczywiste wartości odczytuj z `entities.state`. `desired.fan=null` oznacza brak nowego celu AUTO, np. przy braku świeżej temperatury. `fan_forced=true` oznacza, że alarm wymusza wentylację mimo zapamiętanego trybu OFF.

`timestamp` odpowiedzi to czas jej utworzenia. Świeżość oceniaj po `latest_time`, `last_seen`, `state_updated_at`, `retained` i `transport.mqtt`. Po rozłączeniu brokera urządzenie może nadal mieć w bazie ostatnie `availability=online`.

```json
{"action":"SUBSCRIBE","request_id":"live-1"}
```

Odpowiedź: `SUBSCRIBED`, `interval_ms:2000`. Push: `type:SNAPSHOT`, `request_id:null`, pełne `data`. To cykliczny widok utrwalonych danych; pojedyncze naciśnięcia między snapshotami odczytuj przez `GET_EVENTS`. Jeden zablokowany/nieaktywny klient nie otrzymuje telemetrycznego broadcastu przez przypadkowe usunięcie `_session`: każda wysyłka ma adresata i sprawdza aktualną generację wspólnego uprawnienia.

Subskrypcja połączenia pozostaje zapamiętana podczas globalnej blokady, ale dane przestają płynąć. Po następnej ważnej karcie wznowi się automatycznie. Nowe połączenie musi wysłać `SUBSCRIBE` ponownie. `UNSUBSCRIBE` zatrzymuje tylko odbiór tego klienta.

## Sterowanie — te same reguły co dla HID

| Akcja | Parametry | Efekt |
|---|---|---|
| `SET_SOCKET` | `socket:l1/l2/l3`, `state:ON/OFF` | L1 zmienia ręczny tryb światła, L3 ręczny tryb wentylacji, L2 wydaje bezpośrednią komendę serwera. |
| `SET_LIGHT` | Co najmniej jedno: `state`, `brightness` integer 0–254, `hex:#RRGGBB` | Własne ustawienia żarówki; alarm nadal ma priorytet sygnalizacji. |
| `SET_FAN_MODE` | `mode:AUTO/ON/OFF` | Tryb wentylatora. Alarm temperatury/wilgotności/powietrza wymusza ON także przy OFF. |
| `SET_LIGHTING_MODE` | `mode:AUTO/ON/OFF` | Tryb oświetlenia; przywraca podążanie żarówki za światłem. |
| `SCENE` | `scene:WORK/NIGHT/ECO` | Scena z tabeli poniżej. |
| `MUTE_ALARM` | brak | Skasowanie bieżącego sygnału dźwiękowego TS0601. |
| `LOCK` / `LOGOUT` | brak | Zablokowanie całego systemu, wszystkich HID i dostępu do danych WS. |

| Scena | L1 | Żarówka | Wentylacja |
|---|---|---|---|
| WORK | ON | Biała, jasność 200 | AUTO |
| NIGHT | OFF | Niebieska, 40 | AUTO |
| ECO | OFF | OFF | AUTO |

```json
{"action":"SET_FAN_MODE","request_id":"fan-auto-1","mode":"AUTO"}
```

```json
{"action":"SCENE","request_id":"work-1","scene":"WORK"}
```

```json
{"action":"SET_LIGHT","request_id":"light-1","state":"ON","brightness":160,"hex":"#00FF88"}
```

```json
{"action":"SET_SOCKET","request_id":"server-off-1","socket":"l2","state":"OFF","confirm":"SERVER_POWER_OFF"}
```

L2 OFF wymaga jawnego potwierdzenia intencji, ale nie innej karty ani wyższego `access_level`. UI powinien zebrać świadome potwierdzenie operatora przed wysłaniem tego żądania. Pilot i automatyka nie odcinają L2.

Po audycie SQL:

```json
{"v":2,"timestamp":"2026-11-12T12:01:00.000Z","type":"COMMAND_QUEUED","request_id":"work-1","event_ids":["81","82","83"],"commands":[{"device":"listwa","payload":{"state_l1":"ON"}},{"device":"zarowka","payload":{"state":"ON","brightness":200,"color":{"hex":"#FFF4DD"}}}],"automation":{}}
```

Powyższe `automation` jest skrócone; rzeczywista odpowiedź zawiera aktualny stan kontrolera. Gdy zmiana trybu nie wymaga nowej komendy, odpowiedź ma `type:CONTROL_APPLIED`, `commands:[]`. Blokada odpowiada `SYSTEM_LOCKED`. Żadne z tych potwierdzeń nie zastępuje raportu urządzenia.

Nie ustawiaj od razu potwierdzonych kontrolek według `commands` lub `desired`. Pokaż „oczekiwanie”, a stan fizyczny aktualizuj z MQTT poprzez snapshot. Identyfikator żądania WS nie jest przenoszony przez Zigbee; pasujący raport nie dowodzi, że jest odpowiedzią na konkretną komendę. ON/OFF są idempotentnymi celami; ponowienie żądania może stworzyć kolejny wpis audytu.

## Globalna blokada i powiadomienia

```json
{"action":"LOCK","request_id":"lock-1"}
```

Po blokadzie wszyscy zarejestrowani klienci dostają `AUTH_STATE` z `unlocked:false`, `scope:"system"`, `expires_at:null` i przyczyną, np. `physical_lock`, `ws_lock`, `expired`, `revoked`, `database_error`. Wyczyść widok danych lub oznacz go jako niedostępny. Stan historycznie pobrany przez klienta nie jest zdalnie usuwany z jego pamięci.

`LOGOUT` jest aliasem globalnego `LOCK`, a **nie** wylogowaniem pojedynczej przeglądarki. Do zakończenia samego podglądu użyj `UNSUBSCRIBE` albo zamknij gniazdo. Alarmowa wentylacja/sygnalizacja i zbieranie danych działają także po blokadzie; blokowane są intencje ręczne i odczyty WS.

## Błędy

Koperta: `{"v":2,"timestamp":"...","type":"ERROR","request_id":"...","code":"AUTH_REQUIRED"}`.

| Kod | Znaczenie |
|---|---|
| `INVALID_REQUEST` | JSON, action/request_id lub rozmiar żądania niepoprawny. |
| `UNKNOWN_ACTION` | Akcja spoza kontraktu. |
| `RATE_LIMIT` | Ponad 10 żądań/s/połączenie albo 200/s łącznie. |
| `CLIENT_LIMIT` | Osiągnięto limit 50 zarejestrowanych klientów. |
| `AUTH_REQUIRED` | System zablokowany lub uprawnienie straciło ważność. Przyłóż kartę. |
| `SYSTEM_REVOKED` | Bieżąca karta/użytkownik nie jest już ważny; system jest blokowany. |
| `INVALID_RANGE`, `INVALID_LIMIT`, `INVALID_ID`, `INVALID_USERNAME` | Niepoprawne parametry odczytu. |
| `INVALID_COMMAND` | Nieobsługiwana wartość, kanał, scena lub tryb. |
| `SERVER_CONFIRMATION_REQUIRED` | Wyłączenie L2 bez `confirm:SERVER_POWER_OFF`. |
| `MQTT_OFFLINE` | Brak połączenia z brokerem; żądanie ręcznej komendy nie jest przyjmowane. LOCK nadal jest możliwy. |
| `DEVICE_NOT_REGISTERED` | Brak urządzenia celu w bazie; uruchom/sprawdź rejestr SQL. |
| `DATABASE_ERROR` | Nie zakończono operacji SQL; nie pokazuj sukcesu. |

`ACCESS_DENIED` występuje w powiadomieniu `RFID_RESULT`. Nie ma już błędów `PAIRING_DENIED`, `READER_BUSY`, `FAN_IN_AUTO_MODE` ani ograniczenia L2 do poziomu 3.

## Minimalny frontend

```javascript
const ws = new WebSocket('wss://HOST/ws/serverroom');
let id = 0;
const send = (action, fields = {}) =>
  ws.send(JSON.stringify({action, request_id: `ui-${++id}`, ...fields}));
ws.onopen = () => send('GET_AUTH_STATE');
ws.onmessage = ({data}) => {
  const m = JSON.parse(data);
  if (m.type === 'AUTH_STATE') {
    if (m.unlocked) {
      send('GET_SNAPSHOT');
      send('SUBSCRIBE');
    } else clearViewAndShowCardPrompt();
  }
  if (m.type === 'SNAPSHOT') renderSnapshot(m.data);
  if (m.type === 'SYSTEM_LOCKED' || ['AUTH_REQUIRED','SYSTEM_REVOKED'].includes(m.code))
    clearViewAndShowCardPrompt();
  if (m.type === 'ERROR') showError(m.code);
};
ws.onclose = () => showDisconnected(); // nie wysyłaj LOCK tylko dlatego, że zamykasz podgląd
```

Funkcje renderowania/powiadomień należą do Twojej aplikacji. Dodaj timeout żądań, ponowne łączenie i prezentację świeżości danych. Po reconnect ponownie odczytaj globalny stan; nie trzeba ponownie przykładać karty, jeśli wspólne uprawnienia nadal są ważne.
